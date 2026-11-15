#!/usr/bin/env python3
"""Local English Tutor server and voluntary Steam guard for Windows.
Python 3.9+; no third-party dependencies. Bound only to 127.0.0.1.
"""
import datetime as dt
import json
import mimetypes
import os
from pathlib import Path
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
DATA_HOME = Path(os.environ.get("APPDATA") or Path.home()) / "EnglishTutor"
LOCK_FILE = DATA_HOME / "steam_status.json"
HOST, PORT = "127.0.0.1", 8765
SAFE_FILES = {"index.html", "style.css", "lessons.js", "app.js"}
WINDOWS = os.name == "nt"

def load_status():
    try:
        data = json.loads(LOCK_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError, TypeError):
        return {}

def unlocked_today():
    return load_status().get("unlocked_on") == dt.date.today().isoformat()

def guard_loop():
    """Close the Steam process until the day's lesson is completed."""
    no_window = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    while True:
        if WINDOWS and not unlocked_today():
            try:
                result = subprocess.run(
                    ["tasklist", "/FI", "IMAGENAME eq steam.exe", "/FO", "CSV", "/NH"],
                    capture_output=True, timeout=8, creationflags=no_window
                )
                if b"steam.exe" in result.stdout.lower():
                    subprocess.run(
                        ["taskkill", "/F", "/IM", "steam.exe"],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                        timeout=8, creationflags=no_window
                    )
            except (OSError, subprocess.SubprocessError):
                pass
        time.sleep(4)

class Handler(BaseHTTPRequestHandler):
    def respond(self, status, content, content_type="application/json; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def json(self, status, payload):
        self.respond(status, json.dumps(payload, ensure_ascii=False).encode("utf-8"))

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/guard":
            return self.json(200, {
                "unlocked": unlocked_today(),
                "today": dt.date.today().isoformat(),
                "supported": WINDOWS
            })
        if path == "/":
            path = "/index.html"
        name = path.lstrip("/")
        if name not in SAFE_FILES:
            return self.json(404, {"error": "Not found"})
        try:
            raw = (HERE / name).read_bytes()
        except OSError:
            return self.json(404, {"error": "Missing file"})
        content_type = mimetypes.guess_type(name)[0] or "text/plain"
        self.respond(200, raw, content_type + "; charset=utf-8")

    def do_POST(self):
        if urlsplit(self.path).path != "/api/unlock":
            return self.json(404, {"error": "Not found"})
        origin = self.headers.get("Origin", "")
        if origin not in {"", "http://127.0.0.1:8765", "http://localhost:8765"}:
            return self.json(403, {"error": "Wrong origin"})
        if not self.headers.get("Content-Type", "").startswith("application/json"):
            return self.json(415, {"error": "JSON required"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 2048:
                raise ValueError("Invalid size")
            body = json.loads(self.rfile.read(length))
            valid = (
                isinstance(body, dict)
                and body.get("date") == dt.date.today().isoformat()
                and body.get("completed") is True
                and isinstance(body.get("minutes"), (int, float))
                and not isinstance(body.get("minutes"), bool)
                and body["minutes"] >= 30
            )
            if not valid:
                return self.json(403, {"error": "Lesson not completed"})
            DATA_HOME.mkdir(parents=True, exist_ok=True)
            payload = {"unlocked_on": dt.date.today().isoformat(), "created_at": dt.datetime.now().isoformat()}
            temporary = LOCK_FILE.with_suffix(".tmp")
            temporary.write_text(json.dumps(payload), encoding="utf-8")
            temporary.replace(LOCK_FILE)
            self.json(200, {"unlocked": True})
        except (ValueError, TypeError, OSError, json.JSONDecodeError):
            return self.json(400, {"error": "Invalid request"})

    def log_message(self, fmt, *args):
        if self.path.startswith("/api/"):
            return
        super().log_message(fmt, *args)

def main():
    if not WINDOWS:
        print("Steam guard works only on Windows; lessons work anywhere.")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    threading.Thread(target=guard_loop, daemon=True).start()
    print(f"English Tutor: http://{HOST}:{PORT}/")
    print("Steam stays locked until a 30-minute lesson is completed today.")
    print("Minimize this window, but do not close it or protection will stop.")
    try:
        server.serve_forever(poll_interval=0.4)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == "__main__":
    main()
