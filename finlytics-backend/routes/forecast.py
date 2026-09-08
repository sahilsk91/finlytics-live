"""
routes/forecast.py

GET /forecast?user_id= -> next month's predicted spend + confidence range,
built from the user's own monthly spending history via ARIMA.
"""

from flask import Blueprint, request, jsonify

from database import get_db
from ml.forecast import forecast_next_month, monthly_totals_from_transactions, MIN_MONTHS_REQUIRED
from routes.auth import require_auth

forecast_bp = Blueprint("forecast", __name__)


@forecast_bp.route("/forecast", methods=["GET"])
@require_auth
def get_forecast():
    user_id = request.args.get("user_id", type=int)
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    uid = getattr(request, "user_id", None)
    if uid is not None and int(user_id) != int(uid):
        return jsonify({"error": "forbidden — you can only access your own forecast"}), 403

    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT date, amount FROM transactions WHERE user_id = ? ORDER BY date",
            (user_id,),
        ).fetchall()
    finally:
        conn.close()

    transactions = [{"date": r["date"], "amount": r["amount"]} for r in rows]
    monthly = monthly_totals_from_transactions(transactions)

    if len(monthly) < MIN_MONTHS_REQUIRED:
        return jsonify({
            "available": False,
            "reason": f"Need at least {MIN_MONTHS_REQUIRED} months of spending history "
                      f"to forecast (have {len(monthly)}).",
            "history": [{"month": m, "total": t} for m, t in monthly],
        }), 200

    result = forecast_next_month(monthly)

    last_month = monthly[-1][0]
    next_month_label = _next_month_label(last_month)

    return jsonify({
        "available": True,
        "history": [{"month": m, "total": t} for m, t in monthly],
        "forecast": {
            "month": next_month_label,
            "predicted": result["predicted"],
            "lower": result["lower"],
            "upper": result["upper"],
        },
    }), 200


def _next_month_label(month_str):
    """month_str like '2026-08' -> '2026-09'."""
    import pandas as pd
    period = pd.Period(month_str, freq="M") + 1
    return str(period)
