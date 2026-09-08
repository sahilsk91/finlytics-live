"""
ml/anomaly.py

Inference-only helpers for the Isolation Forest anomaly detector. Feature
order/encoding here MUST match ml/train_anomaly_detector.py exactly.
"""

import numpy as np

CATEGORIES = [
    "Food", "Travel", "Bills", "Shopping",
    "Entertainment", "Health", "Other", "Uncategorized",
]
CATEGORY_TO_INDEX = {c: i for i, c in enumerate(CATEGORIES)}


def _day_of_week(date_str):
    """date_str is 'YYYY-MM-DD'. Returns 0 (Monday) - 6 (Sunday)."""
    from datetime import datetime
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").weekday()
    except (ValueError, TypeError):
        return 0


def score_transactions(rows, scaler, model):
    """
    rows: list of dicts, each with at least 'amount' (int, paise),
          'category' (str), 'date' (str, 'YYYY-MM-DD').
    scaler, model: loaded from ml/saved_models/.

    Returns a list of ints (0 or 1), same order as `rows`, where 1 means
    "flagged as unusual". If model/scaler aren't loaded, returns all 0s
    (nothing flagged) rather than raising - upload/insert should still
    succeed even if the anomaly model hasn't been trained yet.
    """
    if scaler is None or model is None:
        return [0] * len(rows)

    features = []
    for r in rows:
        amount_rupees = abs(r["amount"]) / 100  # magnitude only - direction isn't "unusualness"
        category_idx = CATEGORY_TO_INDEX.get(r["category"], CATEGORY_TO_INDEX["Uncategorized"])
        dow = _day_of_week(r["date"])
        features.append([amount_rupees, category_idx, dow])

    features = np.array(features)
    features_scaled = scaler.transform(features)
    raw_preds = model.predict(features_scaled)  # -1 = anomaly, 1 = normal
    return [1 if p == -1 else 0 for p in raw_preds]
