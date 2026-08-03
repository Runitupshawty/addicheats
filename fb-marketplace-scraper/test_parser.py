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


class InlineSpanCardTests(unittest.TestCase):
    """Facebook renders card text as spans; when those spans are inline,
    innerText collapses the whole card onto one line."""

    def test_single_line_card(self):
        l = scraper.listing_from_card(card(
            text="$400 ThinkPad X1 Carbon Gen 9 Palo Alto, CA",
            alt="ThinkPad X1 Carbon Gen 9"))
        self.assertEqual(l.price, "$400")
        self.assertEqual(l.title, "ThinkPad X1 Carbon Gen 9")
        self.assertEqual(l.location, "Palo Alto, CA")

    def test_single_line_card_without_alt(self):
        l = scraper.listing_from_card(card(text="$60 Weber charcoal grill Fremont, CA"))
        self.assertEqual(l.price, "$60")
        self.assertEqual(l.title, "Weber charcoal grill")
        self.assertEqual(l.location, "Fremont, CA")

    def test_single_line_free_listing(self):
        l = scraper.listing_from_card(card(text="Free Patio table and chairs Hayward, CA"))
        self.assertEqual(l.price, "Free")
        self.assertEqual(l.title, "Patio table and chairs")
        self.assertEqual(l.location, "Hayward, CA")

    def test_single_line_discounted(self):
        l = scraper.listing_from_card(card(text="$1,200$1,500 Road bike San Jose, CA"))
        self.assertEqual(l.price, "$1,200")
        self.assertEqual(l.title, "Road bike")
        self.assertEqual(l.location, "San Jose, CA")

    def test_single_line_without_location(self):
        l = scraper.listing_from_card(card(text="$60 Weber charcoal grill"))
        self.assertEqual(l.title, "Weber charcoal grill")
        self.assertIsNone(l.location)

    def test_title_comma_is_not_mistaken_for_location(self):
        title, loc = scraper.split_title_location("Couch, must go by Friday")
        self.assertEqual(title, "Couch, must go by Friday")
        self.assertIsNone(loc)

    def test_multiline_card_still_wins(self):
        """The per-line path must keep working — the fallback is only a backstop."""
        l = scraper.listing_from_card(card(
            text="$45\nDeWalt 20V Max Drill\nOakland, CA", alt="DeWalt 20V Max Drill"))
        self.assertEqual(l.title, "DeWalt 20V Max Drill")
        self.assertEqual(l.location, "Oakland, CA")

    def test_capitalised_title_next_to_city_uses_alt_boundary(self):
        """"…Carbon Palo Alto, CA" is ambiguous by shape alone; the alt text
        pins where the title ends."""
        l = scraper.listing_from_card(card(
            text="$400 ThinkPad X1 Carbon Palo Alto, CA", alt="ThinkPad X1 Carbon"))
        self.assertEqual(l.title, "ThinkPad X1 Carbon")
        self.assertEqual(l.location, "Palo Alto, CA")

    def test_known_title_boundary_is_exact(self):
        title, loc = scraper.split_title_location(
            "Big Red Wagon Palo Alto, CA", known_title="Big Red Wagon")
        self.assertEqual(title, "Big Red Wagon")
        self.assertEqual(loc, "Palo Alto, CA")

    def test_place_name_word_cap(self):
        _, loc = scraper.split_title_location("grill Fremont, CA")
        self.assertEqual(loc, "Fremont, CA")

    def test_freezer_is_not_a_free_listing(self):
        l = scraper.listing_from_card(card(text="Freezer, works great\nOakland, CA"))
        self.assertIsNone(l.price)
        self.assertEqual(l.title, "Freezer, works great")

    def test_free_prefix_not_stripped_from_freestanding(self):
        self.assertEqual(scraper.strip_leading_prices("Freestanding lamp"),
                         "Freestanding lamp")

    def test_strip_leading_prices(self):
        self.assertEqual(scraper.strip_leading_prices("$1,200$1,500 Road bike"), "Road bike")
        self.assertEqual(scraper.strip_leading_prices("$45"), "")


class ErrorMessageTests(unittest.TestCase):
    def test_network_block_is_plain_english(self):
        msg = scraper.describe_error(
            RuntimeError("Page.goto: net::ERR_TUNNEL_CONNECTION_FAILED at https://…"))
        self.assertIn("Couldn't reach Facebook", msg)
        self.assertNotIn("ERR_TUNNEL", msg)

    def test_offline(self):
        msg = scraper.describe_error(RuntimeError("net::ERR_INTERNET_DISCONNECTED"))
        self.assertIn("online", msg)

    def test_missing_browser(self):
        msg = scraper.describe_error(RuntimeError("Executable doesn't exist at /x/chrome"))
        self.assertIn("playwright install", msg)

    def test_login_wall_passes_through(self):
        msg = scraper.describe_error(scraper.LoginWallError("needs a login"))
        self.assertEqual(msg, "needs a login")

    def test_unknown_error_is_still_readable(self):
        msg = scraper.describe_error(ValueError("something odd"))
        self.assertIn("ValueError", msg)


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
