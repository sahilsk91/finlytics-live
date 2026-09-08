"""
routes/admin.py — Admin stats: see all users, their emails, and their data.
Requires JWT. For now any logged-in user can view it (single-tenant demo).
If you want to lock it, check request.user_email against an allowlist.
"""

from flask import Blueprint, request, jsonify
from database import get_db
from routes.auth import require_auth

admin_bp = Blueprint("admin", __name__)


@admin_bp.route("/admin/overview", methods=["GET"])
@require_auth
def overview():
    conn = get_db()
    try:
        users = conn.execute("SELECT id, name, email, created_at FROM users ORDER BY id").fetchall()
        result_users = []
        total_tx = 0
        total_uploads = 0
        total_spent_all = 0

        for u in users:
            uid = u["id"]
            tx_row = conn.execute("SELECT COUNT(*) as c, COALESCE(SUM(amount),0) as s FROM transactions WHERE user_id = ?", (uid,)).fetchone()
            up_row = conn.execute("SELECT COUNT(*) as c FROM uploads WHERE user_id = ?", (uid,)).fetchone()
            # last transaction date
            last_tx = conn.execute("SELECT date FROM transactions WHERE user_id = ? ORDER BY date DESC LIMIT 1", (uid,)).fetchone()
            # category breakdown top 2
            cats = conn.execute("SELECT category, COUNT(*) as c FROM transactions WHERE user_id = ? GROUP BY category ORDER BY c DESC LIMIT 3", (uid,)).fetchall()

            tx_c = tx_row["c"] if tx_row else 0
            up_c = up_row["c"] if up_row else 0
            spent = tx_row["s"] if tx_row and tx_row["s"] else 0

            total_tx += tx_c
            total_uploads += up_c
            total_spent_all += spent if spent > 0 else 0

            result_users.append({
                "id": u["id"],
                "name": u["name"],
                "email": u["email"],
                "created_at": str(u["created_at"]),
                "tx_count": tx_c,
                "upload_count": up_c,
                "total_spent_paise": spent,
                "last_tx_date": last_tx["date"] if last_tx else None,
                "top_categories": [{"category": r["category"], "count": r["c"]} for r in cats] if cats else [],
            })

        return jsonify({
            "total_users": len(users),
            "total_transactions": total_tx,
            "total_uploads": total_uploads,
            "total_spent_paise": total_spent_all,
            "users": result_users,
        }), 200
    finally:
        conn.close()


@admin_bp.route("/admin/users/<int:user_id>/transactions", methods=["GET"])
@require_auth
def user_transactions(user_id):
    conn = get_db()
    try:
        u = conn.execute("SELECT id, name, email FROM users WHERE id = ?", (user_id,)).fetchone()
        if not u:
            return jsonify({"error": "user not found"}), 404
        txs = conn.execute("SELECT id, date, description, amount, category, is_anomaly, created_at FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 200", (user_id,)).fetchall()
        ups = conn.execute("SELECT id, filename, file_hash, uploaded_at, rows_in_file, rows_imported, status FROM uploads WHERE user_id = ? ORDER BY uploaded_at DESC", (user_id,)).fetchall()
        return jsonify({
            "user": {"id": u["id"], "name": u["name"], "email": u["email"]},
            "transactions": [dict(r) if isinstance(r, dict) else {k: r[k] for k in r.keys()} for r in txs],
            "uploads": [dict(r) if isinstance(r, dict) else {k: r[k] for k in r.keys()} for r in ups],
        }), 200
    finally:
        conn.close()
