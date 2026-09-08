"""
ml/categorize.py

Inference-only helpers for the transaction categorizer. Kept separate from
train_categorizer.py so routes can import a light module without pulling in
training-only code paths.
"""

import re

VALID_CATEGORIES = {
    "Uncategorized", "Food", "Travel", "Bills",
    "Shopping", "Entertainment", "Health", "Other",
}


def clean_text(text):
    """Must exactly match the preprocessing used in train_categorizer.py -
    the vectorizer was fit on text cleaned this way."""
    text = str(text).upper()
    text = re.sub(r"\d+", " NUM ", text)
    text = re.sub(r"[^A-Z@\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def categorize_descriptions(descriptions, vectorizer, model):
    """Batch-categorize a list of raw description strings.
    Returns a list of category labels, same order/length as input.
    If either model piece is missing, falls back to 'Uncategorized' for all -
    lets the upload flow degrade gracefully instead of hard-failing."""
    if vectorizer is None or model is None:
        return ["Uncategorized"] * len(descriptions)

    cleaned = [clean_text(d) for d in descriptions]
    X = vectorizer.transform(cleaned)
    preds = model.predict(X)
    return [p if p in VALID_CATEGORIES else "Other" for p in preds]
