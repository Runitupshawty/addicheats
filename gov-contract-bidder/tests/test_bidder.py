"""Offline tests: scraper normalization, DB pipeline, scoring, and drafting."""

import json
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

TMP = tempfile.mkdtemp()
os.environ["BIDDER_HOME"] = TMP
os.environ["BIDDER_DB"] = str(Path(TMP) / "test.db")
os.environ["BIDDER_PROFILE"] = str(Path(TMP) / "profile.json")
os.environ["BIDDER_DRAFTS"] = str(Path(TMP) / "drafts")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bidder import config, db, proposal, scoring, scraper  # noqa: E402

SAMPLE_RECORD = {
    "noticeId": "abc123",
    "title": "Grounds Maintenance Services - Building 42",
    "solicitationNumber": "W912DY-26-R-0001",
    "department": "DEPT OF DEFENSE",
    "subTier": "DEPT OF THE ARMY",
    "office": "W071 ENDIST KANSAS CITY",
    "naicsCode": "561730",
    "classificationCode": "S208",
    "typeOfSetAside": "SBA",
    "type": "Solicitation",
    "postedDate": "2026-08-01",
    "responseDeadLine": (datetime.now(timezone.utc) + timedelta(days=14)).strftime(
        "%Y-%m-%dT%H:%M:%S%z"),
    "archiveDate": "2026-10-01",
    "placeOfPerformance": {"city": {"name": "Kansas City"}, "state": {"code": "MO"}},
    "description": "https://api.sam.gov/opportunities/v1/noticedesc?noticeid=abc123",
    "uiLink": "https://sam.gov/opp/abc123/view",
}

PROFILE = {
    "company_name": "Test Co LLC",
    "certifications": ["small_business"],
    "capabilities": ["Grounds maintenance"],
    "keywords": ["maintenance", "landscaping"],
    "past_performance": [],
    "point_of_contact": {"name": "Pat", "email": "p@example.com", "phone": "555"},
    "service_area": "MO, KS",
}


class TestScraper(unittest.TestCase):
    def test_normalize(self):
        row = scraper._norm(SAMPLE_RECORD)
        self.assertEqual(row["notice_id"], "abc123")
        self.assertEqual(row["agency"], "DEPT OF DEFENSE")
        self.assertEqual(row["place_of_performance"], "Kansas City, MO")
        self.assertEqual(row["set_aside"], "SBA")
        json.loads(row["raw_json"])


class TestPipeline(unittest.TestCase):
    def setUp(self):
        Path(os.environ["BIDDER_DB"]).unlink(missing_ok=True)
        self.row = scraper._norm(SAMPLE_RECORD)

    def test_upsert_dedupes(self):
        self.assertEqual(db.upsert_opportunities([self.row]), 1)
        self.assertEqual(db.upsert_opportunities([self.row]), 0)
        self.assertEqual(len(db.list_opportunities()), 1)

    def test_rescrape_preserves_pipeline_state(self):
        db.upsert_opportunities([self.row])
        db.set_status("abc123", "reviewing", note="looks good")
        db.upsert_opportunities([self.row])
        opp = db.get_opportunity("abc123")
        self.assertEqual(opp["status"], "reviewing")
        self.assertIn("looks good", opp["notes"])

    def test_lookup_by_solicitation_number(self):
        db.upsert_opportunities([self.row])
        self.assertIsNotNone(db.get_opportunity("W912DY-26-R-0001"))

    def test_invalid_status_rejected(self):
        db.upsert_opportunities([self.row])
        with self.assertRaises(ValueError):
            db.set_status("abc123", "bogus")

    def test_scoring_persists(self):
        db.upsert_opportunities([self.row])
        opps = db.list_opportunities()
        db.save_scores(scoring.score_all(opps, PROFILE))
        opp = db.get_opportunity("abc123")
        self.assertGreater(opp["score"], 0)
        self.assertTrue(json.loads(opp["score_reasons"]))


class TestScoring(unittest.TestCase):
    def test_matching_set_aside_and_keywords_boost(self):
        opp = scraper._norm(SAMPLE_RECORD)
        score, reasons = scoring.score_opportunity(opp, PROFILE)
        blob = " ".join(reasons)
        self.assertIn("matches your certification", blob)
        self.assertIn("matches your keywords", blob)
        self.assertIn("in your service area", blob)

        bare_score, _ = scoring.score_opportunity(opp, {"certifications": [],
                                                        "keywords": [], "capabilities": []})
        self.assertGreater(score, bare_score)

    def test_passed_deadline_penalized(self):
        opp = scraper._norm(SAMPLE_RECORD)
        opp["response_deadline"] = "2020-01-01"
        score, reasons = scoring.score_opportunity(opp, PROFILE)
        self.assertIn("deadline passed -50", " ".join(reasons))

    def test_nothing_is_excluded(self):
        """An off-profile opportunity still gets scored, never dropped."""
        opp = scraper._norm(SAMPLE_RECORD)
        opp.update(title="Quantum Satellite Software", naics="541511",
                   set_aside="8A", place_of_performance="Juneau, AK")
        score, reasons = scoring.score_opportunity(opp, PROFILE)
        self.assertIsInstance(score, float)


class TestProposal(unittest.TestCase):
    def test_draft_contains_key_sections(self):
        Path(os.environ["BIDDER_DB"]).unlink(missing_ok=True)
        row = scraper._norm(SAMPLE_RECORD)
        db.upsert_opportunities([row])
        opp = db.get_opportunity("abc123")
        path = proposal.write_draft(opp, PROFILE)
        text = path.read_text()
        for expected in ("Bid Draft", "W912DY-26-R-0001", "Compliance Checklist",
                         "Pricing", "manual submission", "Test Co LLC"):
            self.assertIn(expected, text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
