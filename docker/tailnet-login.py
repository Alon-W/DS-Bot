#!/usr/bin/env python3
"""Logs this tailnet's own users in to DS Bot with no token to copy.

tailscale serve sends /auto-login here and sets Tailscale-User-Login for a logged-in
user, never for a tagged machine. Listens on loopback, out of the container's reach.
"""
import json
import re
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer

LISTEN = ("127.0.0.1", 13081)
CONTAINER = "ds-bot-ds-bot-1"


def token_from(log):
    found = re.findall(r"[?&]token=([^\s&]+)", log)
    return found[-1] if found else None


class Login(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if not self.headers.get("Tailscale-User-Login"):
            return self.send_error(403)
        log = subprocess.run(["sudo", "-n", "docker", "logs", CONTAINER], capture_output=True, text=True, timeout=20)
        token = token_from(log.stdout + log.stderr)
        if token is None:
            return self.send_error(503)
        # A page, not a redirect: DS Bot's cookie is SameSite=Strict, and a browser withholds
        # it at the end of a redirect chain that started in another app.
        body = ("<!doctype html><script>location.replace(%s)</script>" % json.dumps("/?token=" + token)).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    assert token_from("a http://x/?token=old\nb http://x/?token=new z") == "new"
    HTTPServer(LISTEN, Login).serve_forever()
