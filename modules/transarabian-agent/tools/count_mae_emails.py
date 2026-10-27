#!/usr/bin/env python3
"""Read-only count of e-mails received on a given day (default 26 Oct 2026, Asia/Colombo time).

Usage (on your own computer):
    export TA_GMAIL_ADDRESS="transarabianofficial@gmail.com"
    export TA_GMAIL_APP_PASSWORD="<the 16-character Gmail app password>"
    python3 count_mae_emails.py                 # default: 2026-10-26
    python3 count_mae_emails.py --date 2026-10-26 --sender mae.ro

Safety: uses IMAP EXAMINE (read-only) and BODY.PEEK, so no message is marked as read, moved or deleted.
Only counts and sender domains are printed; message contents are never displayed.
The password is read from the environment and never written to disk or printed.
Gmail requires IMAP to be enabled and an app password (not the normal account password).
"""
import argparse
import collections
import email
import imaplib
import os
import sys
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

COLOMBO = timezone(timedelta(hours=5, minutes=30))  # Asia/Colombo has no DST


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--date", default="2026-10-26", help="local (Colombo) date to count, YYYY-MM-DD")
    ap.add_argument("--sender", default="mae.ro", help="sender domain to count separately")
    ap.add_argument("--host", default="imap.gmail.com")
    ap.add_argument("--mailbox", default="INBOX")
    args = ap.parse_args()

    user = os.environ.get("TA_GMAIL_ADDRESS", "").strip()
    pwd = os.environ.get("TA_GMAIL_APP_PASSWORD", "").strip()
    if not user or not pwd:
        print("Set TA_GMAIL_ADDRESS and TA_GMAIL_APP_PASSWORD in the environment first.", file=sys.stderr)
        return 2

    target = date.fromisoformat(args.date)
    # IMAP SINCE/BEFORE work on server dates, so search one day either side and filter locally.
    since = (target - timedelta(days=1)).strftime("%d-%b-%Y")
    before = (target + timedelta(days=2)).strftime("%d-%b-%Y")

    M = imaplib.IMAP4_SSL(args.host, 993)
    try:
        M.login(user, pwd)
        M.select(args.mailbox, readonly=True)
        typ, data = M.search(None, f'(SINCE "{since}" BEFORE "{before}")')
        if typ != "OK":
            print("IMAP search failed.", file=sys.stderr)
            return 1
        ids = data[0].split()
        on_day = 0
        from_sender = 0
        domains = collections.Counter()
        for mid in ids:
            typ, msg = M.fetch(mid, "(BODY.PEEK[HEADER.FIELDS (DATE FROM)])")
            if typ != "OK" or not msg or not isinstance(msg[0], tuple):
                continue
            hdr = email.message_from_bytes(msg[0][1])
            try:
                received = parsedate_to_datetime(hdr["Date"]).astimezone(COLOMBO)
            except (TypeError, ValueError):
                continue
            if received.date() != target:
                continue
            on_day += 1
            frm = (hdr.get("From") or "").lower()
            domain = frm.rsplit("@", 1)[-1].strip(" >") if "@" in frm else "unknown"
            domains[domain] += 1
            if args.sender.lower() in frm:
                from_sender += 1
        print(f"Mailbox: {user} ({args.mailbox})")
        print(f"Received on {target.isoformat()} (Asia/Colombo): {on_day}")
        print(f"  from *{args.sender}*: {from_sender}")
        print("  sender domains:", dict(domains.most_common(10)))
        return 0
    finally:
        try:
            M.logout()
        except Exception:
            pass


if __name__ == "__main__":
    sys.exit(main())
