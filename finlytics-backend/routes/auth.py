"""
routes/auth.py — JWT helpers for live auth.

Uses PyJWT (no Flask-JWT-Extended to keep deps light).
Password hashing uses Werkzeug (already in Flask).
"""

import os
import datetime
from functools import wraps

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import jwt
from flask import request, jsonify, current_app
from werkzeug.security import generate_password_hash, check_password_hash

JWT_ALGORITHM = "HS256"
JWT_EXPIRY_DAYS = 7

def _jwt_secret():
    return os.environ.get("JWT_SECRET", "dev-only-not-for-production-change-me-please")


def hash_password(plain: str) -> str:
    return generate_password_hash(plain)


def verify_password(pwhash: str, plain: str) -> bool:
    if not pwhash:
        return False
    return check_password_hash(pwhash, plain)


def generate_token(user_id: int, email: str) -> str:
    now = datetime.datetime.utcnow()
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": now,
        "exp": now + datetime.timedelta(days=JWT_EXPIRY_DAYS),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def verify_token(token: str):
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_token_from_header():
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[len("Bearer "):].strip()
    return None


def require_auth(f):
    """Decorator: require valid JWT. Sets request.user_id / request.user_email.
    If no token and the request is from local dev without DATABASE_URL postgres,
    we allow it for backwards compat? No — enforce always in production.
    For easier local testing, we allow missing token only if env ALLOW_ANON=1
    (not set by default)."""
    @wraps(f)
    def decorated(*args, **kwargs):
        # Allow health check without auth
        if request.path.endswith("/health"):
            return f(*args, **kwargs)

        allow_anon = os.environ.get("ALLOW_ANON", "").lower() in ("1", "true", "yes")
        token = get_token_from_header()

        if not token:
            if allow_anon:
                return f(*args, **kwargs)
            return jsonify({"error": "authentication required — send Authorization: Bearer <token>"}), 401

        payload = verify_token(token)
        if not payload:
            return jsonify({"error": "invalid or expired token — please log in again"}), 401

        request.user_id = int(payload["sub"])
        request.user_email = payload.get("email")
        return f(*args, **kwargs)
    return decorated


def optional_auth(f):
    """Like require_auth but doesn't fail if no token — just sets request.user_id if present."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_token_from_header()
        if token:
            payload = verify_token(token)
            if payload:
                request.user_id = int(payload["sub"])
                request.user_email = payload.get("email")
            else:
                request.user_id = None
        else:
            request.user_id = None
        return f(*args, **kwargs)
    return decorated
