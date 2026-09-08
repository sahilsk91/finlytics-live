"""
ml/forecast.py

Forecasts next month's total spend from a user's historical monthly totals
using ARIMA (statsmodels). This is trained fresh per-request on that user's
own history rather than loaded from a saved artifact at startup - ARIMA
is fit to a specific time series, not a general model you train once and
reuse across users like the categorizer/anomaly detector.
"""

import warnings

import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA

MIN_MONTHS_REQUIRED = 3


def forecast_next_month(monthly_totals):
    """
    monthly_totals: list of (month_label, total_paise) tuples, sorted
                     chronologically, one entry per calendar month the user
                     has spending data for. total_paise should already be
                     spend-only (debits), not net of credits.

    Returns a dict:
      {
        "predicted": int (paise),
        "lower": int (paise),
        "upper": int (paise),
      }
    or None if there isn't enough history to fit a model (< MIN_MONTHS_REQUIRED
    months) - the caller is expected to handle that as "can't forecast yet".
    """
    if len(monthly_totals) < MIN_MONTHS_REQUIRED:
        return None

    values = np.array([total for _, total in monthly_totals], dtype=float)

    # Degenerate case: no variance at all (e.g. every month is exactly the
    # same, or all zero) - ARIMA can throw or produce a meaningless fit here.
    if np.std(values) == 0:
        flat = float(values[-1])
        return {"predicted": round(flat), "lower": round(flat), "upper": round(flat)}

    order = _pick_order(len(values))

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        try:
            model = ARIMA(values, order=order)
            fitted = model.fit()
            result = fitted.get_forecast(steps=1)
            predicted = float(result.predicted_mean[0])
            conf_int = result.conf_int(alpha=0.20)  # 80% confidence range
            lower, upper = float(conf_int[0][0]), float(conf_int[0][1])
        except Exception:
            # ARIMA can fail to converge on short/unusual series - fall back
            # to a simple moving-average estimate rather than erroring out.
            predicted = float(np.mean(values[-3:]))
            spread = float(np.std(values)) or predicted * 0.15
            lower, upper = predicted - spread, predicted + spread

    predicted = max(predicted, 0)
    lower = max(lower, 0)
    upper = max(upper, lower)

    return {
        "predicted": round(predicted),
        "lower": round(lower),
        "upper": round(upper),
    }


def _pick_order(n_months):
    """Sensible ARIMA(p,d,q) order given how little data we typically have -
    a personal finance tracker might only have 3-24 months of history, far
    less than ARIMA is usually tuned for. Judgment call: keep it simple
    (low order) to avoid overfitting a handful of monthly points."""
    if n_months < 6:
        return (1, 1, 0)
    if n_months < 12:
        return (1, 1, 1)
    return (2, 1, 1)


def monthly_totals_from_transactions(transactions):
    """
    transactions: list of dicts with 'date' ('YYYY-MM-DD') and 'amount' (paise).
    Only positive amounts (spend/debits) are summed - credits/refunds are
    excluded from "spending" for forecasting purposes.
    Returns [(month_label, total_paise), ...] sorted chronologically.
    """
    if not transactions:
        return []

    df = pd.DataFrame(transactions)
    df = df[df["amount"] > 0].copy()
    if df.empty:
        return []

    df["month"] = pd.to_datetime(df["date"]).dt.to_period("M")
    grouped = df.groupby("month")["amount"].sum().sort_index()
    return [(str(month), int(total)) for month, total in grouped.items()]
