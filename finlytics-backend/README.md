# Finlytics

ML-powered personal finance tracker. Auto-categorizes transactions (Random
Forest), flags unusual spending (Isolation Forest), and forecasts next
month's spend (ARIMA).

## Data source note

The spec called for two Kaggle datasets (Indian Banking Transaction Text,
PaySim). This sandbox can't reach kaggle.com — only package registries are
network-allowed — so both ML models train on **synthetic data instead**,
generated to match each dataset's shape:

- **Categorizer** (`ml/train_categorizer.py`): realistic Indian bank/UPI
  statement strings (Swiggy, Uber, Airtel, Amazon, etc.) wrapped in the
  noise real statements carry (UPI handles, POS codes, NEFT references).
  97.3% test accuracy.
- **Anomaly detector** (`ml/train_anomaly_detector.py`): category-typical
  spend distributions with ~3% injected outliers. PaySim's own schema
  (mobile-money transfers) doesn't map onto what this app can score at
  runtime — amount, category, day-of-week — so the synthetic set is shaped
  around Finlytics' actual transaction fields instead.

Drop real data at `ml/data/real_categorized_transactions.csv`
(`description,category` columns) or `ml/data/real_paysim.csv` and the
training scripts will pick it up — see the comments at the top of each for
exactly what's expected.

## Setup

### Backend

```bash
cd finlytics-backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

python3 database.py             # creates finlytics.db + seeds demo@finlytics.app
python3 ml/train_categorizer.py       # trains + saves the Random Forest (~10s)
python3 ml/train_anomaly_detector.py  # trains + saves the Isolation Forest (~5s)

python3 app.py                  # http://localhost:5000
```

### Frontend

```bash
cd finlytics-frontend
npm install
npm run dev                     # http://localhost:5173
```

Log in with `demo@finlytics.app`, or use "Create account" for a fresh one.

## What's implemented

- **Auth**: look-up-or-create by email (no passwords — single-tenant demo tracker)
- **Manual transaction entry**, scored for anomalies immediately on insert
- **CSV import**: flexible column detection (handles `Narration`/`Particulars`,
  `Withdrawal Amt`/`Deposit Amt` bank-export conventions), sha256 dedupe,
  per-row validation with graceful skipping, batch categorization + anomaly scoring
- **Dashboard**: stat cards, flagged-transactions alert section, category
  donut chart, monthly spending trend with forecast overlay, filterable
  transaction table (category / search / flagged-only)
- **Insights**: category breakdown
- **Forecast**: ARIMA-based next-month prediction with an 80% confidence
  range, requires ≥3 months of history (returns a clear "not enough data
  yet" state otherwise)

## API reference

| Method | Path | Notes |
|---|---|---|
| POST | `/api/users` | create (or return existing) user by email |
| POST | `/api/users/login` | look up by email, 404 if not found |
| GET | `/api/users/:id` | |
| GET | `/api/transactions?user_id=&category=&is_anomaly=&start_date=&end_date=&limit=` | |
| POST | `/api/transactions` | manual add, scored for anomalies on insert |
| PATCH | `/api/transactions/:id` | correct category |
| DELETE | `/api/transactions/:id` | |
| POST | `/api/transactions/score-anomalies` | backfill-score any unscored rows for a user |
| GET | `/api/uploads?user_id=` | import history |
| POST | `/api/uploads` | multipart CSV upload (`user_id`, `file` form fields) |
| GET | `/api/forecast?user_id=` | next month's predicted spend |
| GET | `/api/health` | confirms DB + loaded models |

## Known limitations / judgment calls

- Amount is signed integer paise end-to-end (API included, not just the
  DB) — positive = spend, negative = credit/refund. Frontend divides by
  100 only for display.
- ARIMA order is picked heuristically based on how many months of history
  exist (`ml/forecast.py::_pick_order`) since personal finance histories
  are usually much shorter than ARIMA is typically tuned for.
- The anomaly model flags on amount-for-category + day-of-week only — it
  won't catch things like unusual merchant/description patterns, since
  the schema doesn't carry a stable merchant ID to build frequency
  features from.
- No real auth/password — acceptable for a personal single-tenant tracker,
  not for anything multi-user or exposed publicly.
