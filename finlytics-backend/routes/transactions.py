"""
routes/transactions.py

CRUD for transactions.

Currency convention: `amount` is stored in the DB as an INTEGER in the
smallest currency unit (paise). This blueprint accepts/returns amount
in the SAME integer paise unit over the API - the frontend is responsible
for formatting to rupees (amount / 100) for display, and multiplying by
100 (rounded) before sending a new transaction. Keeping the API in
integer units end-to-end avoids float rounding bugs creeping back in
at the HTTP boundary.
"""

from flask import Blueprint, request, jsonify
from database import get_db
from routes.auth import require_auth

transactions_bp = Blueprint("transactions", __name__)


def _check_owner(requested_user_id):
    # If auth is enforced, request.user_id is set. If ALLOW_ANON, it may be None.
    uid = getattr(request, "user_id", None)
    if uid is not None and requested_user_id is not None and int(requested_user_id) != int(uid):
        return jsonify({"error": "forbidden — you can only access your own data"}), 403
    return None

VALID_CATEGORIES = {
    "Uncategorized", "Food", "Travel", "Bills",
    "Shopping", "Entertainment", "Health", "Other",
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


@transactions_bp.route("/transactions", methods=["GET"])
@require_auth
def list_transactions():
    """
    Filterable list of transactions.
    Query params (all optional except user_id):
      user_id     (required) - int
      category    - one of VALID_CATEGORIES
      is_anomaly  - "0" | "1"
      start_date  - "YYYY-MM-DD" inclusive
      end_date    - "YYYY-MM-DD" inclusive
      limit       - int, default 500
    """
    user_id = request.args.get("user_id", type=int)
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    err = _check_owner(user_id)
    if err:
        return err

    category = request.args.get("category")
    is_anomaly = request.args.get("is_anomaly")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    limit = request.args.get("limit", default=500, type=int)

    query = "SELECT * FROM transactions WHERE user_id = ?"
    params = [user_id]

    if category:
        if category not in VALID_CATEGORIES:
            return jsonify({"error": f"invalid category '{category}'"}), 400
        query += " AND category = ?"
        params.append(category)

    if is_anomaly is not None:
        query += " AND is_anomaly = ?"
        params.append(1 if is_anomaly in ("1", "true", "True") else 0)

    if start_date:
        query += " AND date >= ?"
        params.append(start_date)

    if end_date:
        query += " AND date <= ?"
        params.append(end_date)

    query += " ORDER BY date DESC, id DESC LIMIT ?"
    params.append(limit)

    conn = get_db()
    try:
        rows = conn.execute(query, params).fetchall()
        return jsonify([_tx_to_dict(r) for r in rows]), 200
    finally:
        conn.close()


@transactions_bp.route("/transactions", methods=["POST"])
@require_auth
def create_transaction():
    """Manually add a single transaction (as opposed to a CSV import)."""
    data = request.get_json(silent=True) or {}

    user_id = data.get("user_id")
    err = _check_owner(user_id)
    if err:
        return err
    date = data.get("date")
    description = (data.get("description") or "").strip()
    amount = data.get("amount")
    category = data.get("category", "Uncategorized")

    if not user_id or not date or not description or amount is None:
        return jsonify({
            "error": "user_id, date, description and amount are required"
        }), 400

    if category not in VALID_CATEGORIES:
        return jsonify({"error": f"invalid category '{category}'"}), 400

    try:
        amount = int(amount)
    except (TypeError, ValueError):
        return jsonify({"error": "amount must be an integer (paise)"}), 400

    conn = get_db()
    try:
        user_exists = conn.execute(
            "SELECT id FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        if not user_exists:
            return jsonify({"error": "user not found"}), 404

        from flask import current_app
        from ml.anomaly import score_transactions
        models = current_app.config.get("ML_MODELS", {})
        is_anomaly = score_transactions(
            [{"amount": amount, "category": category, "date": date}],
            models.get("anomaly_scaler"), models.get("anomaly_detector"),
        )[0]

        cur = conn.execute(
            """INSERT INTO transactions (user_id, upload_id, date, description, amount, category, is_anomaly)
               VALUES (?, NULL, ?, ?, ?, ?, ?)""",
            (user_id, date, description, amount, category, is_anomaly),
        )
        conn.commit()
        new_id = cur.lastrowid
        if new_id:
            row = conn.execute("SELECT * FROM transactions WHERE id = ?", (new_id,)).fetchone()
        else:
            # Postgres fallback if wrapper didn't capture id (e.g. SQLite path)
            row = conn.execute(
                "SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user_id,)
            ).fetchone()
        return jsonify(_tx_to_dict(row)), 201
    finally:
        conn.close()


@transactions_bp.route("/transactions/score-anomalies", methods=["POST"])
@require_auth
def score_anomalies():
    """Score any transactions for this user still sitting at is_anomaly IS NULL
    (e.g. rows inserted before the anomaly model existed). Idempotent - safe
    to call repeatedly, only touches unscored rows."""
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    err = _check_owner(user_id)
    if err:
        return err

    from flask import current_app
    from ml.anomaly import score_transactions
    models = current_app.config.get("ML_MODELS", {})

    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM transactions WHERE user_id = ? AND is_anomaly IS NULL",
            (user_id,),
        ).fetchall()

        if not rows:
            return jsonify({"scored": 0, "flagged": 0}), 200

        inputs = [{"amount": r["amount"], "category": r["category"], "date": r["date"]} for r in rows]
        flags = score_transactions(inputs, models.get("anomaly_scaler"), models.get("anomaly_detector"))

        conn.executemany(
            "UPDATE transactions SET is_anomaly = ? WHERE id = ?",
            [(flag, r["id"]) for r, flag in zip(rows, flags)],
        )
        conn.commit()

        return jsonify({"scored": len(rows), "flagged": sum(flags)}), 200
    finally:
        conn.close()


@transactions_bp.route("/transactions/<int:tx_id>", methods=["DELETE"])
@require_auth
def delete_transaction(tx_id):
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM transactions WHERE id = ?", (tx_id,)
        ).fetchone()
        if not row:
            return jsonify({"error": "transaction not found"}), 404
        err = _check_owner(row["user_id"])
        if err:
            return err
        conn.execute("DELETE FROM transactions WHERE id = ?", (tx_id,))
        conn.commit()
        return jsonify({"deleted": tx_id}), 200
    finally:
        conn.close()


@transactions_bp.route("/transactions/<int:tx_id>", methods=["PATCH"])
@require_auth
def update_transaction_category(tx_id):
    """Lets a user correct a category the model got wrong. Not in the
    original spec's verb list, but needed for the categorization UI to be
    useful - restricted to just `category` so it can't be used to bypass
    other validation."""
    data = request.get_json(silent=True) or {}
    category = data.get("category")
    if category not in VALID_CATEGORIES:
        return jsonify({"error": f"invalid category '{category}'"}), 400

    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM transactions WHERE id = ?", (tx_id,)
        ).fetchone()
        if not row:
            return jsonify({"error": "transaction not found"}), 404
        err = _check_owner(row["user_id"])
        if err:
            return err
        conn.execute(
            "UPDATE transactions SET category = ? WHERE id = ?", (category, tx_id)
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM transactions WHERE id = ?", (tx_id,)
        ).fetchone()
        return jsonify(_tx_to_dict(row)), 200
    finally:
        conn.close()
