"""
ml/train_anomaly_detector.py

Trains an Isolation Forest to flag unusual transactions.

NOTE ON DATA SOURCE
--------------------
The spec asks for the PaySim Synthetic Financial Dataset from Kaggle. Two
problems with using it directly here: (1) kaggle.com isn't reachable from
this sandbox (same restriction as Phase 3), and (2) PaySim's shape (mobile-
money P2P transfers: type/oldbalanceOrg/newbalanceOrig/isFraud) doesn't
actually match what we can score a Finlytics transaction on at runtime -
we only ever have amount, category, and date. Scoring against a model
trained on PaySim's feature set would require fields this app doesn't
collect.

So instead this script generates a synthetic dataset shaped like actual
Finlytics transactions: amount (category-typical distributions, since
₹50,000 is normal for Bills but wildly unusual for Food), category, and
day-of-week - then injects ~3% true outliers (extreme amounts, or a
category/amount combination that never happens normally) so there's a
labelled sanity check for the report even though Isolation Forest itself
trains unsupervised. If you have the real PaySim CSV, drop it at
ml/data/real_paysim.csv - you'll need to adapt the feature columns in
ml/anomaly.py to match, since its schema doesn't map onto ours 1:1.

Run: python3 ml/train_anomaly_detector.py
Output: ml/saved_models/anomaly_detector.joblib, ml/saved_models/anomaly_scaler.joblib
"""

import os
import random

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report

random.seed(7)
np.random.seed(7)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAVED_MODELS_DIR = os.path.join(BASE_DIR, "saved_models")

# Order matters - this is the fixed category -> index mapping used at
# both train and inference time. Keep in sync with ml/anomaly.py.
CATEGORIES = [
    "Food", "Travel", "Bills", "Shopping",
    "Entertainment", "Health", "Other", "Uncategorized",
]
CATEGORY_TO_INDEX = {c: i for i, c in enumerate(CATEGORIES)}

# Typical spend (in rupees) per category, as (lognormal mean, sigma).
# These drive what "normal" looks like per category so the model can tell
# a ₹40,000 restaurant bill apart from a ₹40,000 rent payment.
CATEGORY_PROFILES = {
    "Food": (6.0, 0.6),          # ~ exp(6.0) ≈ ₹400 median
    "Travel": (6.5, 0.8),        # ~ ₹665
    "Bills": (7.5, 0.7),         # ~ ₹1800
    "Shopping": (7.0, 1.0),      # ~ ₹1100, high variance
    "Entertainment": (6.2, 0.6), # ~ ₹490
    "Health": (6.5, 0.9),        # ~ ₹665
    "Other": (6.8, 1.1),         # ~ ₹900, high variance
    "Uncategorized": (6.8, 1.0),
}


def generate_synthetic_dataset(n_per_category=600, anomaly_rate=0.03):
    rows = []
    for category, (mu, sigma) in CATEGORY_PROFILES.items():
        n = n_per_category
        n_anomalies = max(1, int(n * anomaly_rate))
        n_normal = n - n_anomalies

        # Normal transactions: lognormal around the category's typical spend
        normal_amounts = np.random.lognormal(mean=mu, sigma=sigma, size=n_normal)
        for amt in normal_amounts:
            rows.append({
                "amount": round(amt, 2),
                "category": category,
                "day_of_week": random.randint(0, 6),
                "is_synthetic_anomaly": 0,
            })

        # Injected anomalies: 8-25x the category's typical spend - the kind
        # of thing that should actually get flagged (a ₹15,000 "Food" charge).
        anomaly_amounts = np.random.lognormal(mean=mu, sigma=sigma, size=n_anomalies) * np.random.uniform(8, 25, n_anomalies)
        for amt in anomaly_amounts:
            rows.append({
                "amount": round(amt, 2),
                "category": category,
                "day_of_week": random.randint(0, 6),
                "is_synthetic_anomaly": 1,
            })

    df = pd.DataFrame(rows)
    return df.sample(frac=1, random_state=7).reset_index(drop=True)


def train():
    os.makedirs(SAVED_MODELS_DIR, exist_ok=True)

    df = generate_synthetic_dataset()
    df["category_idx"] = df["category"].map(CATEGORY_TO_INDEX)

    features = df[["amount", "category_idx", "day_of_week"]].values

    scaler = StandardScaler()
    features_scaled = scaler.fit_transform(features)

    model = IsolationForest(
        n_estimators=200,
        contamination=0.03,
        random_state=7,
        n_jobs=-1,
    )
    model.fit(features_scaled)

    # -1 = anomaly, 1 = normal (sklearn convention) -> remap to 1/0
    raw_preds = model.predict(features_scaled)
    preds = np.where(raw_preds == -1, 1, 0)

    print("\nSanity check against injected outliers (not real fraud labels,")
    print("just a way to confirm the model finds the outliers we planted):\n")
    print(classification_report(df["is_synthetic_anomaly"], preds, digits=3))

    joblib.dump(model, os.path.join(SAVED_MODELS_DIR, "anomaly_detector.joblib"))
    joblib.dump(scaler, os.path.join(SAVED_MODELS_DIR, "anomaly_scaler.joblib"))
    print(f"Saved model + scaler to {SAVED_MODELS_DIR}")


if __name__ == "__main__":
    train()
