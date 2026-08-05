# GrantBot

A small-business grant finder and application assistant, tailored to James King's
contracting business (landscaping, painting, junk removal, and handyman work in
Frederick County, Maryland).

It does three things:

1. **Scrapes** — searches the free [Grants.gov](https://www.grants.gov) REST API
   with your profile's search terms, plus a curated list of Maryland/small-business
   grant pages it watches for new funding announcements.
2. **Matches** — scores every grant 0–100 against `profile.json` using transparent
   keyword rules (strong fit, context fit, exclusions, deadlines) and keeps
   everything in a pipeline file.
3. **Drafts applications** — generates a pre-filled application packet per grant
   (business overview, owner bio, use of funds, budget skeleton, and a
   pre-submission checklist) so applying is a review-and-submit job instead of a
   from-scratch job.

## Why it doesn't press "submit" for you

GrantBot deliberately stops at the finish line. Federal grants require your own
SAM.gov registration and Grants.gov account, private funders each use their own
portals, and every application ends with certifications that the information is
true — those have to be reviewed and signed by you, the applicant. Auto-submitting
would risk sending wrong or unverifiable information under your name. So the
workflow is: **GrantBot finds, scores, and writes → you review, fix numbers, and
click submit.** Everything before that click is automated.

## Setup

No dependencies beyond Python 3.9+ (standard library only).

```bash
cd grantbot
python3 grantbot.py scan          # live scan (needs internet)
python3 grantbot.py scan --demo   # offline test with bundled sample data
```

## Daily workflow

```bash
python3 grantbot.py scan                  # pull fresh grants, score them
python3 grantbot.py list                  # see best matches
python3 grantbot.py draft --all           # draft everything scoring >= 40
python3 grantbot.py draft gg-360222       # or draft one grant
# ...review data/drafts/*.md, complete the checklist, submit on the funder portal...
python3 grantbot.py status gg-360222 submitted
python3 grantbot.py report                # deadlines + pipeline summary
```

Run `scan` weekly (cron works: `0 8 * * 1 cd /path/to/grantbot && python3 grantbot.py scan`).

## Files

| Path | What it is |
|---|---|
| `profile.json` | Your business profile — **edit this first**; matching and drafts are built from it |
| `sources/curated_grants.json` | Curated grant programs + watch pages (add your own) |
| `sources/demo_grantsgov.json` | Offline sample data for `--demo` |
| `templates/application_template.md` | The draft packet template |
| `data/pipeline.json` | Generated: every grant seen, its score and stage |
| `data/drafts/*.md` | Generated: pre-filled application drafts |

## Pipeline stages

`found → drafted → ready → submitted → awarded / declined / skipped`

Move a grant with `python3 grantbot.py status <id> <stage>`.

## Important first steps (from your profile's checklist)

- **Register at SAM.gov (free)** to get a UEI — required for any federal grant and
  takes ~2 weeks. Beware of paid third-party "registration services"; sam.gov is free.
- **Form the LLC and get the MHIC license** — many funders require a registered
  entity, and a contractor license strengthens every application.
- Update `profile.json` (`registrations` section) as you complete these so drafts
  reflect reality.

## Honest expectations

Direct grants to for-profit contractors are competitive and rarer than loans —
many "small business grants" are corporate programs ($5k–$25k) with quarterly
cycles, and most federal money flows through state/local intermediaries. The
scanner's exclusion rules down-rank grants restricted to nonprofits, governments,
and universities so you spend review time only on realistic matches.
