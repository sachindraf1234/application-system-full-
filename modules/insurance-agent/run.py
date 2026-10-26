"""Start the Insurance AI Agent.
  python run.py            -> dashboard only        http://127.0.0.1:5000
  python run.py --watch    -> dashboard + inbox auto-watcher (recommended for daily use)
"""
import os
import sys
from app import create_app

app = create_app()

if __name__ == "__main__":
    if "--watch" in sys.argv:
        from app.scheduler import start_watcher
        start_watcher(app)
        print("👀 Inbox watcher ON — insurer replies & embassy appointments will notify you.")
    port = int(os.getenv("PORT", "5000"))
    print(f"🛡 Insurance AI Agent → http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
