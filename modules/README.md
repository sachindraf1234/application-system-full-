# GitHub modules

Source code vendored from these repositories and shown as sections in the main app:

| Folder | Source repo | Section in app | Status |
|---|---|---|---|
| `insurance-agent/` | sachindraf1234/insurance-agent | Insurance AI Agent | Runnable web app (Flask), started from the section |
| `slbfe-automation/` | sachindraf1234/training-and-fbr-checking-system | SLBFE Training & FBR | CLI suite (Playwright); no web UI yet |
| `transarabian-agent/` | sachindraf1234/transarabian-agent | Trans Arabian WhatsApp Agent | Source incomplete (missing `config`) |
| e-v | sachindraf1234/e-v | — | Already integrated as **E-Visa Application** in the main app; not duplicated here |

## What was NOT copied (on purpose)
Personal data, credentials and binaries stay out of Git: applicant passports/police reports, databases (`*.db`), uploads, generated output, OCR/ML model binaries, the ngrok archive and ngrok config, the Chrome bundle, and `config.txt` / `env.txt`. Test fixtures and scripts that contained real applicant names or passport numbers were removed.

## Secrets
Put secrets in `modules/<name>/.env` (gitignored). Example for the insurance agent:

```
MAIL_ADDRESS=you@gmail.com
MAIL_PASSWORD=<gmail app password>
```

Never commit `.env`. Rotate any credential that was pasted into chat or shared in plain text.

## Running the insurance module
```bash
cd modules/insurance-agent
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```
Then, on the main server, set `MODULES_ENABLED=true` and press **Start** in its section (port 5010, proxied at `/module/insurance-agent/`).
