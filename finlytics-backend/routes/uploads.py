"""
routes/uploads.py

Phase 3: real CSV import.

Flow for POST /uploads:
  1. Read the uploaded file, hash it (sha256) for dedupe against `uploads.file_hash`.
  2. Parse with pandas, tolerating the handful of column-naming conventions
     real Indian bank exports use (see COLUMN_ALIASES).
  3. Validate each row (date parses, description non-empty, amount parses);
     rows that don't are skipped and counted, not silently dropped.
  4. Batch-categorize all valid descriptions with the Random Forest model
     loaded once at app startup (app.config["ML_MODELS"]).
  5. Insert one `uploads` row (with final counts + status) then bulk-insert
     the transactions pointing at it.

Amount convention: CSVs with separate Debit/Withdrawal and Credit/Deposit
columns are combined into one signed integer-paise amount where
  positive = money spent (debit)
  negative = money received (credit/refund/salary)
This matches the convention used by the manual-entry form in Phase 1.
"""

import csv
import hashlib
import io

import pandas as pd
from dateutil import parser as date_parser
from flask import Blueprint, current_app, request, jsonify

from database import get_db
from routes.auth import require_auth

uploads_bp = Blueprint("uploads", __name__)


def _check_owner(requested_user_id):
    uid = getattr(request, "user_id", None)
    if uid is not None and requested_user_id is not None and int(requested_user_id) != int(uid):
        return jsonify({"error": "forbidden — you can only access your own data"}), 403
    return None

# Column name variants seen on real Indian bank statement CSV exports,
# matched case-insensitively after stripping whitespace/punctuation.
COLUMN_ALIASES = {
    "date": ["date", "txn date", "transaction date", "value date", "posting date"],
    "description": ["description", "narration", "particulars", "remarks", "details", "transaction details"],
    "amount": ["amount", "amount (inr)", "txn amount"],
    "debit": ["debit", "withdrawal amt", "withdrawal amt.", "debit amount", "withdrawal"],
    "credit": ["credit", "deposit amt", "deposit amt.", "credit amount", "deposit"],
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB, matches the frontend copy


def _normalize_col(col):
    return str(col).strip().lower()


def _find_column(normalized_cols, aliases):
    for alias in aliases:
        if alias in normalized_cols:
            return normalized_cols[alias]
    return None


def _parse_amount(value):
    """Handles '1,234.50', '₹1,234.50', '-45.00', blank/NaN, etc."""
    if value is None:
        return None
    s = str(value).strip()
    if s == "" or s.lower() == "nan":
        return None
    s = s.replace(",", "").replace("₹", "").replace("Rs.", "").replace("Rs", "").strip()
    try:
        return float(s)
    except ValueError:
        return None


def _parse_date(value):
    if value is None:
        return None
    s = str(value).strip()
    if s == "" or s.lower() == "nan":
        return None
    try:
        return date_parser.parse(s, dayfirst=True).strftime("%Y-%m-%d")
    except (ValueError, OverflowError):
        return None


def _upload_to_dict(row):
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "filename": row["filename"],
        "file_hash": row["file_hash"],
        "uploaded_at": row["uploaded_at"],
        "rows_in_file": row["rows_in_file"],
        "rows_imported": row["rows_imported"],
        "status": row["status"],
    }


def _tx_to_dict(row):
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "upload_id": row["upload_id"],
        "date": row["date"],
        "description": row["description"],
        "amount": row["amount"],
        "category": row["category"],
        "is_anomaly": row["is_anomaly"],
        "created_at": row["created_at"],
    }


@uploads_bp.route("/uploads", methods=["GET"])
@require_auth
def list_uploads():
    user_id = request.args.get("user_id", type=int)
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    err = _check_owner(user_id)
    if err:
        return err

    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM uploads WHERE user_id = ? ORDER BY uploaded_at DESC",
            (user_id,),
        ).fetchall()
        return jsonify([_upload_to_dict(r) for r in rows]), 200
    finally:
        conn.close()


@uploads_bp.route("/uploads/<int:upload_id>", methods=["GET"])
@require_auth
def get_upload(upload_id):
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM uploads WHERE id = ?", (upload_id,)
        ).fetchone()
        if not row:
            return jsonify({"error": "upload not found"}), 404
        err = _check_owner(row["user_id"])
        if err:
            return err
        return jsonify(_upload_to_dict(row)), 200
    finally:
        conn.close()


@uploads_bp.route("/uploads", methods=["POST"])
@require_auth
def create_upload():
    user_id = request.form.get("user_id", type=int) or request.args.get("user_id", type=int)
    # Also allow user_id from token if form doesn't send it (more secure)
    if not user_id and hasattr(request, "user_id"):
        user_id = request.user_id
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    err = _check_owner(user_id)
    if err:
        return err

    if "file" not in request.files:
        return jsonify({"error": "no file provided (expected form field 'file')"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "no file selected"}), 400
    if not file.filename.lower().endswith(".csv"):
        return jsonify({"error": "only .csv files are supported"}), 400

    raw_bytes = file.read()
    if len(raw_bytes) == 0:
        return jsonify({"error": "the file is empty"}), 400
    if len(raw_bytes) > MAX_FILE_SIZE:
        return jsonify({"error": "file exceeds the 10MB limit"}), 400

    file_hash = hashlib.sha256(raw_bytes).hexdigest()

    conn = get_db()
    try:
        user_exists = conn.execute(
            "SELECT id FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        if not user_exists:
            return jsonify({"error": "user not found"}), 404

        dup = conn.execute(
            "SELECT * FROM uploads WHERE file_hash = ?", (file_hash,)
        ).fetchone()
        if dup:
            return jsonify({
                "error": "this exact file has already been imported",
                "existing_upload": _upload_to_dict(dup),
            }), 409

        # --- parse ---
        try:
            df = pd.read_csv(
                io.BytesIO(raw_bytes),
                dtype=str,
                keep_default_na=False,
                engine="python",
                sep=None,  # sniff delimiter (handles comma or semicolon exports)
            )
        except (pd.errors.ParserError, pd.errors.EmptyDataError, csv.Error, UnicodeDecodeError) as e:
            conn.execute(
                """INSERT INTO uploads (user_id, filename, file_hash, rows_in_file, rows_imported, status)
                   VALUES (?, ?, ?, 0, 0, 'failed')""",
                (user_id, file.filename, file_hash),
            )
            conn.commit()
            return jsonify({"error": f"couldn't parse this CSV: {e}"}), 400

        if df.empty or len(df.columns) == 0:
            conn.execute(
                """INSERT INTO uploads (user_id, filename, file_hash, rows_in_file, rows_imported, status)
                   VALUES (?, ?, ?, 0, 0, 'failed')""",
                (user_id, file.filename, file_hash),
            )
            conn.commit()
            return jsonify({"error": "the CSV has no rows"}), 400

        normalized_cols = {_normalize_col(c): c for c in df.columns}
        date_col = _find_column(normalized_cols, COLUMN_ALIASES["date"])
        desc_col = _find_column(normalized_cols, COLUMN_ALIASES["description"])
        amount_col = _find_column(normalized_cols, COLUMN_ALIASES["amount"])
        debit_col = _find_column(normalized_cols, COLUMN_ALIASES["debit"])
        credit_col = _find_column(normalized_cols, COLUMN_ALIASES["credit"])

        if not date_col or not desc_col or (not amount_col and not debit_col and not credit_col):
            conn.execute(
                """INSERT INTO uploads (user_id, filename, file_hash, rows_in_file, rows_imported, status)
                   VALUES (?, ?, ?, ?, 0, 'failed')""",
                (user_id, file.filename, file_hash, len(df)),
            )
            conn.commit()
            return jsonify({
                "error": "couldn't find date/description/amount columns. "
                         f"Columns found: {list(df.columns)}",
            }), 400

        rows_in_file = len(df)
        valid_rows = []  # list of (date, description, amount_paise)

        for _, r in df.iterrows():
            date_val = _parse_date(r.get(date_col))
            desc_val = str(r.get(desc_col, "")).strip()

            if amount_col:
                amount_val = _parse_amount(r.get(amount_col))
            else:
                debit = _parse_amount(r.get(debit_col)) if debit_col else None
                credit = _parse_amount(r.get(credit_col)) if credit_col else None
                debit = debit or 0.0
                credit = credit or 0.0
                amount_val = debit - credit if (debit or credit) else None

            if not date_val or not desc_val or amount_val is None:
                continue  # skipped row - counted via rows_in_file - len(valid_rows)

            amount_paise = round(amount_val * 100)
            valid_rows.append((date_val, desc_val, amount_paise))

        rows_imported = len(valid_rows)

        if rows_imported == 0:
            conn.execute(
                """INSERT INTO uploads (user_id, filename, file_hash, rows_in_file, rows_imported, status)
                   VALUES (?, ?, ?, ?, 0, 'failed')""",
                (user_id, file.filename, file_hash, rows_in_file),
            )
            conn.commit()
            return jsonify({
                "error": "no valid rows found (dates/descriptions/amounts didn't parse)",
                "rows_in_file": rows_in_file,
            }), 400

        # --- categorize with the model loaded at startup ---
        models = current_app.config.get("ML_MODELS", {})
        from ml.categorize import categorize_descriptions
        descriptions = [d for (_, d, _) in valid_rows]
        categories = categorize_descriptions(
            descriptions, models.get("vectorizer"), models.get("categorizer")
        )

        # --- score for anomalies (Isolation Forest) ---
        from ml.anomaly import score_transactions
        anomaly_input = [
            {"amount": amount_paise, "category": category, "date": date_val}
            for (date_val, _, amount_paise), category in zip(valid_rows, categories)
        ]
        anomaly_flags = score_transactions(
            anomaly_input, models.get("anomaly_scaler"), models.get("anomaly_detector")
        )

        status = "success" if rows_imported == rows_in_file else "partial"
        cur = conn.execute(
            """INSERT INTO uploads (user_id, filename, file_hash, rows_in_file, rows_imported, status)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (user_id, file.filename, file_hash, rows_in_file, rows_imported, status),
        )
        upload_id = cur.lastrowid
        if not upload_id:
            # Postgres fallback — fetch latest upload for this user/hash
            row_tmp = conn.execute("SELECT id FROM uploads WHERE file_hash = ?", (file_hash,)).fetchone()
            upload_id = row_tmp["id"] if row_tmp else None

        conn.executemany(
            """INSERT INTO transactions (user_id, upload_id, date, description, amount, category, is_anomaly)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            [
                (user_id, upload_id, date_val, desc_val, amount_paise, category, is_anomaly)
                for (date_val, desc_val, amount_paise), category, is_anomaly
                in zip(valid_rows, categories, anomaly_flags)
            ],
        )
        conn.commit()

        inserted = conn.execute(
            "SELECT * FROM transactions WHERE upload_id = ? ORDER BY id", (upload_id,)
        ).fetchall()

        category_counts = {}
        for c in categories:
            category_counts[c] = category_counts.get(c, 0) + 1
        anomaly_count = sum(anomaly_flags)

        upload_row = conn.execute(
            "SELECT * FROM uploads WHERE id = ?", (upload_id,)
        ).fetchone()

        return jsonify({
            "upload": _upload_to_dict(upload_row),
            "rows_skipped": rows_in_file - rows_imported,
            "category_counts": category_counts,
            "anomaly_count": anomaly_count,
            "model_used": "categorizer" in models,
            "anomaly_model_used": "anomaly_detector" in models,
            "transactions": [_tx_to_dict(t) for t in inserted],
        }), 201

    finally:
        conn.close()
