#!/usr/bin/env python3
"""
test_mail_monitor.py - offline checks for the MAE e-mail monitor.
No IMAP, no WhatsApp. Uses a throwaway DB and a throwaway outbox.

Run:  python tests/test_mail_monitor.py
"""
import json
import os
import sys
import tempfile
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "server"))

TMP = tempfile.mkdtemp(prefix="mail_monitor_test_")
os.environ["TA_MAIL_DB"] = os.path.join(TMP, "test.db")
os.environ["TA_MAIL_STATUS"] = os.path.join(TMP, "status.json")
os.environ["TA_GMAIL_ADDRESS"] = ""          # no credentials: nothing can reach a real mailbox
os.environ["TA_GMAIL_APP_PASSWORD"] = ""

import mail_parsers as P                      # noqa: E402
import mail_monitor as M                      # noqa: E402

M.OUTBOX_PATH = os.path.join(TMP, "outbox.jsonl")
M.STATUS_PATH = os.path.join(TMP, "status.json")

ok = fail = 0


def check(label, cond, extra=""):
    global ok, fail
    if cond:
        ok += 1
        print(f"  PASS  {label}")
    else:
        fail += 1
        print(f"  FAIL  {label}  {extra}")


APPT_SUBJ = "Appointment confirmation for application file E24275493641672."
APPT_BODY = ("Your appointment is confirmed for visa application file identified by code "
             "E24275493641672 at Colombo, for 15.10.2026,10:00\n"
             "You can consult the coordinates of your visa application file at any time, by "
             "accessing the following link: E24275493641672")
DEC_SUBJ = "Your E24099301631352 file was decided upon"
DEC_BODY = ("You can now present yourself at the Colombo, in order to pick up your passport "
            "and the affixed visa sticker, if the decision on your application is positive.")

print("1. parsers (real sample e-mails)")
a = P.parse_email(APPT_SUBJ, APPT_BODY, "MAE@evisa.ro")
check("appointment kind", a["kind"] == "appointment", a["kind"])
check("appointment E-number", a["e_number"] == "E24275493641672", a["e_number"])
check("appointment date dd.mm.yyyy", a["appointment_date"] == "15.10.2026", a["appointment_date"])
check("appointment time 10:00", a["appointment_time"] == "10:00", a["appointment_time"])
check("appointment location Colombo", (a["location"] or "").lower() == "colombo", a["location"])
check("appointment confidence high", a["confidence"] >= 0.9, a["confidence"])
d = P.parse_email(DEC_SUBJ, DEC_BODY, "MAE@evisa.ro")
check("decision kind", d["kind"] == "decision", d["kind"])
check("decision E-number", d["e_number"] == "E24099301631352", d["e_number"])
pm = P.parse_email("Appointment confirmation", "Your appointment is confirmed for visa application file "
                   "identified by code E24275493641672 at Colombo, for 14.10.2026,2.30PM", "MAE@evisa.ro")
check("'2.30PM' is 14:30 not 02:30 (earlier real bug)", pm["appointment_time"] == "14:30", pm["appointment_time"])
u = P.parse_email("Newsletter", "hello there", "MAE@evisa.ro")
check("unknown mail is flagged for a person", u["kind"] == "unknown" and u["warnings"], str(u))

print("2. schedule (Asia/Colombo)")
def t(y, mo, da, h, mi):
    return datetime(y, mo, da, h, mi)          # 2026-10-26 is a Monday
check("Mon 08:59 quiet", not M.in_window(t(2026, 10, 26, 8, 59)))
check("Mon 09:00 open", M.in_window(t(2026, 10, 26, 9, 0)))
check("Fri 16:59 open", M.in_window(t(2026, 10, 30, 16, 59)))
check("Fri 17:00 quiet", not M.in_window(t(2026, 10, 30, 17, 0)))
check("Sat 14:29 open", M.in_window(t(2026, 10, 31, 14, 29)))
check("Sat 14:30 quiet", not M.in_window(t(2026, 10, 31, 14, 30)))
check("Sunday quiet", not M.in_window(t(2026, 11, 1, 11, 0)))
nxt = M.next_window_open(t(2026, 10, 31, 15, 0))
check("after Sat 14:30 next open is Mon 09:00", nxt == t(2026, 11, 2, 9, 0), str(nxt))
js = {M.next_poll_after(t(2026, 10, 26, 9, 0)) for _ in range(20)}
check("poll interval is 15 min +/- 2 min jitter",
      all(abs((x - t(2026, 10, 26, 9, 0)).total_seconds() - 900) <= 120 for x in js))

print("3. dedupe, spoof guard, batching (no IMAP)")
def msg(uid, mid, frm, subj, body, received=None):
    return {"imap_id": uid, "message_id": mid, "from_addr": frm, "sender": frm, "subject": subj,
            "body": body, "date_hdr": "Mon, 26 Oct 2026 09:00:00 +0530",
            "received_at": received or t(2026, 10, 26, 9, 0)}

c = M.db()
arrive = t(2026, 10, 26, 10, 0)
batch1 = [msg(b"1", "<a1@mae>", "MAE@evisa.ro", APPT_SUBJ, APPT_BODY),
          msg(b"2", "<d1@mae>", "MAE@evisa.ro", DEC_SUBJ, DEC_BODY)]
new, marks, skipped = M.process_messages(c, batch1, arrive)
c.commit()
check("two new stored", new == 2, str(new))
check("both marked for \\Seen after storing", marks == [b"1", b"2"], str(marks))
new2, marks2, _ = M.process_messages(c, batch1, arrive)
check("same Message-IDs are not stored twice", new2 == 0, str(new2))
spoof = [msg(b"9", "<x@evil>", "attacker@gmail.com", APPT_SUBJ, APPT_BODY)]
new3, _, skip3 = M.process_messages(c, spoof, arrive)
check("non-evisa sender is rejected", new3 == 0 and skip3 == 1, f"{new3} {skip3}")
rows = c.execute("SELECT kind,e_number,batch_id FROM emails ORDER BY id").fetchall()
check("stored rows are the two MAE mails", [r["kind"] for r in rows] == ["appointment", "decision"], str([tuple(r) for r in rows]))
appt_batch = rows[0]["batch_id"]
check("appointment grouped into an open batch", appt_batch is not None)
early = M.release_due_batches(c, t(2026, 10, 26, 10, 2))
check("batch held during the 3-minute quiet period", early == [], str(early))
late = M.release_due_batches(c, t(2026, 10, 26, 10, 4))
check("batch released after 3 quiet minutes", len(late) == 2, str(late))
c.commit()
outbox = [json.loads(x) for x in open(M.OUTBOX_PATH, encoding="utf-8")]
check("released output is dry-run only", outbox and all(o["dry_run"] for o in outbox))
txt = next(o["body"] for o in outbox if o["kind"] == "batch_appointment")
check("interview block uses the agreed layout",
      "Embassy Interview" in txt and "Appointment Date : 15.10.2026" in txt
      and "Appointment Time: 10:00" in txt and "SE NUMBER :" in txt, txt[:200])
c.close()

print("4. no credentials: poll fails safely and is recorded")
res = M.poll_once()
check("poll reports not ok, does not raise", res["ok"] is False and res["error"])
st = json.load(open(M.STATUS_PATH, encoding="utf-8"))
check("status file records the error", "TA_GMAIL_ADDRESS" in (st.get("last_error") or ""), str(st.get("last_error")))

print(f"\n{ok} passed, {fail} failed")
sys.exit(1 if fail else 0)
