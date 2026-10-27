"""
mail_parsers.py - classify and read the two MAE (evisa.ro) e-mail families.

  * appointment: "Appointment confirmation for application file E24..."
        body: "Your appointment is confirmed for visa application file identified by
               code E24... at Colombo, for 15.10.2026,10:00"
  * decision:    "Your E24... file was decided upon"
        body: "... pick up your passport and the affixed visa sticker ..."

The e-mail body only carries the E-number, so name and SE-number must come from the
applicant registry later. This module does not look anything up.

Pure functions, no network. Used by mail_monitor.py and tests/test_mail_monitor.py.
"""
import re
from datetime import datetime

E_RE = re.compile(r"(?<![\w])(E\s?\d{8,20})(?![\w])", re.IGNORECASE)
SE_RE = re.compile(r"(?<![\w])(SE\s?\d{4,12})(?![\w])", re.IGNORECASE)
DATE_DOT_RE = re.compile(r"(\d{1,2})\.(\d{1,2})\.(\d{4})")
DATE_SLASH_RE = re.compile(r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})")
TIME_RE = re.compile(r"(\d{1,2})[.:](\d{2})\s*([AaPp]\.?[Mm]\.?)?")

APPT_SUBJ_RE = re.compile(r"appointment\s*confirmation", re.IGNORECASE)
APPT_BODY_RE = re.compile(
    r"(?:code|file)\s*(E\s?\d{8,20})\s*at\s*([A-Za-z ,\-]+?)\s*,\s*for\s*"
    r"(\d{1,2}\.\d{1,2}\.\d{4})\s*[, ]\s*(\d{1,2}[.:]\d{2}\s*(?:[AaPp]\.?[Mm]\.?)?)",
    re.IGNORECASE)
APPT_BODY_LOOSE_RE = re.compile(
    r"(E\s?\d{8,20}).{0,120}?(\d{1,2}[./-]\d{1,2}[./-]\d{4})\s*[, ]\s*"
    r"(\d{1,2}[.:]\d{2}\s*(?:[AaPp]\.?[Mm]\.?)?)",
    re.IGNORECASE | re.S)
DECISION_SUBJ_RE = re.compile(r"(E\s?\d{8,20})\s*file\s*(?:was|has been)\s*decided", re.IGNORECASE)
DECISION_BODY_RE = re.compile(
    r"pick\s*up\s*your\s*passport|decided\s*upon|affixed\s*visa\s*sticker", re.IGNORECASE)


def clean(s):
    if not s:
        return ""
    s = s.replace("\u00a0", " ").replace("\r", " ").replace("=\n", "").replace("\n", " ")
    return re.sub(r"[ \t]+", " ", s).strip()


def find_e_numbers(text):
    return [m.group(1).replace(" ", "").upper() for m in E_RE.finditer(clean(text))]


def find_se_numbers(text):
    return [m.group(1).replace(" ", "").upper() for m in SE_RE.finditer(clean(text))]


def parse_dot_date(s):
    m = DATE_DOT_RE.search(s or "") or DATE_SLASH_RE.search(s or "")
    if not m:
        return None
    d, mo, y = map(int, m.groups())
    try:
        return datetime(y, mo, d)
    except ValueError:
        return None


def classify(subject, body):
    s, b = clean(subject), clean(body)
    if APPT_SUBJ_RE.search(s) or APPT_BODY_RE.search(b) or "appointment is confirmed" in b.lower():
        return "appointment"
    if DECISION_SUBJ_RE.search(s) or DECISION_BODY_RE.search(b):
        return "decision"
    return "unknown"


def parse_email(subject, body, sender="", received_at=None):
    """Return a normalised dict. kind is 'appointment', 'decision' or 'unknown'."""
    subject, body = clean(subject), clean(body or "")
    haystack = f"{subject}\n{body}"
    out = {
        "kind": classify(subject, body),
        "e_number": None, "se_number": None,
        "appointment_date": None, "appointment_time": None, "location": None,
        "confidence": 0.0, "warnings": [], "sender": sender or "",
        "received_at": (received_at or datetime.now()).isoformat(timespec="seconds"),
    }
    es = find_e_numbers(haystack)
    if es:
        out["e_number"] = es[0]
        if len(set(es)) > 1:
            out["warnings"].append(f"multiple E-numbers: {sorted(set(es))}")
    else:
        out["warnings"].append("no E-number found")
    ses = find_se_numbers(haystack)
    if ses:
        out["se_number"] = ses[0]

    if out["kind"] == "appointment":
        m = APPT_BODY_RE.search(body)
        if m:
            e, loc, date_s, time_s = m.group(1), m.group(2), m.group(3), m.group(4)
            out["e_number"] = e.replace(" ", "").upper()
            out["location"] = loc.strip()
        else:
            m = APPT_BODY_LOOSE_RE.search(haystack)
            if m:
                out["e_number"] = m.group(1).replace(" ", "").upper()
                date_s, time_s = m.group(2), m.group(3)
            else:
                date_s = time_s = None
                out["warnings"].append("appointment mail but date/time not parsed")
        if date_s:
            dt = parse_dot_date(date_s)
            if dt:
                out["appointment_date"] = dt.strftime("%d.%m.%Y")
            tm = TIME_RE.search(time_s or "")
            if tm:
                hh, mm = int(tm.group(1)), tm.group(2)
                ampm = (tm.group(3) or "").lower().replace(".", "")
                if ampm:
                    # "2.30PM" must be 14:30, not 02:30 (edge case found in an earlier build)
                    hh = hh % 12 + (12 if ampm.startswith("p") else 0)
                out["appointment_time"] = f"{hh:02d}:{mm}"
            out["confidence"] = 0.98 if (out["appointment_date"] and out["appointment_time"]) else 0.5
    elif out["kind"] == "decision":
        out["confidence"] = 0.95 if out["e_number"] else 0.4
    else:
        out["confidence"] = 0.0
        out["warnings"].append("unrecognised MAE e-mail; needs a person")
    if out["kind"] == "appointment" and not out["e_number"]:
        out["confidence"] = min(out["confidence"], 0.3)
    return out
