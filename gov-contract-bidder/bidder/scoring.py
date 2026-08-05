"""Rank opportunities by how bid-worthy they are.

Scoring never *excludes* anything (the point is all contract types) —
it just sorts the firehose so the best prospects surface first.
"""

from datetime import datetime, timezone

# SAM.gov set-aside codes -> profile certification tags
SET_ASIDE_TAGS = {
    "SBA": "small_business",
    "SBP": "small_business",
    "8A": "8a",
    "8AN": "8a",
    "HZC": "hubzone",
    "HZS": "hubzone",
    "SDVOSBC": "sdvosb",
    "SDVOSBS": "sdvosb",
    "WOSB": "wosb",
    "WOSBSS": "wosb",
    "EDWOSB": "edwosb",
    "EDWOSBSS": "edwosb",
    "VSA": "veteran_owned",
    "VSS": "veteran_owned",
}

BIDDABLE_TYPES = {
    "Solicitation": 20,
    "Combined Synopsis/Solicitation": 20,
    "Presolicitation": 10,
    "Sources Sought": 8,
    "Special Notice": 3,
}


def _parse_deadline(value):
    if not value:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d", "%m/%d/%Y"):
        try:
            dt = datetime.strptime(value, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    return None


def score_opportunity(opp, profile):
    """Return (score, reasons) for one opportunity row."""
    score = 0.0
    reasons = []

    type_pts = BIDDABLE_TYPES.get(opp.get("notice_type") or "", 5)
    score += type_pts
    reasons.append(f"notice type '{opp.get('notice_type')}' +{type_pts}")

    deadline = _parse_deadline(opp.get("response_deadline"))
    if deadline:
        days_left = (deadline - datetime.now(timezone.utc)).days
        if days_left < 0:
            score -= 50
            reasons.append("deadline passed -50")
        elif days_left <= 3:
            score += 2
            reasons.append(f"only {days_left}d to respond +2")
        elif days_left <= 21:
            score += 15
            reasons.append(f"{days_left}d to respond +15")
        else:
            score += 8
            reasons.append(f"{days_left}d to respond +8")
    else:
        reasons.append("no deadline listed +0")

    certs = {c.lower().replace(" ", "_") for c in profile.get("certifications", [])}
    set_aside = (opp.get("set_aside") or "").strip()
    if set_aside:
        tag = SET_ASIDE_TAGS.get(set_aside, "")
        if tag and tag in certs:
            score += 25
            reasons.append(f"set-aside {set_aside} matches your certification +25")
        elif certs:
            score -= 5
            reasons.append(f"set-aside {set_aside} not in your certifications -5")
        else:
            reasons.append(f"set-aside {set_aside} (no certifications on profile) +0")
    else:
        score += 5
        reasons.append("full & open competition +5")

    text = " ".join(
        str(opp.get(k) or "") for k in ("title", "naics", "classification_code")
    ).lower()
    keywords = [k.lower() for k in profile.get("keywords", []) + profile.get("capabilities", [])]
    hits = sorted({k for k in keywords if k and k in text})
    if hits:
        pts = min(20, 7 * len(hits))
        score += pts
        reasons.append(f"matches your keywords ({', '.join(hits[:5])}) +{pts}")

    service_area = (profile.get("service_area") or "").lower()
    place = (opp.get("place_of_performance") or "").lower()
    if place and service_area and service_area != "nationwide":
        if any(part.strip() in place for part in service_area.split(",") if part.strip()):
            score += 10
            reasons.append("in your service area +10")

    return round(score, 1), reasons


def score_all(opportunities, profile):
    """Return [(notice_id, score, reasons)] for db.save_scores()."""
    return [
        (o["notice_id"], *score_opportunity(o, profile))
        for o in opportunities
    ]
