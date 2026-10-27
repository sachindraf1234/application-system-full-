"""Local SQLite store for the Trans Arabian bot (test harness).

Implements the functions app.py imports, plus get_conn() used by /stats. The original repository
does not contain its database module, so this is a minimal replacement with the same table and
column names app.py queries. Data lives in modules/transarabian-agent/data/harness.db (git-ignored).
"""
import os
import sqlite3
from datetime import datetime, timedelta, timezone

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "harness.db")


def get_conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def _now():
    return datetime.now(timezone.utc).isoformat()


def init_db():
    with get_conn() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, direction TEXT, msg_type TEXT, body TEXT,
            filename TEXT, status TEXT, wa_id TEXT, is_template INTEGER DEFAULT 0, template_name TEXT,
            timestamp TEXT);
        CREATE TABLE IF NOT EXISTS contacts (
            phone TEXT PRIMARY KEY, opted_in INTEGER DEFAULT 0, opted_out INTEGER DEFAULT 0, blocked INTEGER DEFAULT 0,
            opt_in_source TEXT, last_inbound_at TEXT, ai_paused INTEGER DEFAULT 0, updated_at TEXT);
        CREATE TABLE IF NOT EXISTS handoff_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, reason TEXT, resolved INTEGER DEFAULT 0,
            created_at TEXT, resolved_at TEXT);
        CREATE TABLE IF NOT EXISTS compliance_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, check_type TEXT, passed INTEGER, detail TEXT,
            created_at TEXT);
        """)


def _ensure(c, phone):
    c.execute("INSERT OR IGNORE INTO contacts (phone, updated_at) VALUES (?, ?)", (phone, _now()))


def log_message(phone, direction, msg_type, body, wa_id=None, filename=None, status=None, is_template=0, template_name=None):
    with get_conn() as c:
        _ensure(c, phone)
        c.execute(
            "INSERT INTO messages (phone, direction, msg_type, body, filename, status, wa_id, is_template, template_name, timestamp)"
            " VALUES (?,?,?,?,?,?,?,?,?,?)",
            (phone, direction, msg_type, str(body or ""), filename, status, wa_id, int(is_template or 0), template_name, _now()),
        )
        if direction == "inbound":
            c.execute("UPDATE contacts SET last_inbound_at=?, updated_at=? WHERE phone=?", (_now(), _now(), phone))


def get_recent_messages(phone, limit=10):
    with get_conn() as c:
        rows = c.execute("SELECT direction, msg_type, body, timestamp FROM messages WHERE phone=? ORDER BY id DESC LIMIT ?", (phone, limit)).fetchall()
    return [dict(r) for r in reversed(rows)]


def is_opted_in(phone):
    with get_conn() as c:
        r = c.execute("SELECT opted_in, blocked FROM contacts WHERE phone=?", (phone,)).fetchone()
    return bool(r and r["opted_in"] and not r["blocked"])


def set_opted_in(phone, source="unknown"):
    with get_conn() as c:
        _ensure(c, phone)
        c.execute("UPDATE contacts SET opted_in=1, opted_out=0, opt_in_source=?, updated_at=? WHERE phone=?", (source, _now(), phone))


def is_opted_out(phone):
    with get_conn() as c:
        r = c.execute("SELECT opted_out FROM contacts WHERE phone=?", (phone,)).fetchone()
    return bool(r and r["opted_out"])


def set_opted_out(phone):
    with get_conn() as c:
        _ensure(c, phone)
        c.execute("UPDATE contacts SET opted_out=1, opted_in=0, updated_at=? WHERE phone=?", (_now(), phone))


def is_in_24h_window(phone):
    with get_conn() as c:
        r = c.execute("SELECT last_inbound_at FROM contacts WHERE phone=?", (phone,)).fetchone()
    if not r or not r["last_inbound_at"]:
        return False
    return datetime.now(timezone.utc) - datetime.fromisoformat(r["last_inbound_at"]) < timedelta(hours=24)


def is_ai_paused(phone):
    with get_conn() as c:
        r = c.execute("SELECT ai_paused FROM contacts WHERE phone=?", (phone,)).fetchone()
    return bool(r and r["ai_paused"])


def trigger_human_handoff(phone, reason=""):
    with get_conn() as c:
        _ensure(c, phone)
        c.execute("UPDATE contacts SET ai_paused=1, updated_at=? WHERE phone=?", (_now(), phone))
        c.execute("INSERT INTO handoff_queue (phone, reason, resolved, created_at) VALUES (?,?,0,?)", (phone, reason, _now()))


def get_handoff_queue():
    with get_conn() as c:
        rows = c.execute("SELECT phone, reason, created_at FROM handoff_queue WHERE resolved=0 ORDER BY id").fetchall()
    return [dict(r) for r in rows]


def resolve_handoff(phone):
    with get_conn() as c:
        c.execute("UPDATE handoff_queue SET resolved=1, resolved_at=? WHERE phone=? AND resolved=0", (_now(), phone))
        c.execute("UPDATE contacts SET ai_paused=0, updated_at=? WHERE phone=?", (_now(), phone))


def log_compliance(phone, check_type, passed, detail=""):
    with get_conn() as c:
        c.execute("INSERT INTO compliance_log (phone, check_type, passed, detail, created_at) VALUES (?,?,?,?,?)",
                  (phone, check_type, 1 if passed else 0, detail, _now()))
