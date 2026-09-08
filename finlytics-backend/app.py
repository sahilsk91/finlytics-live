"""
app.py — Finlytics Flask entrypoint, production-ready.

- Loads .env (DATABASE_URL, JWT_SECRET, FRONTEND_URL, etc.)
- Dual DB: Postgres (production) via DATABASE_URL or SQLite fallback
- Live auth: password + JWT (see routes/users.py, routes/auth.py)
- CORS locked to FRONTEND_URL in prod, open in dev
- ML models loaded once at startup
"""

import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from flask import Flask, jsonify
from flask_cors import CORS

from database import init_db, DB_PATH, _get_database_url, _is_postgres
from routes.users import users_bp
from routes.transactions import transactions_bp
from routes.uploads import uploads_bp
from routes.forecast import forecast_bp

SAVED_MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ml", "saved_models")


def load_ml_models():
    """Load trained models from ml/saved_models into memory once."""
    models = {}
    try:
        import joblib
        for fname, key in [
            ("categorizer.joblib", "categorizer"),
            ("vectorizer.joblib", "vectorizer"),
            ("anomaly_detector.joblib", "anomaly_detector"),
            ("anomaly_scaler.joblib", "anomaly_scaler"),
        ]:
            path = os.path.join(SAVED_MODELS_DIR, fname)
            if os.path.exists(path):
                models[key] = joblib.load(path)
    except Exception as e:
        print(f"Warning: ML model load failed: {e}")
    return models


def create_app():
    app = Flask(__name__)

    # --- CORS: lock to frontend in production ---
    frontend_url = os.environ.get("FRONTEND_URL", "").strip()
    # Allow multiple origins (comma-separated)
    allowed_origins = [o.strip() for o in frontend_url.split(",") if o.strip()] if frontend_url else ["*"]
    if allowed_origins == ["*"]:
        CORS(app)
    else:
        CORS(app, origins=allowed_origins, supports_credentials=True,
             allow_headers=["Content-Type", "Authorization"],
             methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"])

    # Validate critical env in production
    is_prod = os.environ.get("FLASK_ENV") == "production" or _is_postgres()
    if is_prod and os.environ.get("JWT_SECRET", "").strip() in ("", "dev-only-not-for-production-change-me-please"):
        print("WARNING: JWT_SECRET is not set or is still the dev default — set a strong random value via env var!")

    init_db()
    app.config["ML_MODELS"] = load_ml_models()
    app.config["JWT_SECRET"] = os.environ.get("JWT_SECRET", "dev-only-not-for-production-change-me-please")

    app.register_blueprint(users_bp, url_prefix="/api")
    app.register_blueprint(transactions_bp, url_prefix="/api")
    app.register_blueprint(uploads_bp, url_prefix="/api")
    app.register_blueprint(forecast_bp, url_prefix="/api")

    @app.route("/api/health", methods=["GET"])
    def health():
        db_url = _get_database_url()
        return jsonify({
            "status": "ok",
            "db": "postgres" if _is_postgres() else "sqlite",
            "db_path": DB_PATH if not _is_postgres() else db_url[:22] + "...",
            "models_loaded": list(app.config["ML_MODELS"].keys()),
        }), 200

    @app.route("/", methods=["GET"])
    def root():
        return jsonify({"name": "Finlytics API", "health": "/api/health"}), 200

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "not found"}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "internal server error"}), 500

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_ENV") != "production"
    app.run(host="0.0.0.0", port=port, debug=debug)
