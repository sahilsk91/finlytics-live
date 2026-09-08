"""
routes/users.py — Live auth with password hashing + JWT.

- POST /users        → signup (or idempotent login if email exists + password matches)
- POST /users/login  → login with email + password, returns {user, token}
- GET  /users/me     → current user from token (requires Authorization header)
- GET  /users/:id    → fetch user by id (requires token and id == token user)
"""

from flask import Blueprint, request, jsonify
from database import get_db
from routes.auth import hash_password, verify_password, generate_token, require_auth

users_bp = Blueprint("users", __name__)


def _user_to_dict(row):
    # row may be sqlite Row or dict (RealDictRow)
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "created_at": str(row["created_at"]) if row["created_at"] else None,
    }


def _get_ph(row):
    try:
        return row["password_hash"]
    except Exception:
        try:
            return row.get("password_hash")
        except Exception:
            return None


def _user_response(row, token=None, status=200):
    data = _user_to_dict(row)
    if token:
        data["token"] = token
    return jsonify(data), status


@users_bp.route("/users", methods=["POST"])
def create_user():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email:
        return jsonify({"error": "name and email are required"}), 400
    if "@" not in email:
        return jsonify({"error": "email looks invalid"}), 400
    if not password:
        return jsonify({"error": "password is required (min 6 characters)"}), 400
    if len(password) < 6:
        return jsonify({"error": "password must be at least 6 characters"}), 400

    conn = get_db()
    try:
        existing = conn.execute(
            "SELECT * FROM users WHERE email = ?", (email,)
        ).fetchone()
        if existing:
            ph = _get_ph(existing)

            if ph is None:
                # First time setting a password for this legacy email
                new_hash = hash_password(password)
                # Update name if provided and password
                conn.execute(
                    "UPDATE users SET password_hash = ?, name = ? WHERE id = ?",
                    (new_hash, name, existing["id"]),
                )
                conn.commit()
                row = conn.execute("SELECT * FROM users WHERE id = ?", (existing["id"],)).fetchone()
                token = generate_token(row["id"], row["email"])
                return _user_response(row, token, 200)

            # Existing account with password — check it
            if not verify_password(ph, password):
                return jsonify({"error": "an account with this email already exists — try logging in instead"}), 409
            # Password matches — treat as idempotent login
            token = generate_token(existing["id"], existing["email"])
            return _user_response(existing, token, 200)

        # New user
        pwhash = hash_password(password)
        cur = conn.execute(
            "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)", (name, email, pwhash)
        )
        conn.commit()
        # cur.lastrowid works for both SQLite and our Postgres wrapper
        new_id = cur.lastrowid
        # Fallback for edge: if wrapper didn't capture id, fetch by email
        if not new_id:
            row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        else:
            row = conn.execute("SELECT * FROM users WHERE id = ?", (new_id,)).fetchone()
        token = generate_token(row["id"], row["email"])
        return _user_response(row, token, 201)
    finally:
        conn.close()


@users_bp.route("/users/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email:
        return jsonify({"error": "email is required"}), 400
    if not password:
        return jsonify({"error": "password is required"}), 400

    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if not row:
            return jsonify({"error": "no account with that email — please create an account first"}), 404

        ph = _get_ph(row)

        # Legacy account with no password yet — set it now and log in (one-time migration)
        if ph is None:
            new_hash = hash_password(password)
            conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, row["id"]))
            conn.commit()
            row = conn.execute("SELECT * FROM users WHERE id = ?", (row["id"],)).fetchone()
            token = generate_token(row["id"], row["email"])
            return _user_response(row, token, 200)

        if not verify_password(ph, password):
            return jsonify({"error": "incorrect password"}), 401

        token = generate_token(row["id"], row["email"])
        return _user_response(row, token, 200)
    finally:
        conn.close()


@users_bp.route("/users/me", methods=["GET"])
@require_auth
def me():
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (request.user_id,)).fetchone()
        if not row:
            return jsonify({"error": "user not found"}), 404
        return jsonify(_user_to_dict(row)), 200
    finally:
        conn.close()


@users_bp.route("/users/<int:user_id>", methods=["GET"])
@require_auth
def get_user(user_id):
    # Users can only fetch their own record (unless you add admin later)
    if request.user_id != user_id:
        return jsonify({"error": "forbidden — you can only access your own account"}), 403
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            return jsonify({"error": "user not found"}), 404
        return jsonify(_user_to_dict(row)), 200
    finally:
        conn.close()
