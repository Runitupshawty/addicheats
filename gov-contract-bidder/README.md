# Gov Contract Bidder

Scrapes U.S. government contract opportunities of **all types** (no industry
filter), ranks them against your company profile, generates draft bid
packages, and tracks each bid through a pipeline.

**What it deliberately does not do:** submit bids for you. A bid is a legally
binding offer, and federal/state portals have no public submission API anyway.
The tool preps everything up to the signature; you review the draft, finish
pricing, and submit through the portal named in the notice.

## Data source

[SAM.gov](https://sam.gov) is the official single listing for all U.S. federal
contract opportunities across every agency and industry, via the free
[Get Opportunities API](https://open.gsa.gov/api/get-opportunities-public-api/).
Scraping it with no NAICS filter covers every contract type. (State/local
portals vary by state and can be added as extra scrapers later.)

## Setup

```bash
cd gov-contract-bidder
pip install -r requirements.txt

# Get a free API key: sign in at sam.gov -> Account Details -> API Key
export SAM_API_KEY=your_key_here   # DEMO_KEY works for a few test calls

# Fill in your company info (used for ranking and for draft bids)
cp company_profile.example.json company_profile.json
```

Certifications/keywords in the profile only **boost** ranking — nothing is
filtered out, so contracts outside your usual skill set still show up.

## Usage

```bash
python -m bidder scrape --days 7        # pull last 7 days, all industries
python -m bidder scrape --state TX      # optional geographic filter
python -m bidder list                   # best-scored first
python -m bidder list --order deadline  # most urgent first
python -m bidder show <notice_id>       # full detail + why it scored that way
python -m bidder draft <notice_id>      # write drafts/<id>.md bid package
python -m bidder status <notice_id> submitted --note "sent via email per notice"
python -m bidder pipeline               # counts by stage
```

Pipeline stages: `new → reviewing → drafting → drafted → submitted → won/lost`
(plus `no_bid` / `cancelled`).

## Before you can actually bid (one-time, real-world steps)

1. Register your business at sam.gov (free — gets you a UEI). Required to win
   any federal contract.
2. Know your NAICS codes and small-business size standards.
3. If eligible, get set-aside certifications (8(a), HUBZone, WOSB, SDVOSB) —
   they dramatically improve win rates on set-aside contracts.

## Tests

```bash
python tests/test_bidder.py
```
