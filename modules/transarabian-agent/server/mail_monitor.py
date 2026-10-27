"""
mail_monitor.py - watches the Trans Arabian Gmail inbox for MAE (evisa.ro) e-mails.

What it does, step by step (Asia/Colombo time):
  1. Connects to imap.gmail.com:993 with the account app password (env, never printed).
  2. Selects INBOX and searches FROM "evisa.ro", SINCE the last N days, UNSEEN.
  3. Fetches up to 30 newest messages with BODY.PEEK (full RFC822) and parses them.
  4. Rejects anything whose From is not an evisa.ro address (spoof guard).
  5. Dedupes on Message-ID (UNIQUE in the emails table) and stores each e-mail.
  6. Marks a message \\Seen only after it has been stored (so a parse failure never hides it).
  7. Schedule: polls every 15 min (+/- 2 min jitter) Mon-Fri 09:00-17:00 and Sat 09:00-14:30.
     Quiet from Sat 14:30 until Mon 09:00 (Sunday is inside that quiet span).
  8. Appointment e-mails are batched: a batch is released only after 3 quiet minutes,
     so several confirmations arriving together are reported together.
  9. Output goes ONLY to data/dry_run_outbox.jsonl. Nothing is sent to WhatsApp here.

Commands:
  python server/mail_monitor.py once      # one poll now, then exit
  python server/mail_monitor.py loop      # run the scheduler forever (Ctrl+C to stop)
  python server/mail_monitor.py status    # print the status file
  python server/mail_monitor.py release   # release any batch whose quiet time has passed

Config (environment, or modules/transarabian-agent/.env which is git-ignored):
  TA_GMAIL_ADDRESS, TA_GMAIL_APP_PASSWORD   required for a real poll
  TA_MAIL_HOST (imap.gmail.com), TA_MAIL_SENDER (evisa.ro), TA_MAIL_LOOKBACK_DAYS (7)
  TA_MAIL_MARK_SEEN (true), TA_MAIL_ONLY_UNSEEN (true)
"""
import email
import hashlib
import imaplib
import json
import os
import random
import re
import sqlite3
import sys
import time
import traceback
from datetime import datetime, timedelta, timezone
from email.utils import parseaddr, parsedate_to_datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from mail_parsers import parse_email  # noqa: E402

COLOMBO = timezone(timedelta(hours=5, minutes=30))  # Sri Lanka has no DST
DATA_DIR = os.path.join(ROOT, "data")
DB_PATH = os.environ.get("TA_MAIL_DB", os.path.join(DATA_DIR, "mail_monitor.db"))
STATUS_PATH = os.environ.get("TA_MAIL_STATUS", os.path.join(DATA_DIR, "mail_monitor_status.json"))
OUTBOX_PATH = os.path.join(DATA_DIR, "dry_run_outbox.jsonl")

POLL_MINUTES = 15
JITTER_SECONDS = 120
BATCH_QUIET_SECONDS = 180
FETCH_LIMIT = 30


def _load_env_file():
    path = os.path.join(ROOT, ".env")
    if not os.path.exists(path):
        return
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_env_file()


def _bool(name, default):
    return os.environ.get(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


CONFIG = {
    "address": os.environ.get("TA_GMAIL_ADDRESS", "").strip(),
    "password": os.environ.get("TA_GMAIL_APP_PASSWORD", "").strip(),
    "host": os.environ.get("TA_MAIL_HOST", "imap.gmail.com").strip(),
    "port": int(os.environ.get("TA_MAIL_PORT", "993")),
    "mailbox": os.environ.get("TA_MAIL_MAILBOX", "INBOX"),
    "sender": os.environ.get("TA_MAIL_SENDER", "evisa.ro").strip().lower(),
    "lookback_days": int(os.environ.get("TA_MAIL_LOOKBACK_DAYS", "7")),
    "mark_seen": _bool("TA_MAIL_MARK_SEEN", True),
    "only_unseen": _bool("TA_MAIL_ONLY_UNSEEN", True),
}


# ----------------------------------------------------------------- time/schedule
def now_colombo():
    return datetime.now(COLOMBO)


def in_window(dt):
    """Mon-Fri 09:00-17:00 and Sat 09:00-14:30. Everything else is quiet."""
    wd, t = dt.weekday(), dt.hour * 60 + dt.minute
    if wd <= 4:
        return 9 * 60 <= t < 17 * 60
    if wd == 5:
        return 9 * 60 <= t < 14 * 60 + 30
    return False


def next_window_open(dt):
    """First moment after dt when the window is open."""
    cand = dt.replace(second=0, microsecond=0)
    for _ in range(14 * 24 * 12):
        cand = cand + timedelta(minutes=5)
        if in_window(cand):
            return cand
    return None


def next_poll_after(dt):
    """Next poll time: 15 min later with random +/-2 min jitter (avoids machine-like timing)."""
    jitter = random.randint(-JITTER_SECONDS, JITTER_SECONDS)
    return dt + timedelta(minutes=POLL_MINUTES, seconds=jitter)


# ----------------------------------------------------------------- storage
SCHEMA = """
CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dedupe_key TEXT UNIQUE NOT NULL,
    message_id TEXT,
    sender TEXT,
    subject TEXT,
    received_at TEXT,
    kind TEXT,
    e_number TEXT,
    se_number TEXT,
    appointment_date TEXT,
    appointment_time TEXT,
    location TEXT,
    confidence REAL,
    warnings TEXT,
    batch_id INTEGER,
    processed INTEGER DEFAULT 0,
    created_at TEXT
);
CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,            -- open | released
    release_at TEXT NOT NULL,        -- last arrival + quiet period
    created_at TEXT,
    released_at TEXT
);
CREATE TABLE IF NOT EXISTS poll_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    polled_at TEXT, ok INTEGER, fetched INTEGER, new_count INTEGER, error TEXT
);
"""


def db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    c = sqlite3.connect(DB_PATH, timeout=30)
    c.row_factory = sqlite3.Row
    c.executescript(SCHEMA)
    return c


def dedupe_key(message_id, sender, subject, date_hdr):
    if message_id:
        return "mid:" + message_id.strip()
    raw = f"{sender}|{subject}|{date_hdr}"
    return "hash:" + hashlib.sha256(raw.encode("utf-8", "replace")).hexdigest()


# ----------------------------------------------------------------- status
def _write_status(**updates):
    os.makedirs(os.path.dirname(STATUS_PATH), exist_ok=True)
    try:
        st = json.load(open(STATUS_PATH, encoding="utf-8"))
    except (OSError, ValueError):
        st = {}
    st.update(updates)
    st["updated_at"] = now_colombo().isoformat(timespec="seconds")
    tmp = STATUS_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(st, f, indent=2, ensure_ascii=False)
    os.replace(tmp, STATUS_PATH)


def read_status():
    try:
        return json.load(open(STATUS_PATH, encoding="utf-8"))
    except (OSError, ValueError):
        return {}


# ----------------------------------------------------------------- IMAP
def _decode_body(msg):
    plain, html = [], []
    parts = msg.walk() if msg.is_multipart() else [msg]
    for part in parts:
        if part.get_content_maintype() == "multipart" or part.get_filename():
            continue
        try:
            text = part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", "replace")
        except Exception:
            continue
        (html if part.get_content_type() == "text/html" else plain).append(text)
    if plain:
        return "\n".join(plain)
    return re.sub(r"<[^>]+>", " ", "\n".join(html))


def _decode_hdr(v):
    from email.header import decode_header, make_header
    try:
        return str(make_header(decode_header(v or "")))
    except Exception:
        return v or ""


def imap_connect():
    if not CONFIG["address"] or not CONFIG["password"]:
        raise RuntimeError("TA_GMAIL_ADDRESS / TA_GMAIL_APP_PASSWORD are not set")
    M = imaplib.IMAP4_SSL(CONFIG["host"], CONFIG["port"], timeout=30)
    M.login(CONFIG["address"], CONFIG["password"])
    typ, _ = M.select(CONFIG["mailbox"], readonly=not CONFIG["mark_seen"])
    if typ != "OK":
        raise RuntimeError(f"cannot select mailbox {CONFIG['mailbox']}")
    return M


def imap_search_criteria():
    since = (now_colombo() - timedelta(days=CONFIG["lookback_days"])).strftime("%d-%b-%Y")
    parts = [f'FROM "{CONFIG["sender"]}"', f'SINCE "{since}"']
    if CONFIG["only_unseen"]:
        parts.append("UNSEEN")
    return " ".join(parts)


def fetch_new_messages(M):
    """Return a list of normalised message dicts plus the IMAP ids to mark seen later."""
    typ, data = M.search(None, imap_search_criteria())
    if typ != "OK":
        raise RuntimeError("IMAP search failed")
    ids = data[0].split()[::-1][:FETCH_LIMIT]  # newest first
    out = []
    for mid in ids:
        typ, msg_data = M.fetch(mid, "(BODY.PEEK[])")
        if typ != "OK" or not msg_data or not isinstance(msg_data[0], tuple):
            continue
        msg = email.message_from_bytes(msg_data[0][1])
        _, addr = parseaddr(msg.get("From", ""))
        out.append({
            "imap_id": mid,
            "message_id": (msg.get("Message-ID") or "").strip(),
            "from_addr": (addr or "").lower(),
            "sender": _decode_hdr(msg.get("From")),
            "subject": _decode_hdr(msg.get("Subject")),
            "body": _decode_body(msg),
            "date_hdr": msg.get("Date") or "",
            "received_at": _received(msg),
        })
    return out


def _received(msg):
    try:
        return parsedate_to_datetime(msg.get("Date")).astimezone(COLOMBO).replace(tzinfo=None)
    except (TypeError, ValueError):
        return now_colombo().replace(tzinfo=None)


# ----------------------------------------------------------------- processing
def _open_batch(c, kind, at):
    row = c.execute("SELECT * FROM batches WHERE kind=? AND status='open' ORDER BY id DESC LIMIT 1",
                    (kind,)).fetchone()
    if row:
        c.execute("UPDATE batches SET release_at=? WHERE id=?",
                  ((at + timedelta(seconds=BATCH_QUIET_SECONDS)).isoformat(timespec="seconds"), row["id"]))
        return row["id"]
    cur = c.execute("INSERT INTO batches (kind,status,release_at,created_at) VALUES (?,?,?,?)",
                    (kind, "open", (at + timedelta(seconds=BATCH_QUIET_SECONDS)).isoformat(timespec="seconds"),
                     at.isoformat(timespec="seconds")))
    return cur.lastrowid


def process_messages(c, messages, at=None):
    """Store, dedupe and batch. Returns (new_ids, stored_imap_ids_to_mark_seen, skipped_non_mae)."""
    at = at or now_colombo().replace(tzinfo=None)
    new_count, to_mark, skipped = 0, [], 0
    for m in messages:
        if CONFIG["sender"] not in m["from_addr"]:
            skipped += 1               # spoof guard: the subject alone is not trusted
            to_mark.append(m["imap_id"])   # not from the embassy: mark it so it is not re-read forever
            continue
        key = dedupe_key(m["message_id"], m["from_addr"], m["subject"], m["date_hdr"])
        if c.execute("SELECT 1 FROM emails WHERE dedupe_key=?", (key,)).fetchone():
            to_mark.append(m["imap_id"])   # already stored earlier; just mark it seen
            continue
        p = parse_email(m["subject"], m["body"], m["from_addr"], m["received_at"])
        batch_id = None
        if p["kind"] in ("appointment", "decision"):
            batch_id = _open_batch(c, p["kind"], at)
        c.execute(
            "INSERT INTO emails (dedupe_key,message_id,sender,subject,received_at,kind,e_number,se_number,"
            "appointment_date,appointment_time,location,confidence,warnings,batch_id,processed,created_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?)",
            (key, m["message_id"], m["from_addr"], m["subject"], m["received_at"].isoformat(timespec="seconds"),
             p["kind"], p["e_number"], p["se_number"], p["appointment_date"], p["appointment_time"],
             p["location"], p["confidence"], json.dumps(p["warnings"], ensure_ascii=False), batch_id,
             at.isoformat(timespec="seconds")))
        new_count += 1
        to_mark.append(m["imap_id"])       # stored successfully, so it is safe to mark seen
    return new_count, to_mark, skipped


def release_due_batches(c, at=None):
    """Release any open batch whose quiet period has passed. Output is dry-run only."""
    at = at or now_colombo().replace(tzinfo=None)
    released = []
    for b in c.execute("SELECT * FROM batches WHERE status='open' AND release_at<=?",
                       (at.isoformat(timespec="seconds"),)).fetchall():
        rows = c.execute("SELECT * FROM emails WHERE batch_id=? ORDER BY received_at",
                         (b["id"],)).fetchall()
        text = format_batch(b["kind"], rows)
        _dry_run_outbox(f"batch_{b['kind']}", text, {"batch_id": b["id"], "count": len(rows)})
        c.execute("UPDATE emails SET processed=1 WHERE batch_id=?", (b["id"],))
        c.execute("UPDATE batches SET status='released', released_at=? WHERE id=?",
                  (at.isoformat(timespec="seconds"), b["id"]))
        released.append({"batch_id": b["id"], "kind": b["kind"], "count": len(rows)})
    return released


def format_batch(kind, rows):
    """Plain-text report. Name and SE-number come from the applicant registry, which this step does not query."""
    lines = []
    for r in rows:
        if kind == "appointment":
            lines += ["Embassy Interview",
                      f"SE NUMBER : {r['se_number'] or 'NEEDS LOOKUP'}",
                      "",
                      f"E NUMBER : {r['e_number'] or 'MISSING'}",
                      "",
                      "Name: NEEDS LOOKUP (not in registry yet)",
                      "",
                      f"Appointment Date : {r['appointment_date'] or 'NEEDS REVIEW'}",
                      "",
                      f"Appointment Time: {r['appointment_time'] or 'NEEDS REVIEW'}",
                      ""]
        else:
            lines += [f"Passport ready for pick-up: E NUMBER {r['e_number'] or 'MISSING'} "
                      f"(mail received {r['received_at']}). Name: NEEDS LOOKUP.", ""]
    return "\n".join(lines).rstrip() + "\n"


def _dry_run_outbox(kind, body, meta):
    os.makedirs(DATA_DIR, exist_ok=True)
    rec = {"ts": now_colombo().isoformat(timespec="seconds"), "kind": kind,
           "dry_run": True, "body": body, "meta": meta}
    with open(OUTBOX_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


# ----------------------------------------------------------------- polling
def poll_once(at=None):
    """One IMAP poll. Never raises: errors are recorded in the status file and poll_log."""
    now = now_colombo()
    c = db()
    summary = {"ok": False, "fetched": 0, "new": 0, "skipped": 0, "error": None, "released": []}
    M = None
    try:
        M = imap_connect()
        messages = fetch_new_messages(M)
        summary["fetched"] = len(messages)
        new_count, to_mark, skipped = process_messages(c, messages, now.replace(tzinfo=None))
        c.commit()
        summary["new"], summary["skipped"] = new_count, skipped
        if CONFIG["mark_seen"]:
            for imap_id in to_mark:
                M.store(imap_id, "+FLAGS", "\\Seen")
        summary["ok"] = True
    except Exception as e:  # noqa: BLE001 - the loop must keep running
        summary["error"] = f"{type(e).__name__}: {str(e)[:300]}"
    finally:
        if M is not None:
            try:
                M.logout()
            except Exception:
                pass
    summary["released"] = release_due_batches(c, now.replace(tzinfo=None))
    c.commit()
    c.execute("INSERT INTO poll_log (polled_at,ok,fetched,new_count,error) VALUES (?,?,?,?,?)",
              (now.isoformat(timespec="seconds"), 1 if summary["ok"] else 0,
               summary["fetched"], summary["new"], summary["error"]))
    c.commit()
    c.close()
    _write_status(last_poll_at=now.isoformat(timespec="seconds"),
                  last_poll_ok=summary["ok"],
                  last_error=summary["error"],
                  last_poll_fetched=summary["fetched"],
                  last_poll_new=summary["new"],
                  last_poll_skipped=summary["skipped"],
                  mailbox=CONFIG["address"] or "(not configured)",
                  sender_filter=CONFIG["sender"])
    return summary


def loop_forever():
    _write_status(running=True, started_at=now_colombo().isoformat(timespec="seconds"),
                  mode="dry_run", note="outbound messages go to data/dry_run_outbox.jsonl only")
    next_poll = None
    while True:
        now = now_colombo()
        try:
            if not in_window(now):
                opens = next_window_open(now)
                _write_status(window_open=False, next_poll_at=opens.isoformat(timespec="seconds") if opens else None)
                time.sleep(min(300, max(5, (opens - now).total_seconds())) if opens else 300)
                continue
            if next_poll is None or now >= next_poll:
                poll_once(now)
                next_poll = next_poll_after(now_colombo())
            c = db()
            release_due_batches(c)
            c.commit()
            c.close()
            _write_status(window_open=True, next_poll_at=next_poll.isoformat(timespec="seconds"))
        except KeyboardInterrupt:
            _write_status(running=False)
            raise
        except Exception as e:  # noqa: BLE001
            _write_status(last_error=f"loop: {type(e).__name__}: {str(e)[:300]}",
                          last_traceback=traceback.format_exc()[-800:])
        time.sleep(30)


def main(argv):
    cmd = argv[1] if len(argv) > 1 else "status"
    if cmd == "once":
        print(json.dumps(poll_once(), ensure_ascii=False, indent=2, default=str))
    elif cmd == "loop":
        loop_forever()
    elif cmd == "release":
        c = db()
        print(json.dumps(release_due_batches(c), ensure_ascii=False))
        c.commit()
    elif cmd == "status":
        print(json.dumps(read_status(), ensure_ascii=False, indent=2))
    else:
        print(__doc__)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
