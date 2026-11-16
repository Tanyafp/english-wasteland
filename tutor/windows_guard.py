#!/usr/bin/env python3
"""English Tutor local-only web server. No game or Steam controls.
Kept under its old filename for backwards-compatible launch scripts.
Python 3.9+, no third-party dependencies.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from functools import partial
import os

HERE = Path(__file__).resolve().parent
ALLOWED = {"index.html","style.css","lessons.js","lessons-extra.js","schedule.js","app.js"}

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?",1)[0].split("#",1)[0].lstrip("/")
        if not path: path = "index.html"
        if path not in ALLOWED:
            self.send_error(404, "Not found")
            return
        self.path = "/"+path
        return super().do_GET()

    def do_POST(self):
        self.send_error(405,"No write endpoints")

    def end_headers(self):
        self.send_header("Cache-Control","no-store")
        self.send_header("X-Content-Type-Options","nosniff")
        return super().end_headers()

def main():
    server=ThreadingHTTPServer(("127.0.0.1",8765),partial(Handler,directory=str(HERE)))
    print("English Tutor available at http://127.0.0.1:8765/")
    print("Steam and other games are NOT blocked by this program.")
    print("This window serves local lessons only. Closing it stops the local site.")
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()

if __name__=="__main__":
    main()
