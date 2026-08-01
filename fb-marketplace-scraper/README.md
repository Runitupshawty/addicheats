# fb-marketplace-scraper

A small command-line tool that searches **Facebook Marketplace** and reports
listings — title, price, location, link, and image. It drives a real Chromium
browser via [Playwright](https://playwright.dev/python/), so it sees the same
pages you would.

Two modes:

- **`search`** — run a query once, print a table or export JSON/CSV/JSONL.
- **`watch`** — re-run the query on an interval (default every 15 minutes),
  remember what it has already seen, and tell you only about **new** listings —
  optionally pinging a Discord or Slack webhook so deal alerts land on your phone.

## ⚠️ Before you use this

- **Meta's Terms of Service prohibit automated data collection** from
  Facebook, and Facebook actively blocks scrapers. Using this tool is at your
  own risk: accounts used for scraping can be restricted, and your IP can be
  temporarily blocked. Depending on where you live, scraping may also have
  legal implications — that's on you to evaluate.
- This tool is meant for **personal, low-volume use** (e.g. watching a couple
  of searches for a deal on a drill). Keep the defaults: one search page per
  run, long intervals. Don't use it to harvest data at scale, collect
  information about sellers, or republish listings.
- The official, ToS-friendly alternative: Facebook's own **saved searches /
  "Notify me" alerts** in the Marketplace app do most of what `watch` mode does.

## Install

Requires Python 3.9+.

```bash
pip install -r requirements.txt
python -m playwright install chromium   # skip if Chromium is already installed
```

If you already have a Chromium/Chrome build, you can skip the download and
point the tool at it with `--browser-path /usr/bin/chromium` (or set
`FB_MP_CHROMIUM=/path/to/chrome`).

## Usage

```bash
# One-off search, newest first
python3 scraper.py search "dewalt drill" --location sanfrancisco --max-price 100

# Export machine-readable results
python3 scraper.py search "road bike" -l nyc --days 7 --format json -o bikes.json

# Watch for new listings every 15 minutes and print them as they appear
python3 scraper.py watch "free couch" -l losangeles

# Watch + push alerts to a Discord webhook
python3 scraper.py watch "thinkpad x1" -l seattle --max-price 400 \
    --interval 1200 --webhook https://discord.com/api/webhooks/…
```

### Common options (both modes)

| Option | Meaning |
| --- | --- |
| `query` (positional) | Search text. |
| `-l`, `--location` | Marketplace city slug, exactly as it appears in a Marketplace URL: `facebook.com/marketplace/<slug>/…` (e.g. `sanfrancisco`, `nyc`, `losangeles`). Omit to let Facebook choose based on your IP. |
| `--min-price`, `--max-price` | Price filters, whole currency units. |
| `--days {1,7,30}` | Only listings posted in the last N days. |
| `--sort` | `newest` (default), `price_asc`, `price_desc`, `distance`, `relevance`. |
| `--limit` | Max listings per run (default 40). |
| `--scrolls` | How many times to scroll to load more results (default 3). |
| `--cookies FILE` | Use your own Facebook session (see below). |
| `--headed` | Show the browser window — the best debugging tool here. |
| `--proxy URL` | Route the browser through a proxy (e.g. a corporate proxy). |
| `--timeout SECONDS` | Page-load timeout (default 60). |

### `search` options

`--format table|json|jsonl|csv` and `-o/--output FILE`.

### `watch` options

| Option | Meaning |
| --- | --- |
| `--interval SECONDS` | Time between checks. Default 900 (15 min), minimum 120. Longer is safer. |
| `--state FILE` | Where already-seen listing IDs are remembered (default `.fb-mp-state.json`). |
| `--webhook URL` | POST new listings to a webhook. Discord and Slack payload formats are auto-detected; anything else receives a JSON body with the full listing data. |
| `--notify-first` | Also report everything found on the very first run (normally the first run just seeds the state). |
| `-o FILE` | Append new listings to a JSONL file as they're found. |

The first `watch` run records what's already listed without alerting; after
that, each check reports only listings it hasn't seen before.

## Using your own login (cookies)

Logged-out Marketplace browsing works in many regions, but some regions/IPs
get a hard login wall. If you do, you can reuse **your own** session:

1. Log in to facebook.com in your normal browser.
2. Export cookies for `facebook.com` with a browser extension such as
   Cookie-Editor (JSON export), and save the file locally.
3. Run with `--cookies path/to/cookies.json`.

Both raw extension exports (a JSON list) and Playwright `storage_state` files
are accepted. **Treat the cookie file like a password** — anyone with it can
use your Facebook account. It's covered by this directory's `.gitignore`, but
don't move it into version control, and only use your own account.

## How it works / limitations

- The tool loads `facebook.com/marketplace/<location>/search?query=…` with
  filters passed as URL parameters, dismisses cookie/login popups when it can,
  scrolls a few times, then parses every `/marketplace/item/…` card on the page.
- Facebook's DOM is obfuscated and changes regularly. Parsing is heuristic
  (price = line starting with a currency amount; title = image alt text;
  location = trailing "City, ST" line). If results come back empty or
  garbled after a Facebook redesign, the selectors in `scraper.py`
  (`COLLECT_CARDS_JS` and `listing_from_card`) are the place to fix.
- Radius, category, vehicle/property filters and per-listing details
  (descriptions, seller info) are intentionally out of scope.

## Troubleshooting

- **"Facebook is requiring a login…"** — your region/IP gets the login wall.
  Try later, use `--cookies` (above), or run from a residential connection.
- **Empty results but the search works in your browser** — run with `--headed`
  to watch what the automated browser sees; often it's a consent dialog or an
  interstitial that needs a new selector in `dismiss_dialogs()`.
- **Blocked / captcha pages** — you've been rate-limited. Stop for a while and
  increase `--interval`. This tool deliberately ships no captcha-solving or
  block-evasion features.
- **Browser fails to launch** — run `python -m playwright install chromium`,
  or point `--browser-path` at an existing Chrome/Chromium binary.

## Tests

```bash
python3 -m unittest            # parser + URL unit tests, plus a local
                               # end-to-end test against a fixture page
                               # (auto-skips if no Chromium is available)
```
