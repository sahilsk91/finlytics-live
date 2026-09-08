# Finlytics — Go Live Guide

You asked for online DB migration + live auth + hosting. This is done. Below is the 10-minute path to get the site live on free tiers.

---

## 1) What changed (so you go live without data loss)

**Backend**
- `database.py` now auto-switches: SQLite locally, Postgres in production via `DATABASE_URL` (Neon / Supabase / Render). No code change when you switch.
- New column `users.password_hash`, auto-migrated on boot (`ALTER TABLE` if missing) for both SQLite and Postgres.
- Live auth: passwords hashed with Werkzeug, JWT (PyJWT, 7-day expiry) issued on signup/login, returned as `token`. All data routes now require `Authorization: Bearer <token>` and enforce ownership (`user_id` in query/body must match token). `ALLOW_ANON=1` keeps local dev without token if you need it.
- `app.py` loads `.env`, locks CORS to `FRONTEND_URL` in prod, warns if `JWT_SECRET` is still default.
- `requirements.txt` + `Dockerfile` + `docker-compose.yml` ready for Render/Railway/Fly.
- One-time migration script: `finlytics-backend/scripts/migrate_sqlite_to_postgres.py` copies your existing `finlytics.db` into Postgres by email/file_hash dedupe.

**Frontend**
- `src/lib/api.js` now injects `Authorization` header from `localStorage`, auto-clears on 401, handles FormData uploads.
- `src/context/AuthContext.jsx` persists `{user, token}` split across `finlytics_user` + `finlytics_token`.
- `src/pages/Login.jsx` now has a password field (min 6 chars), shows demo creds `demo@finlytics.app / demo1234` (migrated).

---

## 2) Pick your hosting

**Fastest free stack (recommended):**
- DB → Neon (https://neon.tech) free 0.5GB Postgres, no credit card.
- Backend → Render.com (free web service + Docker) or Railway.
- Frontend → Vercel (free, best for Vite) or Netlify.

You can also use the `render.yaml` at repo root to one-click deploy DB + backend + frontend on Render, but Vercel is faster for the frontend. The guide below uses Neon + Render + Vercel — swap easily if you prefer.

---

## 3) Step A — Create the online database (2 min)

1. Go to https://neon.tech → Sign in → **Create Project** → choose region closest to you → Create.
2. In the dashboard, **Connection string** → copy the `postgresql://...` URL (it ends with `?sslmode=require`).
3. Save it. You will paste it as `DATABASE_URL`.

No SQL to run. The backend creates tables on first boot (`init_db()`).

**Alternative free DBs:** Supabase (https://supabase.com) → New Project → Connect → Transaction pooler URL. Render Postgres (create via dashboard, copy External Connection String). Any `postgresql://` works.

---

## 4) Step B — Migrate your existing SQLite data (optional, 1 min)

If you already have data in `finlytics-backend/finlytics.db` and want it online:

```bash
cd finlytics-backend
pip install -r requirements.txt        # ensures psycopg2, dotenv
export DATABASE_URL='postgresql://USER:PASSWORD@ep-xxx.neon.tech/neondb?sslmode=require'
# or put it in .env as DATABASE_URL=...
python scripts/migrate_sqlite_to_postgres.py
```

Output tells you how many users/uploads/transactions were copied. Re-running is safe — it skips existing emails/file_hashes.

If you have no important local data, skip this. A fresh Postgres will just start empty and the `demo@finlytics.app` user will be seeded on first boot.

---

## 5) Step C — Deploy the backend (3 min) — Render example

### Option C1: Render (Docker, free)

1. Push this repo to GitHub (if not already).
2. In Render dashboard → **New** → **Blueprint** → connect the repo → it reads `render.yaml` at root.
   - It will create `finlytics-db` (Postgres), `finlytics-backend` (Docker web service), and a placeholder static frontend.
   - Set `JWT_SECRET` — click Generate (or `python3 -c "import secrets; print(secrets.token_hex(32))"` and paste).
   - For `DATABASE_URL` it auto-wires from `finlytics-db`; if you use Neon instead, override it with your Neon URL and delete the `fromDatabase` block.
3. Deploy. Wait ~3–5 min (Docker build installs pandas/sklearn). Check `https://YOUR_BACKEND.onrender.com/api/health` — should return `{"status":"ok","db":"postgres",...}`.

**If not using Blueprint:**
- New → Web Service → Connect repo → **Docker** runtime → Dockerfile path `finlytics-backend/Dockerfile` → context `finlytics-backend`.
- Env vars:
  ```
  DATABASE_URL=postgresql://... (Neon URL with ?sslmode=require)
  JWT_SECRET=<64 hex chars>
  FRONTEND_URL=https://YOUR_FRONTEND.vercel.app
  FLASK_ENV=production
  PORT=5000
  ```
- Deploy. Health check path: `/api/health`.

### Option C2: Railway / Fly
Same env vars. For Railway, set `DATABASE_URL` from Railway Postgres add-on or Neon external URL. For Fly, `fly launch --dockerfile finlytics-backend/Dockerfile` and `fly secrets set DATABASE_URL=... JWT_SECRET=... FRONTEND_URL=...`.

---

## 6) Step D — Deploy the frontend (2 min) — Vercel example

1. In Vercel → **Add New** → Project → import the same GitHub repo.
2. Set **Root Directory** to `finlytics-frontend`.
3. Build settings auto-detected (Vite). Env var:
   ```
   VITE_API_URL=https://YOUR_BACKEND.onrender.com/api
   ```
   (must be the backend URL + `/api`; no trailing slash after domain)
4. Deploy. Vercel gives you `https://your-app.vercel.app`. Open it, create an account, log in.
5. Go back to Render backend → Env vars → update `FRONTEND_URL` to that Vercel URL (comma-separated if you keep the Render static URL too) → redeploy backend so CORS allows the new origin.

**Netlify alternative:** same root + env var, publish dir `dist`, command `npm run build`.

---

## 7) Step E — Local production test (optional, before pushing)

Test the production path locally without deploying:

```bash
# Terminal 1 — backend with Postgres (docker)
docker compose up db            # start a local Postgres on 5432
# in another shell:
export DATABASE_URL='postgresql://finlytics:finlytics@localhost:5432/finlytics?sslmode=disable'
export JWT_SECRET='local-test-secret-please-change'
export FRONTEND_URL='http://localhost:5173'
export FLASK_ENV=production
cd finlytics-backend
pip install -r requirements.txt
python database.py               # creates tables in Postgres
python app.py                    # http://localhost:5000/api/health should say "postgres"

# Terminal 2 — frontend
cd finlytics-frontend
echo 'VITE_API_URL=http://localhost:5000/api' > .env
npm install
npm run dev                      # http://localhost:5173
# Create account with email+password, upload CSV, check JWT flow
```

Or `docker compose up --build` to run everything containerized.

---

## 8) Auth notes (live)

- **Signup:** `POST /api/users` now requires `name, email, password` (≥6 chars). Returns `{id, name, email, token}`. If the email already exists but password matches, it returns the existing user + new token (idempotent).
- **Login:** `POST /api/users/login` requires `email, password`. Returns token. Legacy accounts with no `password_hash` get migrated on first login/signup with a password.
- **Protected routes:** `GET /api/transactions?user_id=`, `POST /api/transactions`, `GET /api/uploads?user_id=`, `POST /api/uploads`, `GET /api/forecast?user_id=` all now require `Authorization: Bearer <token>` and reject if `user_id` != token's `sub`. Frontend handles this automatically.
- **Demo account:** `demo@finlytics.app / demo1234` is seeded on first DB init (both SQLite and Postgres). Change its password via normal signup flow if you want.
- **JWT_SECRET:** set a long random hex in production. Rotating it logs everyone out (tokens invalidated). Generate: `python3 -c "import secrets; print(secrets.token_hex(32))"`

---

## 9) Verify after deploy

1. `curl https://YOUR_BACKEND.onrender.com/api/health` → `db` should be `postgres`, models_loaded should list 4.
2. `curl -X POST https://YOUR_BACKEND.onrender.com/api/users -H "Content-Type: application/json" -d '{"name":"Test","email":"test@example.com","password":"test1234"}'` → returns token.
3. `curl https://YOUR_BACKEND.onrender.com/api/transactions?user_id=1 -H "Authorization: Bearer <token>"` → 200.
4. Without token, same GET should 401. With wrong `user_id`, 403.

---

## 10) Troubleshooting

- **CORS error in browser console:** backend `FRONTEND_URL` must exactly match the frontend origin (including `https://`). Comma-separate multiple: `https://a.vercel.app,https://b.onrender.com`. Redeploy backend after changing.
- **psycopg2 build fails in Docker:** the Dockerfile installs `libpq-dev` + `build-essential`. If you deploy without Docker (native Python on Render), set Build Command to `pip install -r requirements.txt` and ensure the `psycopg2-binary` wheel is used (no system deps needed).
- **Neon connection fails:** ensure URL has `?sslmode=require` and you copied the pooled connection string (Neon has direct + pooled; both work, pooled is better). Try `psql "postgresql://..." -c "select 1"` locally.
- **Models missing on deploy:** they are ~18MB and git-ignored? If `ml/saved_models/*.joblib` are not in git, the Dockerfile trains synthetic ones at build time (first boot will be categorizer fallback = Uncategorized until trained). To include real models, `git add -f finlytics-backend/ml/saved_models/*.joblib` and push, or set a build step to train.
- **Need to reset DB:** run `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` in Neon SQL editor (or Render's psql), then restart backend — `init_db()` recreates tables.
- **Vercel shows blank page:** check `VITE_API_URL` has `/api` suffix and backend is reachable. Vercel rewrites are in `vercel.json`.

---

## 11) Files you care about

- `finlytics-backend/.env.example` — all prod env vars
- `finlytics-backend/Dockerfile` — production container
- `finlytics-frontend/.env.example` — frontend env
- `finlytics-frontend/vercel.json` — SPA rewrites
- `finlytics-backend/scripts/migrate_sqlite_to_postgres.py` — one-time copy
- `docker-compose.yml` — local Postgres + backend + frontend
- `render.yaml` — optional Render blueprint

You are live-ready. Set `DATABASE_URL` + `JWT_SECRET` + `FRONTEND_URL` + `VITE_API_URL` and deploy. No local DB file is needed in production.
