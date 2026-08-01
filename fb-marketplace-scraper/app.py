#!/usr/bin/env python3
"""Local web UI for the Marketplace scraper.

Run `python3 app.py` (or double-click the Start launcher): it serves a small
search page at http://127.0.0.1:8977, opens your browser to it, and runs the
scraper behind a JSON endpoint. Everything stays on your machine.

`python3 app.py --demo` serves canned sample listings instead of scraping —
handy for previewing the interface.
"""

from __future__ import annotations

import argparse
import json
import sys
import threading
import urllib.request
import webbrowser
from dataclasses import asdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import scraper

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
COOKIES_FILE = ROOT / "cookies.json"
DEFAULT_PORT = 8977

SEARCH_LOCK = threading.Lock()

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
}

DEMO_LISTINGS = [
    {"id": "100000000000001", "title": "DeWalt 20V Max cordless drill (like new)",
     "price": "$45", "price_value": 45.0, "location": "Oakland, CA"},
    {"id": "100000000000002", "title": "3-seat sofa, pet-free home",
     "price": "$250", "price_value": 250.0, "location": "San Jose, CA"},
    {"id": "100000000000003", "title": "iPhone 12, 128 GB, unlocked",
     "price": "$180", "price_value": 180.0, "location": "Fremont, CA"},
    {"id": "100000000000004", "title": "Specialized Allez road bike 54cm",
     "price": "$620", "price_value": 620.0, "location": "Berkeley, CA"},
    {"id": "100000000000005", "title": "Patio table + 4 chairs — pickup only",
     "price": "Free", "price_value": 0.0, "location": "Hayward, CA"},
    {"id": "100000000000006", "title": "ThinkPad X1 Carbon gen 9, i7/16GB",
     "price": "$400", "price_value": 400.0, "location": "Palo Alto, CA"},
    {"id": "100000000000007", "title": "Fender acoustic guitar with case",
     "price": "$95", "price_value": 95.0, "location": "San Mateo, CA"},
    {"id": "100000000000008", "title": "KitchenAid stand mixer, works great",
     "price": "$120", "price_value": 120.0, "location": "Walnut Creek, CA"},
]
for _l in DEMO_LISTINGS:
    _l.setdefault("image", None)
    _l.setdefault("url", f"https://www.facebook.com/marketplace/item/{_l['id']}/")
    _l.setdefault("scraped_at", "2026-01-01T00:00:00+00:00")


def make_scrape_args(q: dict) -> argparse.Namespace:
    def geti(name, lo=None, hi=None):
        raw = (q.get(name) or "").strip()
        if not raw:
            return None
        try:
            value = int(raw)
        except ValueError:
            return None
        if lo is not None:
            value = max(lo, value)
        if hi is not None:
            value = min(hi, value)
        return value

    days = geti("days")
    return argparse.Namespace(
        query=(q.get("query") or "").strip(),
        location=(q.get("location") or "").strip() or None,
        min_price=geti("min_price", lo=0),
        max_price=geti("max_price", lo=0),
        days=days if days in (1, 7, 30) else None,
        sort=q.get("sort") if q.get("sort") in scraper.SORT_TOKENS else "newest",
        limit=geti("limit", lo=1, hi=100) or 40,
        scrolls=3,
        cookies=str(COOKIES_FILE) if COOKIES_FILE.exists() else None,
        headed=False, browser_path=None, proxy=None, user_agent=None, timeout=60,
    )


def demo_results(args: argparse.Namespace) -> list[dict]:
    listings = [
        l for l in DEMO_LISTINGS
        if (args.max_price is None or (l["price_value"] or 0) <= args.max_price)
        and (args.min_price is None or (l["price_value"] or 0) >= args.min_price)
    ]
    if args.sort == "price_asc":
        listings.sort(key=lambda l: l["price_value"] or 0)
    elif args.sort == "price_desc":
        listings.sort(key=lambda l: l["price_value"] or 0, reverse=True)
    return listings


class Handler(BaseHTTPRequestHandler):
    server_version = "MarketplaceSearchUI/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *fmt_args):  # keep the console calm for non-technical users
        if "/api/" in (self.path or ""):
            sys.stderr.write(f"  {self.address_string()} {fmt % fmt_args}\n")

    # -- plumbing ----------------------------------------------------------
    def _send(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_json(self, status: int, obj: dict) -> None:
        self._send(status, json.dumps(obj, ensure_ascii=False).encode(),
                   "application/json; charset=utf-8")

    def _send_file(self, path: Path) -> None:
        ctype = CONTENT_TYPES.get(path.suffix.lower(), "application/octet-stream")
        self._send(200, path.read_bytes(), ctype)

    # -- routes ------------------------------------------------------------
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path in ("/", "/index.html"):
            return self._send_file(STATIC / "index.html")
        if parsed.path.startswith("/static/"):
            f = STATIC / Path(parsed.path).name  # flat lookup — no traversal
            if f.is_file():
                return self._send_file(f)
            return self._send_json(404, {"error": "not_found"})
        if parsed.path == "/api/health":
            return self._send_json(200, {"ok": True, "demo": bool(getattr(self.server, "demo", False))})
        if parsed.path == "/api/search":
            q = {k: v[0] for k, v in parse_qs(parsed.query).items()}
            return self._api_search(q)
        return self._send_json(404, {"error": "not_found"})

    def _api_search(self, q: dict) -> None:
        args = make_scrape_args(q)
        if not args.query:
            return self._send_json(400, {
                "error": "missing_query",
                "message": "Type something to search for first.",
            })
        url = scraper.build_search_url(args)
        if getattr(self.server, "demo", False):
            listings = demo_results(args)
            return self._send_json(200, {
                "demo": True, "url": url, "count": len(listings), "listings": listings,
            })
        if not SEARCH_LOCK.acquire(blocking=False):
            return self._send_json(429, {
                "error": "busy",
                "message": "A search is already running — wait a few seconds for it to finish.",
            })
        try:
            found = scraper.run_search(args, url)
            self._send_json(200, {
                "url": url, "count": len(found),
                "listings": [asdict(l) for l in found],
            })
        except scraper.LoginWallError as e:
            self._send_json(502, {"error": "login_wall", "message": str(e)})
        except Exception as e:  # surface anything else as a friendly message
            self._send_json(502, {"error": "scrape_failed",
                                  "message": f"{type(e).__name__}: {e}"})
        finally:
            SEARCH_LOCK.release()


def create_server(port: int = 0, demo: bool = False) -> ThreadingHTTPServer:
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.demo = demo
    return server


def _existing_instance(port: int) -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=1) as r:
            return json.loads(r.read().decode()).get("ok") is True
    except Exception:
        return False


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Local web UI for the Marketplace scraper.")
    ap.add_argument("--port", type=int, default=DEFAULT_PORT)
    ap.add_argument("--demo", action="store_true",
                    help="serve sample listings instead of scraping (UI preview)")
    ap.add_argument("--no-browser", action="store_true",
                    help="don't open a browser tab automatically")
    args = ap.parse_args(argv)

    if not (STATIC / "index.html").is_file():
        sys.exit("The 'static' folder is missing — keep app.py inside the "
                 "fb-marketplace-scraper folder it came in.")

    if _existing_instance(args.port):
        url = f"http://127.0.0.1:{args.port}/"
        print(f"Marketplace Search is already running — opening {url}")
        if not args.no_browser:
            webbrowser.open(url)
        return 0

    port = args.port
    server = None
    for _ in range(20):
        try:
            server = create_server(port, demo=args.demo)
            break
        except OSError:
            port += 1
    if server is None:
        sys.exit("Could not find a free port to run on.")

    url = f"http://127.0.0.1:{port}/"
    print()
    print(f"  Marketplace Search is running:  {url}")
    if args.demo:
        print("  (demo mode — showing sample data, not real listings)")
    print("  Keep this window open while you use it.")
    print("  Close it (or press Ctrl+C) when you're done.")
    print()
    if not args.no_browser:
        threading.Timer(0.8, webbrowser.open, args=(url,)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nBye!")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
