"""Unit tests for the pure parsing/URL helpers (no browser needed).

Run from this directory:  python3 -m unittest
"""

import argparse
import unittest

import scraper


def card(href="/marketplace/item/1234567890/?ref=search", text="", alt=None, img=None):
    return {"href": href, "text": text, "alt": alt, "img": img}


class ParsePriceTests(unittest.TestCase):
    def test_simple_price(self):
        self.assertEqual(scraper.parse_price("$45"), ("$45", 45.0))

    def test_thousands(self):
        self.assertEqual(scraper.parse_price("$1,200"), ("$1,200", 1200.0))

    def test_free(self):
        self.assertEqual(scraper.parse_price("Free"), ("Free", 0.0))

    def test_discounted_double_price_takes_current(self):
        raw, value = scraper.parse_price("$1,200$1,500")
        self.assertEqual((raw, value), ("$1,200", 1200.0))

    def test_currency_prefix(self):
        raw, value = scraper.parse_price("CA$300")
        self.assertEqual((raw, value), ("CA$300", 300.0))

    def test_european_thousands_dots(self):
        raw, value = scraper.parse_price("€1.200.000")
        self.assertEqual(value, 1200000.0)

    def test_title_mentioning_price_is_not_a_price_line(self):
        self.assertEqual(scraper.parse_price("Couch, paid $500 new"), (None, None))

    def test_plain_text(self):
        self.assertEqual(scraper.parse_price("Oakland, CA"), (None, None))


class ListingFromCardTests(unittest.TestCase):
    def test_standard_card(self):
        l = scraper.listing_from_card(card(
            text="$45\nDeWalt 20V Max Drill\nOakland, CA",
            alt="DeWalt 20V Max Drill",
            img="https://example.com/x.jpg",
        ))
        self.assertEqual(l.id, "1234567890")
        self.assertEqual(l.price, "$45")
        self.assertEqual(l.price_value, 45.0)
        self.assertEqual(l.title, "DeWalt 20V Max Drill")
        self.assertEqual(l.location, "Oakland, CA")
        self.assertEqual(l.url, "https://www.facebook.com/marketplace/item/1234567890/")
        self.assertEqual(l.image, "https://example.com/x.jpg")

    def test_title_from_lines_when_no_alt(self):
        l = scraper.listing_from_card(card(text="$45\nDeWalt 20V Max Drill\nOakland, CA"))
        self.assertEqual(l.title, "DeWalt 20V Max Drill")

    def test_free_listing(self):
        l = scraper.listing_from_card(card(text="Free\nSofa bed\nBerkeley, CA"))
        self.assertEqual(l.price, "Free")
        self.assertEqual(l.price_value, 0.0)
        self.assertEqual(l.title, "Sofa bed")

    def test_vehicle_card_with_mileage(self):
        l = scraper.listing_from_card(card(
            text="$8,500\n2016 Honda Civic\nSan Jose, CA\n120K km"))
        self.assertEqual(l.price_value, 8500.0)
        self.assertEqual(l.title, "2016 Honda Civic")
        self.assertEqual(l.location, "San Jose, CA")

    def test_badge_before_price(self):
        l = scraper.listing_from_card(card(text="Pending\n$45\nDrill\nOakland, CA"))
        self.assertEqual(l.price, "$45")
        self.assertEqual(l.title, "Drill")

    def test_no_price(self):
        l = scraper.listing_from_card(card(text="Mystery item\nOakland, CA"))
        self.assertIsNone(l.price)
        self.assertEqual(l.title, "Mystery item")
        self.assertEqual(l.location, "Oakland, CA")

    def test_non_item_href_rejected(self):
        self.assertIsNone(scraper.listing_from_card(card(href="/marketplace/category/tools")))


class UrlTests(unittest.TestCase):
    def _args(self, **kw):
        base = dict(query="dewalt drill", location=None, min_price=None,
                    max_price=None, days=None, sort="newest")
        base.update(kw)
        return argparse.Namespace(**base)

    def test_basic(self):
        url = scraper.build_search_url(self._args())
        self.assertEqual(
            url,
            "https://www.facebook.com/marketplace/search?"
            "query=dewalt+drill&sortBy=creation_time_descend",
        )

    def test_full(self):
        url = scraper.build_search_url(self._args(
            location="San Francisco", min_price=10, max_price=100, days=7))
        self.assertIn("/marketplace/sanfrancisco/search?", url)
        self.assertIn("minPrice=10", url)
        self.assertIn("maxPrice=100", url)
        self.assertIn("daysSinceListed=7", url)

    def test_relevance_omits_sort(self):
        url = scraper.build_search_url(self._args(sort="relevance"))
        self.assertNotIn("sortBy", url)

    def test_numeric_location_passthrough(self):
        url = scraper.build_search_url(self._args(location="108659242498155"))
        self.assertIn("/marketplace/108659242498155/search?", url)


class CookieTests(unittest.TestCase):
    def test_extension_export_normalized(self, tmp=None):
        import json, tempfile, pathlib
        raw = [{"name": "c_user", "value": "123", "domain": ".facebook.com",
                "path": "/", "expirationDate": 1893456000.5,
                "sameSite": "no_restriction", "secure": True, "httpOnly": False}]
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
            json.dump(raw, fh)
        kind, cookies = scraper.load_cookies(pathlib.Path(fh.name))
        self.assertEqual(kind, "cookies")
        self.assertEqual(cookies[0]["expires"], 1893456000)
        self.assertEqual(cookies[0]["sameSite"], "None")


if __name__ == "__main__":
    unittest.main()
