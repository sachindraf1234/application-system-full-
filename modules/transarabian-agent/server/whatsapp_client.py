"""DRY-RUN WhatsApp client for local testing.

The original repository does not contain its WhatsApp client module, so this stands in for it.
It NEVER calls the WhatsApp Cloud API. Every send is recorded to data/dry_run_outbox.jsonl and
returns a fake message id, so the bot's flow can be exercised without messaging anyone.
Replace this file with a real client only after the credentials have been rotated.
"""
import json
import os
import uuid
from datetime import datetime, timezone

OUTBOX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "dry_run_outbox.jsonl")


class DryRunClient:
    # Counters read by the /stats endpoint.
    sent_this_hour = 0
    sent_this_day = 0
    total_sent = 0

    def _record(self, kind, to, payload):
        os.makedirs(os.path.dirname(OUTBOX), exist_ok=True)
        msg_id = f"dryrun-{uuid.uuid4().hex[:12]}"
        self.total_sent += 1
        self.sent_this_hour += 1
        self.sent_this_day += 1
        entry = {"at": datetime.now(timezone.utc).isoformat(), "kind": kind, "to": to, "id": msg_id, **payload}
        with open(OUTBOX, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        return {"status": "dry_run", "response": {"messages": [{"id": msg_id}]}}

    def mark_as_read(self, msg_id, *args, **kwargs):
        return {"status": "dry_run", "response": {}}

    def send_text(self, to, text, human_like=True, *args, **kwargs):
        return self._record("text", to, {"text": text})

    def send_document(self, to, link, filename, caption="", human_like=True, *args, **kwargs):
        return self._record("document", to, {"link": link, "filename": filename, "caption": caption})

    def send_template_text(self, to, template_name, language, variables=None, *args, **kwargs):
        return self._record("template_text", to, {"template": template_name, "language": language, "variables": variables})

    def send_template_document(self, to, template_name, link, filename, language, variables=None, *args, **kwargs):
        return self._record("template_document", to, {"template": template_name, "link": link, "filename": filename, "language": language, "variables": variables})

    def send_notification(self, to, *args, **kwargs):
        return self._record("notification", to, {"args": [str(a) for a in args], **{k: str(v) for k, v in kwargs.items()}})


client = DryRunClient()
