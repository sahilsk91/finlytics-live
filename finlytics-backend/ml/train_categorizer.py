"""
ml/train_categorizer.py

Trains a Random Forest classifier to auto-categorize bank transaction
descriptions into: Food, Travel, Bills, Shopping, Entertainment, Health, Other.

NOTE ON DATA SOURCE
--------------------
The spec asks for the "Indian Banking Transaction Text Dataset" from Kaggle.
This sandbox has no network access to kaggle.com (only package registries
are reachable), so that dataset can't be downloaded here. Instead, this
script generates a synthetic dataset with the same shape (realistic Indian
bank-statement-style description strings + a category label), built from
merchant name banks per category, combined with the messy prefixes/suffixes
real UPI and card statement lines actually have (UPI handles, POS codes,
reference numbers, truncated merchant names). If you have the real Kaggle
CSV, drop it at ml/data/real_categorized_transactions.csv with columns
`description,category` and this script will use it instead automatically.

Run: python3 ml/train_categorizer.py
Output: ml/saved_models/categorizer.joblib, ml/saved_models/vectorizer.joblib
"""

import os
import random
import re

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from sklearn.pipeline import Pipeline

random.seed(42)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAVED_MODELS_DIR = os.path.join(BASE_DIR, "saved_models")
REAL_DATA_PATH = os.path.join(BASE_DIR, "data", "real_categorized_transactions.csv")

# ---------------------------------------------------------------------------
# Merchant / description banks per category. These mirror the vocabulary you
# actually see on Indian bank/UPI statements.
# ---------------------------------------------------------------------------
MERCHANTS = {
    "Food": [
        "SWIGGY", "ZOMATO", "ZOMATO ORDER", "SWIGGY INSTAMART", "BIGBASKET",
        "MCDONALDS INDIA", "DOMINOS PIZZA", "KFC", "BURGER KING", "STARBUCKS",
        "CAFE COFFEE DAY", "BLINKIT", "DUNZO", "HALDIRAMS", "SUBWAY",
        "PIZZA HUT", "BARBEQUE NATION", "FRESHMENU", "ZEPTO", "MORE SUPERMARKET",
        "DMART", "NATURES BASKET", "WOW MOMO", "CHAAYOS", "THIRD WAVE COFFEE",
    ],
    "Travel": [
        "UBER", "OLA CABS", "OLA", "IRCTC", "MAKEMYTRIP", "INDIGO AIRLINES",
        "GOIBIBO", "REDBUS", "RAPIDO", "IRCTC TATKAL", "YATRA", "SPICEJET",
        "BPCL PETROL PUMP", "HP PETROL PUMP", "INDIAN OIL", "METRO RECHARGE",
        "FASTAG RECHARGE", "OYO ROOMS", "AIRBNB", "VISTARA AIRLINES", "OLA AUTO",
        "DELHI METRO", "MUMBAI METRO", "PARKING FEE",
    ],
    "Bills": [
        "AIRTEL POSTPAID", "JIO RECHARGE", "VODAFONE IDEA", "TATA POWER",
        "BSES RAJDHANI", "ADANI ELECTRICITY", "MSEB BILL PAY", "LIC PREMIUM",
        "ACT FIBERNET", "HATHWAY BROADBAND", "AIRTEL BROADBAND", "DTH RECHARGE",
        "TATA SKY", "SOCIETY MAINTENANCE", "RENT PAYMENT NEFT", "GAS CYLINDER BOOKING",
        "INDANE GAS", "WATER BILL PAYMENT", "MUNICIPAL TAX", "HOME LOAN EMI",
        "CREDIT CARD BILL PAYMENT", "MOBILE POSTPAID BILL",
    ],
    "Shopping": [
        "AMAZON", "AMAZON PAY", "FLIPKART", "MYNTRA", "AJIO", "RELIANCE TRENDS",
        "PANTALOONS", "LIFESTYLE STORES", "SHOPPERS STOP", "NYKAA",
        "CROMA ELECTRONICS", "RELIANCE DIGITAL", "IKEA", "DECATHLON",
        "H AND M", "ZARA", "TATA CLIQ", "MEESHO", "FIRSTCRY", "LENSKART",
        "URBAN LADDER", "PEPPERFRY",
    ],
    "Entertainment": [
        "NETFLIX", "AMAZON PRIME VIDEO", "HOTSTAR", "SPOTIFY", "BOOKMYSHOW",
        "PVR CINEMAS", "INOX", "SONY LIV", "ZEE5", "YOUTUBE PREMIUM",
        "GAANA", "JIOSAAVN", "STEAM GAMES", "PLAYSTATION STORE", "GAMING ZONE",
        "ADVENTURE PARK TICKETS", "CONCERT TICKETS", "APPLE MUSIC",
    ],
    "Health": [
        "APOLLO PHARMACY", "MEDPLUS", "PRACTO", "FORTIS HOSPITAL",
        "MAX HEALTHCARE", "1MG", "NETMEDS", "CULT FIT", "GOLDS GYM",
        "ANYTIME FITNESS", "DIAGNOSTIC LAB", "DR LAL PATHLABS", "PHARMEASY",
        "MANIPAL HOSPITALS", "AIIMS OPD", "DENTAL CLINIC", "HEALTH INSURANCE PREMIUM",
    ],
    "Other": [
        "ATM WITHDRAWAL", "CASH WITHDRAWAL", "NEFT TRANSFER", "IMPS TRANSFER",
        "UPI TRANSFER", "BANK CHARGES", "ANNUAL MAINTENANCE FEE", "CHEQUE DEPOSIT",
        "FUND TRANSFER TO SAVINGS", "MISC PAYMENT", "DONATION", "TEMPLE DONATION",
        "SALARY CREDIT", "REFUND CREDIT", "GIFT CARD PURCHASE", "PETTY CASH",
    ],
}

UPI_HANDLES = ["okaxis", "oksbi", "okhdfcbank", "ybl", "ibl", "paytm", "okicici"]


def _noisy_description(merchant):
    """Wrap a clean merchant name in the kind of noise real bank statement
    lines carry, so the model learns to generalize past exact string match."""
    style = random.choice(["upi", "pos", "neft", "plain", "app"])
    ref = "".join(random.choices("0123456789", k=random.randint(6, 12)))

    if style == "upi":
        handle = random.choice(UPI_HANDLES)
        user_id = "".join(random.choices("0123456789", k=10))
        return f"UPI-{merchant.replace(' ', '')}-{user_id}@{handle}-{ref}"
    if style == "pos":
        card_suffix = "".join(random.choices("0123456789", k=4))
        return f"POS 41XXXXXXXXXX{card_suffix} {merchant}"
    if style == "neft":
        return f"NEFT-{ref}-{merchant.replace(' ', '')}"
    if style == "app":
        return f"{merchant} ORDER #{ref}"
    return f"{merchant} {ref}"


def generate_synthetic_dataset(n_per_category=400):
    rows = []
    for category, merchants in MERCHANTS.items():
        for _ in range(n_per_category):
            merchant = random.choice(merchants)
            desc = _noisy_description(merchant)
            rows.append({"description": desc, "category": category})
    df = pd.DataFrame(rows)
    return df.sample(frac=1, random_state=42).reset_index(drop=True)


def load_dataset():
    if os.path.exists(REAL_DATA_PATH):
        print(f"Found real dataset at {REAL_DATA_PATH}, using it instead of synthetic data.")
        df = pd.read_csv(REAL_DATA_PATH)
        return df[["description", "category"]].dropna()

    print("No Kaggle dataset found locally (and kaggle.com isn't reachable from "
          "this sandbox) - generating a synthetic substitute with realistic "
          "Indian bank-statement-style descriptions instead.")
    return generate_synthetic_dataset()


def clean_text(text):
    text = str(text).upper()
    text = re.sub(r"\d+", " NUM ", text)  # collapse reference numbers/card digits
    text = re.sub(r"[^A-Z@\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def train():
    os.makedirs(SAVED_MODELS_DIR, exist_ok=True)

    df = load_dataset()
    df["clean_description"] = df["description"].apply(clean_text)

    X_train, X_test, y_train, y_test = train_test_split(
        df["clean_description"], df["category"],
        test_size=0.2, random_state=42, stratify=df["category"],
    )

    vectorizer = TfidfVectorizer(
        analyzer="word",
        ngram_range=(1, 2),
        min_df=2,
        max_features=3000,
    )
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)

    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=None,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train_vec, y_train)

    preds = model.predict(X_test_vec)
    acc = accuracy_score(y_test, preds)
    print(f"\nTest accuracy: {acc:.4f}\n")
    print(classification_report(y_test, preds))

    joblib.dump(model, os.path.join(SAVED_MODELS_DIR, "categorizer.joblib"))
    joblib.dump(vectorizer, os.path.join(SAVED_MODELS_DIR, "vectorizer.joblib"))
    print(f"\nSaved model + vectorizer to {SAVED_MODELS_DIR}")


if __name__ == "__main__":
    train()
