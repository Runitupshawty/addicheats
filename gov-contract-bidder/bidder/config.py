"""Configuration: paths, API keys, and the company profile."""

import json
import os
from pathlib import Path

BASE_DIR = Path(os.environ.get("BIDDER_HOME", Path(__file__).resolve().parent.parent))
DB_PATH = Path(os.environ.get("BIDDER_DB", BASE_DIR / "opportunities.db"))
PROFILE_PATH = Path(os.environ.get("BIDDER_PROFILE", BASE_DIR / "company_profile.json"))
DRAFTS_DIR = Path(os.environ.get("BIDDER_DRAFTS", BASE_DIR / "drafts"))

# Free key from https://sam.gov -> Account Details -> API Key.
# DEMO_KEY works for light testing but is heavily rate-limited.
SAM_API_KEY = os.environ.get("SAM_API_KEY", "DEMO_KEY")

SAM_SEARCH_URL = "https://api.sam.gov/opportunities/v2/search"

DEFAULT_PROFILE = {
    "company_name": "Your Company LLC",
    "uei": "",
    "cage_code": "",
    "duns": "",
    "point_of_contact": {"name": "", "email": "", "phone": ""},
    "certifications": [],
    "capabilities": [],
    "keywords": [],
    "past_performance": [],
    "service_area": "Nationwide",
    "notes": "",
}


def load_profile():
    """Load the company profile, creating a starter file on first run."""
    if not PROFILE_PATH.exists():
        PROFILE_PATH.write_text(json.dumps(DEFAULT_PROFILE, indent=2))
        return dict(DEFAULT_PROFILE)
    with open(PROFILE_PATH) as f:
        profile = json.load(f)
    merged = dict(DEFAULT_PROFILE)
    merged.update(profile)
    return merged
