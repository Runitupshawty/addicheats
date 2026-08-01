"""End-to-end test of the browser pipeline against a local HTML fixture.

Exercises launch → navigate → collect cards → parse, without touching
facebook.com. Skips itself if Playwright or a Chromium build isn't available.

Run from this directory:  python3 -m unittest test_scrape_local
"""

import argparse
import tempfile
import unittest
from pathlib import Path

import scraper

FIXTURE = """<!doctype html>
<html><body>
<a href="/marketplace/item/111111111111111/?ref=search">
  <img alt="DeWalt 20V Max Drill" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
  <div>$45</div><div>DeWalt 20V Max Drill</div><div>Oakland, CA</div>
</a>
<a href="/marketplace/item/222222222222222/">
  <div>Free</div><div>Sofa bed</div><div>Berkeley, CA</div>
</a>
<a href="/marketplace/item/333333333333333/">
  <img alt="Road bike" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
  <div><span>$1,200</span><span>$1,500</span></div>
  <div>Road bike</div><div>San Jose, CA</div>
</a>
<a href="/marketplace/category/tools">not an item</a>
</body></html>
"""


class LocalScrapeTest(unittest.TestCase):
    def test_scrape_local_fixture(self):
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            self.skipTest("playwright not installed")

        args = argparse.Namespace(headed=False, proxy=None, browser_path=None,
                                  cookies=None, user_agent=None, timeout=30)
        with tempfile.TemporaryDirectory() as td:
            fixture = Path(td) / "fixture.html"
            fixture.write_text(FIXTURE)
            with sync_playwright() as p:
                try:
                    browser = scraper._launch(p, args)
                except Exception as e:
                    self.skipTest(f"no usable Chromium: {e}")
                try:
                    page = browser.new_page()
                    listings = scraper.scrape_search(
                        page, fixture.as_uri(), limit=10, scrolls=0, timeout_s=30)
                finally:
                    browser.close()

        self.assertEqual(len(listings), 3)
        by_id = {l.id: l for l in listings}
        drill = by_id["111111111111111"]
        self.assertEqual(drill.title, "DeWalt 20V Max Drill")
        self.assertEqual(drill.price_value, 45.0)
        self.assertEqual(drill.location, "Oakland, CA")
        self.assertEqual(by_id["222222222222222"].price, "Free")
        bike = by_id["333333333333333"]
        self.assertEqual(bike.price, "$1,200")
        self.assertEqual(bike.price_value, 1200.0)


if __name__ == "__main__":
    unittest.main()
