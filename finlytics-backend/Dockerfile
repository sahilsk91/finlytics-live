FROM python:3.11-slim

WORKDIR /app

# System deps for psycopg2 + pandas/numpy/scipy
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Train models if not present (synthetic fallback — fast)
RUN python ml/train_categorizer.py || echo "categorizer training skipped"
RUN python ml/train_anomaly_detector.py || echo "anomaly training skipped"

# DB init is deferred to runtime (so DATABASE_URL from env is available)
# But ensure the import path is valid
EXPOSE 5000

# Use gunicorn in production, 2 workers is enough for free-tier RAM
CMD ["sh", "-c", "python database.py && gunicorn app:app --bind 0.0.0.0:${PORT:-5000} --workers 2 --timeout 120 --access-logfile -"]
