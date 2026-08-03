"""End-to-end test of the browser pipeline against a local HTML fixture.

Exercises launch → navigate → collect cards → parse, without touching
facebook.com. Skips itself if Playwright or a Chromium build isn't available.

The fixture mirrors how Marketplace builds a card: an anchor wrapping the
image plus a stack of text spans. Crucially it covers both renderings of
those spans — block (each text run on its own innerText line) and inline
(the whole card collapsing onto ONE line). Only a real browser computes
innerText, so the inline case can't be caught by unit tests alone.

Run from this directory:  python3 -m unittest test_scrape_local
"""

import argparse
import tempfile
import unittest
from pathlib import Path

import scraper

# .blk makes a card's spans block-level; without it they stay inline.
FIXTURE = """<!doctype html>
<html><head><style>
  .blk span[dir="auto"] { display: block; }
  a { display: block; width: 240px; }
</style></head><body>

<a class="blk" href="/marketplace/item/111111111111111/?ref=search">
  <img alt="DeWalt 20V Max Drill" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
  <div><span><span dir="auto">$45</span></span>
       <span><span dir="auto">DeWalt 20V Max Drill</span></span>
       <span><span dir="auto">Oakland, CA</span></span></div>
</a>

<a class="blk" href="/marketplace/item/222222222222222/">
  <div><span><span dir="auto">Free</span></span>
       <span><span dir="auto">Sofa bed</span></span>
       <span><span dir="auto">Berkeley, CA</span></span></div>
</a>

<!-- discounted: current price then struck-through original -->
<a class="blk" href="/marketplace/item/333333333333333/">
  <img alt="Road bike" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
  <div><span><span dir="auto">$1,200</span><span dir="auto">$1,500</span></span>
       <span><span dir="auto">Road bike</span></span>
       <span><span dir="auto">San Jose, CA</span></span></div>
</a>

<!-- a price inside the title must not be read as the price -->
<a class="blk" href="/marketplace/item/444444444444444/">
  <img alt="Couch - paid $900 new" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
  <div><span><span dir="auto">$250</span></span>
       <span><span dir="auto">Couch - paid $900 new</span></span>
       <span><span dir="auto">Berkeley, CA</span></span></div>
</a>

<!-- INLINE spans: innerText collapses this card onto a single line -->
<a href="/marketplace/item/555555555555555/">
  <img alt="ThinkPad X1 Carbon" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
  <div><span><span dir="auto">$400</span></span>
       <span><span dir="auto">ThinkPad X1 Carbon</span></span>
       <span><span dir="auto">Palo Alto, CA</span></span></div>
</a>

<!-- inline AND no alt text: nothing to fall back on but the collapsed line -->
<a href="/marketplace/item/666666666666666/">
  <img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
  <div><span><span dir="auto">$60</span></span>
       <span><span dir="auto">Weber charcoal grill</span></span>
       <span><span dir="auto">Fremont, CA</span></span></div>
</a>

<!-- a second anchor to an item already listed above must collapse into one -->
<a href="/marketplace/item/111111111111111/?ref=dup"><img
   alt="DeWalt 20V Max Drill" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></a>

<a href="/marketplace/category/tools">not an item</a>
<a href="/marketplace/you/selling">also not an item</a>
</body></html>
"""


class LocalScrapeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            raise unittest.SkipTest("playwright not installed")

        args = argparse.Namespace(headed=False, proxy=None, browser_path=None,
                                  cookies=None, user_agent=None, timeout=30)
        with tempfile.TemporaryDirectory() as td:
            fixture = Path(td) / "fixture.html"
            fixture.write_text(FIXTURE)
            with sync_playwright() as p:
                try:
                    browser = scraper._launch(p, args)
                except Exception as e:
                    raise unittest.SkipTest(f"no usable Chromium: {e}")
                try:
                    page = browser.new_page()
                    listings = scraper.scrape_search(
                        page, fixture.as_uri(), limit=20, scrolls=0, timeout_s=30)
                finally:
                    browser.close()
        cls.listings = listings
        cls.by_id = {l.id: l for l in listings}

    def test_duplicate_anchors_collapse_and_noise_ignored(self):
        self.assertEqual(len(self.listings), 6)

    def test_block_spans_card(self):
        l = self.by_id["111111111111111"]
        self.assertEqual(l.price, "$45")
        self.assertEqual(l.price_value, 45.0)
        self.assertEqual(l.title, "DeWalt 20V Max Drill")
        self.assertEqual(l.location, "Oakland, CA")
        self.assertEqual(l.url, "https://www.facebook.com/marketplace/item/111111111111111/")

    def test_free_listing(self):
        l = self.by_id["222222222222222"]
        self.assertEqual(l.price, "Free")
        self.assertEqual(l.price_value, 0.0)
        self.assertEqual(l.title, "Sofa bed")

    def test_discounted_takes_current_price(self):
        l = self.by_id["333333333333333"]
        self.assertEqual(l.price, "$1,200")
        self.assertEqual(l.price_value, 1200.0)
        self.assertEqual(l.location, "San Jose, CA")

    def test_price_inside_title_ignored(self):
        l = self.by_id["444444444444444"]
        self.assertEqual(l.price, "$250")
        self.assertEqual(l.title, "Couch - paid $900 new")

    def test_inline_spans_card(self):
        """Regression: innerText puts this whole card on one line."""
        l = self.by_id["555555555555555"]
        self.assertEqual(l.price, "$400")
        self.assertEqual(l.title, "ThinkPad X1 Carbon")
        self.assertEqual(l.location, "Palo Alto, CA")

    def test_inline_spans_card_without_alt(self):
        l = self.by_id["666666666666666"]
        self.assertEqual(l.price, "$60")
        self.assertEqual(l.title, "Weber charcoal grill")
        self.assertEqual(l.location, "Fremont, CA")


if __name__ == "__main__":
    unittest.main()
