"""Command-line interface for the gov-contract-bidder pipeline."""

import argparse
import json
import sys

from . import config, db, proposal, scoring, scraper


def cmd_scrape(args):
    print(f"Fetching opportunities posted in the last {args.days} day(s) from SAM.gov "
          f"(all industries{', state=' + args.state if args.state else ''})...")
    try:
        rows = list(scraper.fetch_opportunities(
            days_back=args.days, state=args.state, max_pages=args.max_pages))
    except Exception as e:
        print(f"Scrape failed: {e}", file=sys.stderr)
        return 1
    inserted = db.upsert_opportunities(rows)
    print(f"Fetched {len(rows)} notices; {inserted} new, {len(rows) - inserted} updated.")
    cmd_score(args)
    return 0


def cmd_score(args):
    profile = config.load_profile()
    opps = db.list_opportunities(limit=100000, order="posted")
    scored = scoring.score_all(opps, profile)
    db.save_scores(scored)
    print(f"Scored {len(scored)} opportunities against profile "
          f"'{profile.get('company_name')}'.")
    return 0


def cmd_list(args):
    opps = db.list_opportunities(status=args.status, limit=args.limit, order=args.order)
    if not opps:
        print("No opportunities found. Run `scrape` first.")
        return 0
    print(f"{'SCORE':>6}  {'DEADLINE':<12} {'STATUS':<10} {'SET-ASIDE':<10} TITLE / NOTICE ID")
    for o in opps:
        deadline = (o.get("response_deadline") or "")[:10]
        print(f"{o['score']:>6}  {deadline:<12} {o['status']:<10} "
              f"{(o.get('set_aside') or '-'):<10} {o['title'][:70]}")
        print(f"{'':>6}  {'':<12} {'':<10} {'':<10} id: {o['notice_id']}")
    return 0


def cmd_show(args):
    o = db.get_opportunity(args.notice_id)
    if not o:
        print(f"Not found: {args.notice_id}", file=sys.stderr)
        return 1
    o.pop("raw_json", None)
    reasons = o.pop("score_reasons", None)
    for k, v in o.items():
        if v not in (None, ""):
            print(f"{k:>22}: {v}")
    if reasons:
        print(f"{'why this score':>22}:")
        for r in json.loads(reasons):
            print(f"{'':>24}- {r}")
    return 0


def cmd_draft(args):
    o = db.get_opportunity(args.notice_id)
    if not o:
        print(f"Not found: {args.notice_id}", file=sys.stderr)
        return 1
    profile = config.load_profile()
    path = proposal.write_draft(o, profile)
    db.set_status(o["notice_id"], "drafted", note=f"draft at {path}")
    print(f"Draft bid package written to {path}")
    print("Review it, complete every TODO (especially pricing), then submit "
          "manually via the method in the notice.")
    return 0


def cmd_status(args):
    try:
        db.set_status(args.notice_id, args.new_status, note=args.note)
    except (KeyError, ValueError) as e:
        print(e, file=sys.stderr)
        return 1
    print(f"{args.notice_id} -> {args.new_status}")
    return 0


def cmd_pipeline(args):
    summary = db.pipeline_summary()
    if not summary:
        print("Pipeline is empty. Run `scrape` first.")
        return 0
    total = sum(summary.values())
    print(f"Pipeline ({total} opportunities):")
    for status, n in summary.items():
        print(f"  {status:<10} {n}")
    return 0


def main(argv=None):
    p = argparse.ArgumentParser(
        prog="bidder",
        description="Scrape, score, and prepare bids for government contracts "
                    "of all types. Submission is always a human step.")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("scrape", help="Pull recent opportunities from SAM.gov (all industries)")
    s.add_argument("--days", type=int, default=7, help="How many days back to fetch (default 7)")
    s.add_argument("--state", help="Optional place-of-performance state filter, e.g. TX")
    s.add_argument("--max-pages", type=int, default=10, help="Max pages of 1000 (default 10)")
    s.set_defaults(func=cmd_scrape)

    s = sub.add_parser("score", help="Re-rank everything against your company profile")
    s.set_defaults(func=cmd_score)

    s = sub.add_parser("list", help="List opportunities, best first")
    s.add_argument("--status", choices=db.VALID_STATUSES)
    s.add_argument("--limit", type=int, default=25)
    s.add_argument("--order", choices=["score", "deadline", "posted"], default="score")
    s.set_defaults(func=cmd_list)

    s = sub.add_parser("show", help="Full detail for one opportunity")
    s.add_argument("notice_id")
    s.set_defaults(func=cmd_show)

    s = sub.add_parser("draft", help="Generate a draft bid package (Markdown)")
    s.add_argument("notice_id")
    s.set_defaults(func=cmd_draft)

    s = sub.add_parser("status", help="Move an opportunity through the pipeline")
    s.add_argument("notice_id")
    s.add_argument("new_status", choices=db.VALID_STATUSES)
    s.add_argument("--note")
    s.set_defaults(func=cmd_status)

    s = sub.add_parser("pipeline", help="Counts by pipeline stage")
    s.set_defaults(func=cmd_pipeline)

    args = p.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
