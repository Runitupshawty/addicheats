"""Tests for the local web UI server (app.py). No real scraping involved.

Run from this directory:  python3 -m unittest test_app
"""

import json
import threading
import unittest
import urllib.error
import urllib.request

import app
import scraper


def start_server(demo):
    server = app.create_server(port=0, demo=demo)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


def get(port, path):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}{path}", timeout=10) as r:
            body = r.read()
            status = r.status
            ctype = r.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        body = e.read()
        status = e.code
        ctype = e.headers.get("Content-Type", "")
    if "json" in ctype:
        return status, json.loads(body.decode())
    return status, body


class DemoServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = start_server(demo=True)
        cls.port = cls.server.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def test_health(self):
        status, data = get(self.port, "/api/health")
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])
        self.assertTrue(data["demo"])

    def test_index_served(self):
        status, body = get(self.port, "/")
        self.assertEqual(status, 200)
        self.assertIn(b"Marketplace Search", body)

    def test_static_served(self):
        status, body = get(self.port, "/static/style.css")
        self.assertEqual(status, 200)
        self.assertIn(b"--accent", body)

    def test_unknown_path_404(self):
        status, data = get(self.port, "/nope")
        self.assertEqual(status, 404)

    def test_search_requires_query(self):
        status, data = get(self.port, "/api/search?query=")
        self.assertEqual(status, 400)
        self.assertEqual(data["error"], "missing_query")

    def test_demo_search(self):
        status, data = get(self.port, "/api/search?query=drill")
        self.assertEqual(status, 200)
        self.assertTrue(data["demo"])
        self.assertGreater(data["count"], 0)
        first = data["listings"][0]
        for key in ("id", "title", "price", "url"):
            self.assertIn(key, first)

    def test_demo_price_filter_and_sort(self):
        status, data = get(self.port, "/api/search?query=x&max_price=100&sort=price_asc")
        self.assertEqual(status, 200)
        values = [l["price_value"] for l in data["listings"]]
        self.assertTrue(all(v <= 100 for v in values))
        self.assertEqual(values, sorted(values))


class RealModeErrorTests(unittest.TestCase):
    """Real (non-demo) mode with scraper.run_search stubbed out."""

    @classmethod
    def setUpClass(cls):
        cls.server = start_server(demo=False)
        cls.port = cls.server.server_address[1]
        cls.orig_run_search = scraper.run_search

    @classmethod
    def tearDownClass(cls):
        scraper.run_search = cls.orig_run_search
        cls.server.shutdown()
        cls.server.server_close()

    def test_login_wall_reported(self):
        def raise_wall(args, url):
            raise scraper.LoginWallError("login required")
        scraper.run_search = raise_wall
        status, data = get(self.port, "/api/search?query=drill")
        self.assertEqual(status, 502)
        self.assertEqual(data["error"], "login_wall")

    def test_listings_serialized(self):
        listing = scraper.Listing(
            id="42", title="Drill", price="$45", price_value=45.0,
            location="Oakland, CA",
            url="https://www.facebook.com/marketplace/item/42/",
            image=None, scraped_at="2026-01-01T00:00:00+00:00",
        )
        scraper.run_search = lambda args, url: [listing]
        status, data = get(self.port, "/api/search?query=drill&max_price=50")
        self.assertEqual(status, 200)
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["listings"][0]["title"], "Drill")


if __name__ == "__main__":
    unittest.main()
