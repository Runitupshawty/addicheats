#!/usr/bin/env python3
"""GrantBot - find grants, score them against your business profile, and
generate ready-to-review application drafts.

Commands:
    python3 grantbot.py scan            Pull fresh grants from all sources and score them
    python3 grantbot.py scan --demo     Same, but with bundled offline sample data
    python3 grantbot.py list            Show the current pipeline, best matches first
    python3 grantbot.py draft <id>      Generate a pre-filled application draft for one grant
    python3 grantbot.py draft --all     Draft every grant at or above --min-score (default 40)
    python3 grantbot.py status <id> <stage>   Move a grant through the pipeline
    python3 grantbot.py report          Deadlines and pipeline summary

Stages: found -> drafted -> ready -> submitted -> awarded | declined | skipped

GrantBot prepares everything up to the final submit click. It never submits
an application on its own: grant portals require your own account (SAM.gov,
Grants.gov workspace, or a funder's form) and every application contains
certifications that must be personally reviewed and signed by the applicant.
"""

import argparse
import json
import re
import sys
import urllib.request
import urllib.error
from datetime import date, datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent
PROFILE_PATH = BASE / "profile.json"
CURATED_PATH = BASE / "sources" / "curated_grants.json"
DEMO_PATH = BASE / "sources" / "demo_grantsgov.json"
PIPELINE_PATH = BASE / "data" / "pipeline.json"
DRAFTS_DIR = BASE / "data" / "drafts"
TEMPLATE_PATH = BASE / "templates" / "application_template.md"

GRANTS_GOV_API = "https://api.grants.gov/v1/api/search2"
GRANTS_GOV_DETAIL = "https://www.grants.gov/search-results-detail/{id}"

STAGES = ["found", "drafted", "ready", "submitted", "awarded", "declined", "skipped"]


# ---------------------------------------------------------------- utilities

def load_json(path, default=None):
    if not path.exists():
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def http_post_json(url, payload, timeout=30):
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=body,
        headers={"Content-Type": "application/json", "User-Agent": "GrantBot/1.0"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def http_get(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": "GrantBot/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def parse_close_date(raw):
    if not raw:
        return None
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%b %d, %Y"):
        try:
            return datetime.strptime(raw.strip(), fmt).date()
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------- sources

def fetch_grants_gov(profile, demo=False):
    """Search the free Grants.gov REST API for each profile search term."""
    hits = {}
    if demo:
        data = load_json(DEMO_PATH, {"oppHits": []})
        for opp in data.get("oppHits", []):
            hits[opp["id"]] = opp
    else:
        for term in profile["matching"]["search_terms"]:
            payload = {
                "keyword": term,
                "oppStatuses": "posted",
                "rows": 50,
                "startRecordNum": 0,
            }
            try:
                data = http_post_json(GRANTS_GOV_API, payload)
            except (urllib.error.URLError, OSError, json.JSONDecodeError) as e:
                print(f"  [warn] Grants.gov search '{term}' failed: {e}")
                continue
            for opp in (data.get("data") or {}).get("oppHits", []):
                hits[opp["id"]] = opp

    grants = []
    for opp in hits.values():
        grants.append({
            "id": f"gg-{opp['id']}",
            "source": "grants.gov",
            "title": opp.get("title", ""),
            "funder": opp.get("agency", opp.get("agencyCode", "")),
            "url": GRANTS_GOV_DETAIL.format(id=opp["id"]),
            "opportunity_number": opp.get("number", ""),
            "open_date": opp.get("openDate", ""),
            "close_date": opp.get("closeDate", ""),
            "award_low": None,
            "award_high": None,
            "description": "",
            "eligibility": "",
        })
    return grants


def fetch_curated(demo=False):
    """Load curated listings and scan watch pages for grant-looking links."""
    curated = load_json(CURATED_PATH, {"sources": []})
    grants = []
    for src in curated["sources"]:
        if src["type"] == "listing":
            grants.append({
                "id": f"cur-{src['id']}",
                "source": src["name"],
                "title": src["name"],
                "funder": src["name"].split(" - ")[0],
                "url": src["url"],
                "opportunity_number": "",
                "open_date": "",
                "close_date": "",
                "award_low": src.get("award_low"),
                "award_high": src.get("award_high"),
                "description": src.get("notes", ""),
                "eligibility": src.get("eligibility", ""),
            })
        elif src["type"] == "watch" and not demo:
            try:
                html = http_get(src["url"], timeout=20)
            except (urllib.error.URLError, OSError) as e:
                print(f"  [warn] watch page {src['id']} unreachable: {e}")
                continue
            for title, href in extract_grant_links(html, src["url"]):
                slug = re.sub(r"[^a-z0-9]+", "-", title.lower())[:40].strip("-")
                grants.append({
                    "id": f"watch-{src['id']}-{slug}",
                    "source": src["name"],
                    "title": title,
                    "funder": src["name"],
                    "url": href,
                    "opportunity_number": "",
                    "open_date": "",
                    "close_date": "",
                    "award_low": None,
                    "award_high": None,
                    "description": f"Found on watch page: {src['url']}",
                    "eligibility": "",
                })
    return grants


LINK_RE = re.compile(r'<a[^>]+href="([^"#]+)"[^>]*>(.*?)</a>', re.I | re.S)
TAG_RE = re.compile(r"<[^>]+>")
GRANTY = re.compile(r"grant|fund|loan|assistance|capital|award", re.I)


def extract_grant_links(html, base_url):
    """Pull anchors whose text looks like a funding program announcement."""
    out = []
    for href, inner in LINK_RE.findall(html):
        text = TAG_RE.sub(" ", inner)
        text = re.sub(r"\s+", " ", text).strip()
        if 10 <= len(text) <= 120 and GRANTY.search(text):
            if href.startswith("/"):
                m = re.match(r"(https?://[^/]+)", base_url)
                href = (m.group(1) if m else base_url.rstrip("/")) + href
            elif not href.startswith("http"):
                continue
            out.append((text, href))
    # dedupe by link text
    seen, deduped = set(), []
    for t, h in out:
        if t.lower() not in seen:
            seen.add(t.lower())
            deduped.append((t, h))
    return deduped[:25]


# ---------------------------------------------------------------- matching

def score_grant(grant, profile):
    """Score 0-100 with reasons. Simple transparent keyword model."""
    m = profile["matching"]
    text = " ".join([
        grant.get("title", ""), grant.get("description", ""),
        grant.get("eligibility", ""), grant.get("funder", ""),
        grant.get("source", ""),
    ]).lower()

    score, reasons = 0, []
    for kw in m["keywords_strong"]:
        if kw.lower() in text:
            score += 18
            reasons.append(f"strong keyword: '{kw}'")
    for kw in m["keywords_context"]:
        if kw.lower() in text:
            score += 7
            reasons.append(f"context keyword: '{kw}'")
    for kw in m["keywords_exclude"]:
        if kw.lower() in text:
            score -= 40
            reasons.append(f"EXCLUSION hit: '{kw}'")

    close = parse_close_date(grant.get("close_date"))
    if close:
        days = (close - date.today()).days
        if days < 0:
            score -= 60
            reasons.append("deadline already passed")
        elif days <= 14:
            score += 5
            reasons.append(f"closing soon ({days} days)")

    if grant.get("award_high"):
        if grant["award_high"] >= m.get("min_award_interest", 0):
            score += 5
            reasons.append(f"award up to ${grant['award_high']:,}")

    return max(0, min(100, score)), reasons


# ---------------------------------------------------------------- pipeline

def load_pipeline():
    return load_json(PIPELINE_PATH, {"grants": {}})


def cmd_scan(args):
    profile = load_json(PROFILE_PATH)
    if not profile:
        sys.exit("profile.json missing - fill it in first")
    pipeline = load_pipeline()

    print("Scanning sources..." + (" (demo data)" if args.demo else ""))
    grants = fetch_grants_gov(profile, demo=args.demo) + fetch_curated(demo=args.demo)

    added, updated = 0, 0
    for g in grants:
        score, reasons = score_grant(g, profile)
        g["score"], g["score_reasons"] = score, reasons
        existing = pipeline["grants"].get(g["id"])
        if existing:
            existing.update({k: v for k, v in g.items() if v not in (None, "")})
            updated += 1
        else:
            g["stage"] = "found"
            g["first_seen"] = date.today().isoformat()
            pipeline["grants"][g["id"]] = g
            added += 1

    save_json(PIPELINE_PATH, pipeline)
    print(f"Done: {added} new, {updated} updated, {len(pipeline['grants'])} total in pipeline.")
    print("Top matches:")
    _print_table(sorted(pipeline["grants"].values(), key=lambda x: -x.get("score", 0))[:10])


def _print_table(grants):
    if not grants:
        print("  (pipeline empty - run: python3 grantbot.py scan)")
        return
    print(f"  {'score':>5}  {'stage':<9} {'close':<10}  id / title")
    for g in grants:
        close = g.get("close_date") or "-"
        print(f"  {g.get('score', 0):>5}  {g.get('stage','found'):<9} {close:<10}  {g['id']}")
        print(f"{'':23}{g['title'][:90]}")


def cmd_list(args):
    pipeline = load_pipeline()
    grants = list(pipeline["grants"].values())
    if args.stage:
        grants = [g for g in grants if g.get("stage") == args.stage]
    grants.sort(key=lambda x: -x.get("score", 0))
    _print_table(grants[: args.limit])


def cmd_status(args):
    pipeline = load_pipeline()
    g = pipeline["grants"].get(args.grant_id)
    if not g:
        sys.exit(f"unknown grant id: {args.grant_id}")
    if args.stage not in STAGES:
        sys.exit(f"stage must be one of: {', '.join(STAGES)}")
    g["stage"] = args.stage
    g["stage_updated"] = date.today().isoformat()
    save_json(PIPELINE_PATH, pipeline)
    print(f"{args.grant_id} -> {args.stage}")


# ---------------------------------------------------------------- drafting

def build_draft(grant, profile):
    tpl = TEMPLATE_PATH.read_text(encoding="utf-8")
    o, b = profile["owner"], profile["business"]
    use_of_funds = "\n".join(f"- {u}" for u in b["typical_use_of_funds"])
    services = ", ".join(b["services"])
    reasons = "\n".join(f"- {r}" for r in grant.get("score_reasons", [])) or "- (run scan to score)"
    federal = grant["source"] == "grants.gov"
    reg = b.get("registrations", {})
    checklist = []
    if federal:
        checklist.append(f"- [{'x' if reg.get('uei_sam_gov') else ' '}] SAM.gov registration + UEI number (required for federal grants - free at sam.gov, allow 2+ weeks)")
        checklist.append("- [ ] Grants.gov account linked to SAM registration")
    checklist += [
        f"- [{'x' if reg.get('llc_formed') else ' '}] Business entity formed (LLC) - some funders require it",
        f"- [{'x' if reg.get('mhic_license') else ' '}] MHIC home improvement license (strengthens contractor applications)",
        "- [ ] Read the full eligibility criteria on the funder page",
        "- [ ] Confirm deadline and submission portal",
        "- [ ] Review every pre-filled answer below, edit to fit the funder's actual questions",
        "- [ ] YOU submit it - GrantBot does not submit applications",
    ]
    return tpl.format(
        title=grant["title"],
        funder=grant.get("funder", ""),
        url=grant["url"],
        opportunity_number=grant.get("opportunity_number") or "n/a",
        close_date=grant.get("close_date") or "check funder page",
        score=grant.get("score", 0),
        score_reasons=reasons,
        generated=date.today().isoformat(),
        checklist="\n".join(checklist),
        business_name=b["name"],
        owner_name=o["name"],
        owner_email=o["email"],
        owner_phone=o["phone"],
        location=f"{b['location']['city']}, {b['location']['state_full']} ({b['location']['county']})",
        business_type=b["type"],
        employees=b["employees"],
        services=services,
        business_description=b["description"],
        owner_bio=o["bio"],
        growth_plan=b["growth_plan"],
        use_of_funds=use_of_funds,
    )


def cmd_draft(args):
    profile = load_json(PROFILE_PATH)
    pipeline = load_pipeline()
    if args.all:
        targets = [g for g in pipeline["grants"].values()
                   if g.get("score", 0) >= args.min_score
                   and g.get("stage") in ("found", "drafted")]
    else:
        if not args.grant_id:
            sys.exit("give a grant id, or use --all")
        g = pipeline["grants"].get(args.grant_id)
        if not g:
            sys.exit(f"unknown grant id: {args.grant_id}")
        targets = [g]

    DRAFTS_DIR.mkdir(parents=True, exist_ok=True)
    for g in targets:
        out = DRAFTS_DIR / f"{g['id']}.md"
        out.write_text(build_draft(g, profile), encoding="utf-8")
        if g.get("stage") == "found":
            g["stage"] = "drafted"
        print(f"drafted: {out.relative_to(BASE)}  (score {g.get('score', 0)})")
    save_json(PIPELINE_PATH, pipeline)
    if targets:
        print(f"\n{len(targets)} draft(s) ready for your review in {DRAFTS_DIR.relative_to(BASE)}/")
        print("Edit each draft, complete its checklist, then submit on the funder's portal.")


def cmd_report(args):
    pipeline = load_pipeline()
    grants = list(pipeline["grants"].values())
    if not grants:
        print("Pipeline empty - run: python3 grantbot.py scan")
        return
    by_stage = {}
    for g in grants:
        by_stage.setdefault(g.get("stage", "found"), []).append(g)
    print("Pipeline summary")
    for stage in STAGES:
        if stage in by_stage:
            print(f"  {stage:<10} {len(by_stage[stage])}")
    upcoming = []
    for g in grants:
        close = parse_close_date(g.get("close_date"))
        if close and g.get("stage") in ("found", "drafted", "ready"):
            days = (close - date.today()).days
            if 0 <= days <= 45:
                upcoming.append((days, g))
    if upcoming:
        print("\nDeadlines in the next 45 days:")
        for days, g in sorted(upcoming):
            print(f"  {days:>3}d  [{g.get('stage')}] {g['id']}  {g['title'][:70]}")


# ---------------------------------------------------------------- main

def main():
    p = argparse.ArgumentParser(description="GrantBot - grant scraper, matcher, and application drafter")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("scan", help="fetch and score grants from all sources")
    s.add_argument("--demo", action="store_true", help="use bundled offline sample data")
    s.set_defaults(func=cmd_scan)

    s = sub.add_parser("list", help="show pipeline, best matches first")
    s.add_argument("--stage", choices=STAGES)
    s.add_argument("--limit", type=int, default=25)
    s.set_defaults(func=cmd_list)

    s = sub.add_parser("draft", help="generate pre-filled application draft(s)")
    s.add_argument("grant_id", nargs="?")
    s.add_argument("--all", action="store_true")
    s.add_argument("--min-score", type=int, default=40)
    s.set_defaults(func=cmd_draft)

    s = sub.add_parser("status", help="move a grant to a new stage")
    s.add_argument("grant_id")
    s.add_argument("stage")
    s.set_defaults(func=cmd_status)

    s = sub.add_parser("report", help="pipeline summary and upcoming deadlines")
    s.set_defaults(func=cmd_report)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
