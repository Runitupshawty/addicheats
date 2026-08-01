#!/usr/bin/env python3
"""Search and watch Facebook Marketplace listings from the command line.

This is a personal-use tool: it drives a real Chromium browser (via
Playwright) to load a Marketplace search page, parses the listing cards on
it, and prints or exports them. `watch` mode re-runs the search on an
interval and reports listings it hasn't seen before, optionally pinging a
Discord/Slack webhook.

Read README.md — especially the Terms of Service note — before using.
"""

from __future__ import annotations

import argparse
import csv
import dataclasses
import glob
import io
import json
import os
import random
import re
import sys
import time
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

BASE_URL = "https://www.facebook.com"
ITEM_HREF_RE = re.compile(r"/marketplace/item/(\d+)")
# A price token at the start of a line: optional currency-prefix letters
# ("CA$", "MX$"), a currency symbol, then digits with separators.
PRICE_TOKEN_RE = re.compile(r"(?:[A-Z]{0,3}\$|€|£|¥|₹)\s?\d[\d,.  ]*")
LOCATION_RE = re.compile(r"^[^\d]+,\s?\S+")

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

SORT_TOKENS = {
    "newest": "creation_time_descend",
    "price_asc": "price_ascend",
    "price_desc": "price_descend",
    "distance": "distance_ascend",
    "relevance": None,
}

MIN_WATCH_INTERVAL = 120
STATE_MAX_SEEN_PER_SEARCH = 5000

COLLECT_CARDS_JS = """
() => Array.from(document.querySelectorAll('a[href*="/marketplace/item/"]')).map((a) => {
  const img = a.querySelector('img');
  return {
    href: a.getAttribute('href') || '',
    text: a.innerText || '',
    alt: img ? (img.getAttribute('alt') || null) : null,
    img: img ? (img.getAttribute('src') || null) : null,
  };
})
"""


class LoginWallError(RuntimeError):
    """Facebook refused to show results without a logged-in session."""


@dataclass
class Listing:
    id: str
    title: Optional[str]
    price: Optional[str]
    price_value: Optional[float]
    location: Optional[str]
    url: str
    image: Optional[str]
    scraped_at: str


FIELDS = [f.name for f in dataclasses.fields(Listing)]


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# --------------------------------------------------------------------------
# Parsing
# --------------------------------------------------------------------------

def _to_number(s: str) -> Optional[float]:
    s = s.strip().replace(" ", "").replace(" ", "")
    if re.fullmatch(r"\d{1,3}(\.\d{3})+", s):  # "1.200.000" thousands style
        s = s.replace(".", "")
    else:
        s = s.replace(",", "")
    try:
        return float(s)
    except ValueError:
        return None


def parse_price(line: str) -> tuple[Optional[str], Optional[float]]:
    """Return (raw, numeric) if the line *starts with* a price, else (None, None).

    Requiring the price at the start keeps titles that merely mention "$50"
    from being mistaken for the price line. A discounted card renders as
    "$1,200$1,500" on one line; the first token is the current price.
    """
    line = line.strip()
    if line.lower() == "free":
        return "Free", 0.0
    m = PRICE_TOKEN_RE.match(line)
    if not m:
        return None, None
    raw = m.group(0).strip()
    return raw, _to_number(re.sub(r"^[^\d]*", "", raw))


def listing_from_card(card: dict) -> Optional[Listing]:
    """Build a Listing from one search-result anchor's href/innerText/img."""
    m = ITEM_HREF_RE.search(card.get("href") or "")
    if not m:
        return None
    item_id = m.group(1)
    lines = [ln.strip() for ln in (card.get("text") or "").splitlines() if ln.strip()]

    price_raw = price_value = None
    price_idx: Optional[int] = None
    for i, line in enumerate(lines):
        raw, value = parse_price(line)
        if raw is not None:
            price_raw, price_value, price_idx = raw, value, i
            break

    # The listing image's alt text is the title in the current layout; fall
    # back to the first non-price line after the price.
    title = (card.get("alt") or "").strip() or None
    if title is None:
        candidates = lines[price_idx + 1:] if price_idx is not None else lines
        title = next((ln for ln in candidates if parse_price(ln)[0] is None), None)

    location = None
    for line in reversed(lines):
        if line == title or (price_idx is not None and line == lines[price_idx]):
            continue
        if len(line) < 60 and LOCATION_RE.match(line):
            location = line
            break

    return Listing(
        id=item_id,
        title=title,
        price=price_raw,
        price_value=price_value,
        location=location,
        url=f"{BASE_URL}/marketplace/item/{item_id}/",
        image=card.get("img") or None,
        scraped_at=utcnow_iso(),
    )


# --------------------------------------------------------------------------
# URL building
# --------------------------------------------------------------------------

def normalize_location(loc: Optional[str]) -> Optional[str]:
    if not loc:
        return None
    loc = loc.strip()
    if loc.isdigit():  # numeric location IDs pass through untouched
        return loc
    return re.sub(r"[^a-z0-9]", "", loc.lower())


def build_search_url(args: argparse.Namespace) -> str:
    params: dict = {"query": args.query}
    if args.min_price is not None:
        params["minPrice"] = args.min_price
    if args.max_price is not None:
        params["maxPrice"] = args.max_price
    if args.days is not None:
        params["daysSinceListed"] = args.days
    token = SORT_TOKENS.get(args.sort)
    if token:
        params["sortBy"] = token
    loc = normalize_location(args.location)
    path = f"/marketplace/{loc}/search" if loc else "/marketplace/search"
    return BASE_URL + path + "?" + urllib.parse.urlencode(params)


# --------------------------------------------------------------------------
# Browser plumbing
# --------------------------------------------------------------------------

def _require_playwright():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit(
            "Playwright is not installed. Run:\n"
            "  pip install playwright\n"
            "  python -m playwright install chromium   # unless Chromium is already available"
        )
    return sync_playwright


def _chromium_candidates(explicit: Optional[str]) -> list[str]:
    candidates = [explicit, os.environ.get("FB_MP_CHROMIUM")]
    home = os.path.expanduser("~")
    caches = [
        os.environ.get("PLAYWRIGHT_BROWSERS_PATH"),
        os.path.join(home, ".cache", "ms-playwright"),
        os.path.join(home, "Library", "Caches", "ms-playwright"),
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "ms-playwright"),
    ]
    for base in caches:
        if not base or not os.path.isdir(base):
            continue
        for pattern in (
            os.path.join("chromium-*", "chrome-linux", "chrome"),
            os.path.join("chromium-*", "chrome-mac*", "Chromium.app",
                         "Contents", "MacOS", "Chromium"),
            os.path.join("chromium-*", "chrome-win", "chrome.exe"),
        ):
            candidates += sorted(glob.glob(os.path.join(base, pattern)), reverse=True)
        candidates.append(os.path.join(base, "chromium"))
    candidates += [
        "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        os.path.join(os.environ.get("PROGRAMFILES", r"C:\Program Files"),
                     "Google", "Chrome", "Application", "chrome.exe"),
        os.path.join(os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)"),
                     "Google", "Chrome", "Application", "chrome.exe"),
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "Google", "Chrome",
                     "Application", "chrome.exe"),
        os.path.join(os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)"),
                     "Microsoft", "Edge", "Application", "msedge.exe"),
    ]
    return [c for c in candidates if c and os.path.exists(c)]


def _launch(p, args: argparse.Namespace):
    kwargs: dict = {"headless": not args.headed}
    if args.proxy:
        kwargs["proxy"] = {"server": args.proxy}
    if args.browser_path:
        return p.chromium.launch(executable_path=args.browser_path, **kwargs)
    try:
        return p.chromium.launch(**kwargs)
    except Exception as first_err:
        # Playwright's own download may be missing; fall back to any Chromium
        # we can find on disk.
        for path in _chromium_candidates(None):
            try:
                return p.chromium.launch(executable_path=path, **kwargs)
            except Exception:
                continue
        raise first_err


def load_cookies(path: Path):
    """Accept either a Playwright storage_state file or a browser-extension
    cookie export (a JSON list, e.g. from Cookie-Editor)."""
    data = json.loads(path.read_text())
    if isinstance(data, dict) and "cookies" in data:
        return "storage_state", str(path)
    if not isinstance(data, list):
        raise SystemExit(f"Unrecognized cookie file format: {path}")
    cookies = []
    for c in data:
        if not isinstance(c, dict) or not c.get("name") or "value" not in c:
            continue
        cookie = {
            "name": c["name"],
            "value": c["value"],
            "domain": c.get("domain") or ".facebook.com",
            "path": c.get("path") or "/",
        }
        expires = c.get("expires", c.get("expirationDate"))
        if expires:
            cookie["expires"] = int(float(expires))
        if "httpOnly" in c:
            cookie["httpOnly"] = bool(c["httpOnly"])
        if "secure" in c:
            cookie["secure"] = bool(c["secure"])
        same = str(c.get("sameSite", "")).lower()
        cookie["sameSite"] = {
            "strict": "Strict", "lax": "Lax", "none": "None", "no_restriction": "None",
        }.get(same, "Lax")
        cookies.append(cookie)
    return "cookies", cookies


def _new_context(browser, args: argparse.Namespace):
    opts: dict = {
        "viewport": {"width": 1366, "height": 900},
        "locale": "en-US",
        "user_agent": args.user_agent or DEFAULT_USER_AGENT,
    }
    pending_cookies = None
    if args.cookies:
        kind, value = load_cookies(Path(args.cookies))
        if kind == "storage_state":
            opts["storage_state"] = value
        else:
            pending_cookies = value
    context = browser.new_context(**opts)
    if pending_cookies:
        context.add_cookies(pending_cookies)
    return context


def dismiss_dialogs(page) -> None:
    """Best-effort dismissal of the cookie banner and the login popup."""
    page.wait_for_timeout(1200)
    selectors = [
        'div[aria-label="Decline optional cookies"][role="button"]',
        'button[data-cookiebanner="accept_only_essential_button"]',
        'div[role="dialog"] div[aria-label="Close"][role="button"]',
        'div[aria-label="Close"][role="button"]',
    ]
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            if loc.count() > 0 and loc.is_visible():
                loc.click(timeout=2000)
                page.wait_for_timeout(500)
        except Exception:
            pass
    try:
        page.keyboard.press("Escape")
    except Exception:
        pass


def _looks_login_walled(page) -> bool:
    url = page.url or ""
    if "/login" in url or "/checkpoint" in url:
        return True
    try:
        return page.locator('form[action*="login"] input[name="pass"]').count() > 0
    except Exception:
        return False


LOGIN_WALL_HINT = (
    "Facebook is requiring a login to show these results (this varies by "
    "region and IP). Options: try again later, pass --cookies with your own "
    "exported session cookies, or run with --headed to see what the browser sees."
)


def scrape_search(page, url: str, *, limit: int, scrolls: int, timeout_s: int,
                  scroll_pause: float = 2.5) -> list[Listing]:
    page.goto(url, wait_until="domcontentloaded", timeout=timeout_s * 1000)
    dismiss_dialogs(page)
    if _looks_login_walled(page):
        raise LoginWallError(LOGIN_WALL_HINT)
    try:
        page.wait_for_selector('a[href*="/marketplace/item/"]', timeout=20_000)
    except Exception:
        if _looks_login_walled(page):
            raise LoginWallError(LOGIN_WALL_HINT)
        return []

    listings: dict[str, Listing] = {}
    rounds = max(1, scrolls + 1)
    for round_no in range(rounds):
        for card in page.evaluate(COLLECT_CARDS_JS):
            listing = listing_from_card(card)
            if listing and listing.id not in listings:
                listings[listing.id] = listing
        if len(listings) >= limit or round_no == rounds - 1:
            break
        page.mouse.wheel(0, 6000)
        page.wait_for_timeout(int(scroll_pause * random.uniform(0.8, 1.3) * 1000))
    return list(listings.values())[:limit]


def run_search(args: argparse.Namespace, url: str) -> list[Listing]:
    sync_playwright = _require_playwright()
    with sync_playwright() as p:
        browser = _launch(p, args)
        try:
            context = _new_context(browser, args)
            page = context.new_page()
            page.set_default_timeout(args.timeout * 1000)
            return scrape_search(
                page, url,
                limit=args.limit, scrolls=args.scrolls, timeout_s=args.timeout,
            )
        finally:
            browser.close()


# --------------------------------------------------------------------------
# Output / notifications
# --------------------------------------------------------------------------

def render_table(listings: list[Listing]) -> str:
    if not listings:
        return "No listings found.\n"
    lines = []
    for l in listings:
        price = (l.price or "—").rjust(9)
        title = (l.title or "Untitled")[:52].ljust(52)
        location = (l.location or "")[:24].ljust(24)
        lines.append(f"{price}  {title}  {location}  {l.url}")
    return "\n".join(lines) + f"\n\n{len(listings)} listing(s)\n"


def render(listings: list[Listing], fmt: str) -> str:
    if fmt == "json":
        return json.dumps([asdict(l) for l in listings], indent=2, ensure_ascii=False) + "\n"
    if fmt == "jsonl":
        return "".join(json.dumps(asdict(l), ensure_ascii=False) + "\n" for l in listings)
    if fmt == "csv":
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=FIELDS)
        writer.writeheader()
        for l in listings:
            writer.writerow(asdict(l))
        return buf.getvalue()
    return render_table(listings)


def format_line(l: Listing) -> str:
    parts = [l.price or "—", l.title or "Untitled"]
    if l.location:
        parts.append(l.location)
    parts.append(l.url)
    return " — ".join(parts)


def notify_webhook(url: str, listings: list[Listing], query: str) -> None:
    lines = []
    for l in listings:
        line = f"• {l.title or 'Untitled'} — {l.price or 'n/a'}"
        if l.location:
            line += f" — {l.location}"
        lines.append(line + f"\n  {l.url}")
    text = f"{len(listings)} new Marketplace listing(s) for \"{query}\":\n" + "\n".join(lines)
    if len(text) > 1900:  # Discord caps message content at 2000 chars
        text = text[:1900] + "\n…(truncated)"

    host = urllib.parse.urlparse(url).netloc
    if "discord" in host:
        payload: dict = {"content": text}
    elif "slack" in host:
        payload = {"text": text}
    else:
        payload = {"query": query, "text": text,
                   "listings": [asdict(l) for l in listings]}
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json",
                 "User-Agent": "fb-marketplace-scraper"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        resp.read()


# --------------------------------------------------------------------------
# State (watch mode)
# --------------------------------------------------------------------------

def load_state(path: Path) -> dict:
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError:
        print(f"warning: state file {path} is corrupt; starting fresh", file=sys.stderr)
        return {}


def save_state(path: Path, state: dict) -> None:
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(state))
    tmp.replace(path)


# --------------------------------------------------------------------------
# Commands
# --------------------------------------------------------------------------

def cmd_search(args: argparse.Namespace) -> int:
    url = build_search_url(args)
    print(f"Searching: {url}", file=sys.stderr)
    listings = run_search(args, url)
    out = render(listings, args.format)
    if args.output:
        Path(args.output).write_text(out)
        print(f"Wrote {len(listings)} listing(s) to {args.output}", file=sys.stderr)
    else:
        sys.stdout.write(out)
    if not listings:
        print(
            "No listings parsed — Facebook may have shown a login wall or an "
            "unrecognized layout. See README.md troubleshooting.",
            file=sys.stderr,
        )
    return 0


def cmd_watch(args: argparse.Namespace) -> int:
    url = build_search_url(args)
    state_path = Path(args.state)
    state = load_state(state_path)
    seen: dict = state.setdefault(url, {})

    interval = max(MIN_WATCH_INTERVAL, args.interval)
    if args.interval < MIN_WATCH_INTERVAL:
        print(f"note: interval raised to the {MIN_WATCH_INTERVAL}s minimum", file=sys.stderr)
    if interval < 300:
        print("note: intervals under 5 minutes make blocks more likely; "
              "consider --interval 300 or higher", file=sys.stderr)

    first_pass = not seen
    consecutive_errors = 0
    print(f"Watching: {url}", file=sys.stderr)
    print(f"Checking every ~{interval}s. Ctrl-C to stop.", file=sys.stderr)

    while True:
        stamp = datetime.now().strftime("%H:%M:%S")
        try:
            listings = run_search(args, url)
            consecutive_errors = 0
            now = utcnow_iso()
            new = [l for l in listings if l.id not in seen]
            for l in listings:
                seen.setdefault(l.id, now)
            if len(seen) > STATE_MAX_SEEN_PER_SEARCH:
                seen = dict(sorted(seen.items(), key=lambda kv: kv[1])[-STATE_MAX_SEEN_PER_SEARCH:])
                state[url] = seen
            save_state(state_path, state)

            report = new if (not first_pass or args.notify_first) else []
            if first_pass and not args.notify_first:
                print(f"[{stamp}] Seeded {len(listings)} existing listing(s); "
                      "you'll be told about new ones from now on.")
            elif not report:
                print(f"[{stamp}] No new listings ({len(listings)} checked).")
            for l in report:
                print(f"[{stamp}] NEW  {format_line(l)}")
            if report and args.output:
                with open(args.output, "a", encoding="utf-8") as fh:
                    for l in report:
                        fh.write(json.dumps(asdict(l), ensure_ascii=False) + "\n")
            if report and args.webhook:
                try:
                    notify_webhook(args.webhook, report, args.query)
                except Exception as e:
                    print(f"[{stamp}] warning: webhook failed: {e}", file=sys.stderr)
            first_pass = False
        except LoginWallError as e:
            consecutive_errors += 1
            print(f"[{stamp}] {e}", file=sys.stderr)
        except Exception as e:
            consecutive_errors += 1
            print(f"[{stamp}] error: {e}", file=sys.stderr)

        if consecutive_errors >= 5:
            print("Five consecutive failures — stopping. See README.md troubleshooting.",
                  file=sys.stderr)
            return 1
        time.sleep(interval * random.uniform(0.9, 1.15))


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def build_arg_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(
        prog="scraper.py",
        description="Search / watch Facebook Marketplace listings.",
        epilog="Automated collection is against Meta's Terms of Service. "
               "Personal, low-volume use only — see README.md.",
    )
    sub = ap.add_subparsers(dest="command", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("query", help='search text, e.g. "dewalt drill"')
    common.add_argument("-l", "--location",
                        help='Marketplace city slug as seen in the URL, e.g. '
                             '"sanfrancisco" or "nyc" (default: Facebook picks by IP)')
    common.add_argument("--min-price", type=int, help="minimum price filter")
    common.add_argument("--max-price", type=int, help="maximum price filter")
    common.add_argument("--days", type=int, choices=[1, 7, 30],
                        help="only listings posted in the last N days")
    common.add_argument("--sort", choices=sorted(SORT_TOKENS), default="newest",
                        help="result order (default: newest)")
    common.add_argument("--limit", type=int, default=40,
                        help="max listings per run (default: 40)")
    common.add_argument("--scrolls", type=int, default=3,
                        help="times to scroll for more results (default: 3)")
    common.add_argument("--cookies",
                        help="path to your own exported Facebook cookies (JSON); "
                             "only needed if you hit a login wall")
    common.add_argument("--headed", action="store_true",
                        help="show the browser window (debugging)")
    common.add_argument("--browser-path", help="explicit Chromium executable to use")
    common.add_argument("--proxy", help="proxy server for the browser, e.g. http://host:port")
    common.add_argument("--user-agent", help="override the browser user agent")
    common.add_argument("--timeout", type=int, default=60,
                        help="page-load timeout in seconds (default: 60)")

    sp = sub.add_parser("search", parents=[common],
                        help="run the search once and print/export results")
    sp.add_argument("--format", choices=["table", "json", "jsonl", "csv"],
                    default="table", help="output format (default: table)")
    sp.add_argument("-o", "--output", help="write results to this file instead of stdout")
    sp.set_defaults(func=cmd_search)

    wp = sub.add_parser("watch", parents=[common],
                        help="re-run the search on an interval and report new listings")
    wp.add_argument("--interval", type=int, default=900,
                    help="seconds between checks (default: 900, min: 120)")
    wp.add_argument("--state", default=".fb-mp-state.json",
                    help="file used to remember already-seen listings")
    wp.add_argument("--webhook",
                    help="POST new listings to this URL (Discord/Slack payloads auto-detected)")
    wp.add_argument("--notify-first", action="store_true",
                    help="also report everything found on the very first run")
    wp.add_argument("-o", "--output", help="append new listings to this JSONL file")
    wp.set_defaults(func=cmd_watch)
    return ap


def main(argv: Optional[list[str]] = None) -> int:
    args = build_arg_parser().parse_args(argv)
    try:
        return args.func(args)
    except KeyboardInterrupt:
        print("\nStopped.", file=sys.stderr)
        return 130
    except LoginWallError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
