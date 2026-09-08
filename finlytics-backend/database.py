"""
database.py — Production-ready dual DB layer.

Supports:
  - Local dev: SQLite at finlytics.db (default, zero-config)
  - Production: Postgres via DATABASE_URL env var (Neon / Supabase / Render)

Switch is automatic: if DATABASE_URL starts with postgres:// or postgresql://,
we use psycopg2 + RealDictCursor. Otherwise we fall back to sqlite3.

Both paths expose the same helpers so routes don't need to know which DB
they're on: get_db() returns a connection, and you use
  conn.execute(sql, params).fetchone() / .fetchall()
  conn.commit()
  conn.close()
Param style is normalized: write ? placeholders always; the Postgres
wrapper rewrites them to %s before executing.

Schema is identical in intent, with dialect tweaks (AUTOINCREMENT vs SERIAL,
etc.) and includes the live-auth column password_hash.
"""

import os
import sqlite3

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

def _get_database_url():
    url = os.environ.get("DATABASE_URL", "").strip()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url

def _is_postgres():
    url = _get_database_url()
    return url.startswith("postgresql://")

# Keep for backwards compat — some code imports DB_PATH / DATABASE_URL directly
DATABASE_URL = _get_database_url()
IS_POSTGRES = _is_postgres()

# SQLite fallback path (used when DATABASE_URL is not postgres)
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "finlytics.db")

# ---------------------------------------------------------------------------
# Postgres helpers — lazy import
# ---------------------------------------------------------------------------
def _pg_imports():
    import psycopg2
    import psycopg2.extras
    return psycopg2, psycopg2.extras

# ---------------------------------------------------------------------------
# Schema — two variants differing only in dialect
# ---------------------------------------------------------------------------
SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    file_hash TEXT NOT NULL UNIQUE,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    rows_in_file INTEGER NOT NULL,
    rows_imported INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    upload_id INTEGER,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    amount INTEGER NOT NULL,
    category TEXT NOT NULL DEFAULT 'Uncategorized'
        CHECK (category IN (
            'Uncategorized', 'Food', 'Travel', 'Bills',
            'Shopping', 'Entertainment', 'Health', 'Other'
        )),
    is_anomaly INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (upload_id) REFERENCES uploads(id) ON DELETE SET NULL
);
"""

POSTGRES_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS uploads (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_hash TEXT NOT NULL UNIQUE,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rows_in_file INTEGER NOT NULL,
    rows_imported INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial'))
);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    upload_id INTEGER REFERENCES uploads(id) ON DELETE SET NULL,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    amount INTEGER NOT NULL,
    category TEXT NOT NULL DEFAULT 'Uncategorized'
        CHECK (category IN (
            'Uncategorized', 'Food', 'Travel', 'Bills',
            'Shopping', 'Entertainment', 'Health', 'Other'
        )),
    is_anomaly INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""

SQLITE_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON uploads(user_id);
"""

POSTGRES_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
"""


# ---------------------------------------------------------------------------
# Postgres connection wrapper — mimics sqlite3.Connection.execute() surface
# ---------------------------------------------------------------------------
class _PgCursorWrapper:
    def __init__(self, cursor):
        self._cur = cursor
        self.lastrowid = None

    def fetchone(self):
        row = self._cur.fetchone()
        return row

    def fetchall(self):
        return self._cur.fetchall()

    @property
    def rowcount(self):
        return self._cur.rowcount


class _PgConnectionWrapper:
    """Wraps a psycopg2 connection so callers can use conn.execute(sql, params)
    with ? placeholders like sqlite3, and get dict-like rows."""
    def __init__(self, pg_conn):
        self._conn = pg_conn
        self._cursor = None

    def execute(self, sql, params=()):
        _, extras = _pg_imports()
        pg_sql = sql.replace("?", "%s")
        is_insert = sql.strip().upper().startswith("INSERT")
        needs_returning = is_insert and "RETURNING" not in pg_sql.upper()
        if needs_returning:
            pg_sql = pg_sql.rstrip().rstrip(";") + " RETURNING id"
        cur = self._conn.cursor(cursor_factory=extras.RealDictCursor)
        cur.execute(pg_sql, params)
        wrapper = _PgCursorWrapper(cur)
        self._cursor = cur
        if needs_returning:
            try:
                row = cur.fetchone()
                if row and "id" in row:
                    wrapper.lastrowid = row["id"]
            except Exception:
                pass
        return wrapper

    def executemany(self, sql, seq_of_params):
        pg_sql = sql.replace("?", "%s")
        cur = self._conn.cursor()
        cur.executemany(pg_sql, seq_of_params)
        return _PgCursorWrapper(cur)

    def executescript(self, sql):
        # For schema init — split and execute statements
        cur = self._conn.cursor()
        cur.execute(sql)
        return cur

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        try:
            if self._cursor:
                self._cursor.close()
        except Exception:
            pass
        self._conn.close()

    # For postgres INSERT id retrieval, provide a helper
    def execute_returning_id(self, sql, params=()):
        """Execute INSERT and return the inserted id (handles ? -> %s)."""
        _, extras = _pg_imports()
        pg_sql = sql.replace("?", "%s")
        if "RETURNING" not in pg_sql.upper():
            pg_sql = pg_sql.rstrip().rstrip(";") + " RETURNING id"
        cur = self._conn.cursor(cursor_factory=extras.RealDictCursor)
        cur.execute(pg_sql, params)
        row = cur.fetchone()
        cur.close()
        if row and "id" in row:
            return row["id"]
        return None


def get_db():
    """Return a DB connection (sqlite3 or postgres wrapper) with FKs on."""
    if _is_postgres():
        psycopg2, _ = _pg_imports()
        url = _get_database_url()
        # Neon/Supabase require SSL; local postgres may not
        sslmode = "require" if ("neon.tech" in url or "supabase" in url or "sslmode=" not in url and "localhost" not in url) else "prefer"
        # Avoid double sslmode param
        if "sslmode=" not in url:
            pg_conn = psycopg2.connect(url, sslmode=sslmode)
        else:
            pg_conn = psycopg2.connect(url)
        pg_conn.autocommit = False
        return _PgConnectionWrapper(pg_conn)
    else:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn


def _get_raw_conn():
    """Get a raw connection for init/migration (bypasses wrapper for simplicity)."""
    if _is_postgres():
        psycopg2, _ = _pg_imports()
        url = _get_database_url()
        sslmode = "require" if ("neon.tech" in url or "supabase" in url) else "prefer"
        if "sslmode=" not in url:
            conn = psycopg2.connect(url, sslmode=sslmode)
        else:
            conn = psycopg2.connect(url)
        conn.autocommit = False
        return conn
    else:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn


def init_db():
    """Create tables/indexes if they don't exist, migrate password_hash column,
    and seed demo user for local dev."""
    # Refresh cached globals (in case dotenv loaded after import)
    global DATABASE_URL, IS_POSTGRES
    DATABASE_URL = _get_database_url()
    IS_POSTGRES = _is_postgres()
    if _is_postgres():
        conn = _get_raw_conn()
        try:
            cur = conn.cursor()
            cur.execute(POSTGRES_SCHEMA)
            cur.execute(POSTGRES_INDEXES)
            # Migration: add password_hash if missing (for existing DBs before auth)
            cur.execute("""
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='users' AND column_name='password_hash'
                    ) THEN
                        ALTER TABLE users ADD COLUMN password_hash TEXT;
                    END IF;
                END $$;
            """)
            conn.commit()

            # Seed demo user (with a known password for dev)
            from werkzeug.security import generate_password_hash
            cur.execute("SELECT id, password_hash FROM users WHERE email = %s", ("demo@finlytics.app",))
            row = cur.fetchone()
            if not row:
                cur.execute(
                    "INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s)",
                    ("Demo User", "demo@finlytics.app", generate_password_hash("demo1234")),
                )
                conn.commit()
            elif row.get("password_hash") is None:
                # Existing demo account from before live auth — set its password
                cur.execute(
                    "UPDATE users SET password_hash = %s WHERE email = %s",
                    (generate_password_hash("demo1234"), "demo@finlytics.app"),
                )
                conn.commit()
            cur.close()
        finally:
            conn.close()
    else:
        conn = _get_raw_conn()
        try:
            conn.executescript(SQLITE_SCHEMA)
            conn.executescript(SQLITE_INDEXES)
            # Migration: add password_hash column if missing
            cols = [r[1] for r in conn.execute("PRAGMA table_info(users)").fetchall()]
            if "password_hash" not in cols:
                conn.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
                conn.commit()

            existing = conn.execute(
                "SELECT id, password_hash FROM users WHERE email = ?", ("demo@finlytics.app",)
            ).fetchone()
            if not existing:
                try:
                    from werkzeug.security import generate_password_hash
                    phash = generate_password_hash("demo1234")
                except Exception:
                    phash = None
                conn.execute(
                    "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
                    ("Demo User", "demo@finlytics.app", phash),
                )
                conn.commit()
            elif existing["password_hash"] is None:
                try:
                    from werkzeug.security import generate_password_hash
                    phash = generate_password_hash("demo1234")
                    conn.execute("UPDATE users SET password_hash = ? WHERE email = ?", (phash, "demo@finlytics.app"))
                    conn.commit()
                except Exception:
                    pass
        finally:
            conn.close()


if __name__ == "__main__":
    init_db()
    url = _get_database_url()
    is_pg = _is_postgres()
    target = url[:50] + "..." if is_pg else DB_PATH
    print(f"Initialized database at {target} ({'Postgres' if is_pg else 'SQLite'})")
