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
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    rows_in_file INTEGER NOT NULL,
    rows_imported INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, file_hash)
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
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS uploads (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rows_in_file INTEGER NOT NULL,
    rows_imported INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
    UNIQUE(user_id, file_hash)
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
            # Migration: is_admin
            cur.execute("""
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='users' AND column_name='is_admin'
                    ) THEN
                        ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;
                    END IF;
                END $$;
            """)
            # Migration: uploads file_hash per-user (was global UNIQUE)
            cur.execute("""
                DO $$ BEGIN
                    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uploads_file_hash_key') THEN
                        ALTER TABLE uploads DROP CONSTRAINT uploads_file_hash_key;
                    END IF;
                    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uploads_file_hash_key') THEN
                        DROP INDEX uploads_file_hash_key;
                    END IF;
                END $$;
            """)
            cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_uploads_user_file_hash ON uploads(user_id, file_hash)")
            conn.commit()

            # Seed demo user (with a known password for dev)
            from werkzeug.security import generate_password_hash
            cur.execute("SELECT id, password_hash, is_admin FROM users WHERE email = %s", ("demo@finlytics.app",))
            row = cur.fetchone()
            if not row:
                cur.execute(
                    "INSERT INTO users (name, email, password_hash, is_admin) VALUES (%s, %s, %s, TRUE)",
                    ("Demo User", "demo@finlytics.app", generate_password_hash("demo1234")),
                )
                conn.commit()
            else:
                if row.get("password_hash") is None:
                    cur.execute("UPDATE users SET password_hash = %s WHERE email = %s", (generate_password_hash("demo1234"), "demo@finlytics.app"))
                    conn.commit()
                if not row.get("is_admin"):
                    cur.execute("UPDATE users SET is_admin = TRUE WHERE email = %s", ("demo@finlytics.app",))
                    conn.commit()
            # Promote ADMIN_EMAILS env
            admin_emails = [e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()]
            for em in admin_emails:
                cur.execute("UPDATE users SET is_admin = TRUE WHERE email = %s", (em,))
            if admin_emails:
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
            # Migration: is_admin
            cols = [r[1] for r in conn.execute("PRAGMA table_info(users)").fetchall()]
            if "is_admin" not in cols:
                conn.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")
                conn.commit()
            # Migration: uploads file_hash per-user
            # Check if old table has UNIQUE(file_hash) alone
            sql = conn.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='uploads'").fetchone()
            if sql and "file_hash TEXT NOT NULL UNIQUE" in sql["sql"]:
                # Recreate with correct constraint
                conn.execute("PRAGMA foreign_keys=OFF")
                conn.executescript("""
                    CREATE TABLE IF NOT EXISTS uploads_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        filename TEXT NOT NULL,
                        file_hash TEXT NOT NULL,
                        uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
                        rows_in_file INTEGER NOT NULL,
                        rows_imported INTEGER NOT NULL,
                        status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        UNIQUE(user_id, file_hash)
                    );
                    INSERT OR IGNORE INTO uploads_new (id, user_id, filename, file_hash, uploaded_at, rows_in_file, rows_imported, status)
                        SELECT id, user_id, filename, file_hash, uploaded_at, rows_in_file, rows_imported, status FROM uploads;
                    DROP TABLE uploads;
                    ALTER TABLE uploads_new RENAME TO uploads;
                    CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON uploads(user_id);
                """)
                conn.execute("PRAGMA foreign_keys=ON")
                conn.commit()
            else:
                # Ensure correct index exists
                conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_uploads_user_file_hash ON uploads(user_id, file_hash)")
                # Drop old global unique index if it exists separately
                try:
                    conn.execute("DROP INDEX IF EXISTS sqlite_autoindex_uploads_1")
                except Exception:
                    pass
                conn.commit()

            existing = conn.execute("SELECT id, password_hash, is_admin FROM users WHERE email = ?", ("demo@finlytics.app",)).fetchone()
            if not existing:
                try:
                    from werkzeug.security import generate_password_hash
                    phash = generate_password_hash("demo1234")
                except Exception:
                    phash = None
                conn.execute("INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, 1)", ("Demo User", "demo@finlytics.app", phash))
                conn.commit()
            else:
                if existing["password_hash"] is None:
                    try:
                        from werkzeug.security import generate_password_hash
                        phash = generate_password_hash("demo1234")
                        conn.execute("UPDATE users SET password_hash = ? WHERE email = ?", (phash, "demo@finlytics.app"))
                        conn.commit()
                    except Exception:
                        pass
                if not existing["is_admin"]:
                    conn.execute("UPDATE users SET is_admin = 1 WHERE email = ?", ("demo@finlytics.app",))
                    conn.commit()
            # Promote ADMIN_EMAILS
            admin_emails = [e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()]
            for em in admin_emails:
                conn.execute("UPDATE users SET is_admin = 1 WHERE email = ?", (em,))
            if admin_emails:
                conn.commit()
        finally:
            conn.close()


if __name__ == "__main__":
    init_db()
    url = _get_database_url()
    is_pg = _is_postgres()
    target = url[:50] + "..." if is_pg else DB_PATH
    print(f"Initialized database at {target} ({'Postgres' if is_pg else 'SQLite'})")
