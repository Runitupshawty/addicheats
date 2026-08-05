"""Scrape federal contract opportunities from the SAM.gov public API.

SAM.gov is the single official listing for all U.S. federal contract
opportunities across every agency and industry, so scraping it with no
NAICS filter covers "contracts of all sorts".

API docs: https://open.gsa.gov/api/get-opportunities-public-api/
"""

import json
import time
from datetime import date, timedelta

import requests

from . import config

# Notice types worth bidding on (o=solicitation, k=combined synopsis,
# p=presolicitation, r=sources sought — early intel, s=special notice).
DEFAULT_PTYPES = ["o", "k", "p", "r"]

PAGE_SIZE = 1000


def _fmt(d):
    return d.strftime("%m/%d/%Y")


def _norm(record):
    """Flatten a SAM.gov API record into our DB row shape."""
    pop = record.get("placeOfPerformance") or {}
    city = (pop.get("city") or {}).get("name", "")
    state = (pop.get("state") or {}).get("code", "")
    place = ", ".join(p for p in (city, state) if p)
    return {
        "notice_id": record.get("noticeId"),
        "title": record.get("title", "").strip(),
        "solicitation_number": record.get("solicitationNumber"),
        "agency": record.get("department") or record.get("fullParentPathName", "").split(".")[0],
        "sub_agency": record.get("subTier"),
        "office": record.get("office"),
        "naics": record.get("naicsCode"),
        "classification_code": record.get("classificationCode"),
        "set_aside": record.get("typeOfSetAside") or "",
        "notice_type": record.get("type"),
        "posted_date": record.get("postedDate"),
        "response_deadline": record.get("responseDeadLine"),
        "archive_date": record.get("archiveDate"),
        "place_of_performance": place,
        "description_url": record.get("description"),
        "ui_link": record.get("uiLink"),
        "source": "sam.gov",
        "raw_json": json.dumps(record),
    }


def fetch_opportunities(days_back=7, ptypes=None, naics=None, state=None,
                        max_pages=10, session=None):
    """Fetch recent opportunities. No NAICS filter by default = all industries.

    Yields normalized dicts ready for db.upsert_opportunities().
    """
    session = session or requests.Session()
    posted_to = date.today()
    posted_from = posted_to - timedelta(days=days_back)

    params = {
        "api_key": config.SAM_API_KEY,
        "postedFrom": _fmt(posted_from),
        "postedTo": _fmt(posted_to),
        "limit": PAGE_SIZE,
        "offset": 0,
        "ptype": ",".join(ptypes or DEFAULT_PTYPES),
    }
    if naics:
        params["ncode"] = naics
    if state:
        params["state"] = state

    for page in range(max_pages):
        params["offset"] = page * PAGE_SIZE
        resp = session.get(config.SAM_SEARCH_URL, params=params, timeout=60)
        if resp.status_code == 429:
            raise RuntimeError(
                "SAM.gov rate limit hit. DEMO_KEY allows very few calls per day — "
                "get a free personal key at sam.gov and set SAM_API_KEY."
            )
        resp.raise_for_status()
        data = resp.json()
        records = data.get("opportunitiesData", [])
        for record in records:
            if record.get("noticeId"):
                yield _norm(record)
        total = data.get("totalRecords", 0)
        if (page + 1) * PAGE_SIZE >= total or not records:
            break
        time.sleep(1)  # stay polite; SAM throttles aggressive clients
