"""SQLite storage for scraped opportunities and bid pipeline state."""

import json
import sqlite3
from contextlib import contextmanager

from . import config

VALID_STATUSES = [
    "new", "reviewing", "no_bid", "drafting", "drafted",
    "submitted", "won", "lost", "cancelled",
]

SCHEMA = """
CREATE TABLE IF NOT EXISTS opportunities (
    notice_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    solicitation_number TEXT,
    agency TEXT,
    sub_agency TEXT,
    office TEXT,
    naics TEXT,
    classification_code TEXT,
    set_aside TEXT,
    notice_type TEXT,
    posted_date TEXT,
    response_deadline TEXT,
    archive_date TEXT,
    place_of_performance TEXT,
    description_url TEXT,
    ui_link TEXT,
    source TEXT DEFAULT 'sam.gov',
    status TEXT DEFAULT 'new',
    score REAL DEFAULT 0,
    score_reasons TEXT,
    notes TEXT DEFAULT '',
    raw_json TEXT,
    fetched_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_opp_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opp_deadline ON opportunities(response_deadline);
"""


@contextmanager
def connect():
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def upsert_opportunities(rows):
    """Insert new opportunities; refresh mutable fields on ones we already track.

    Pipeline fields (status, notes, score) are never clobbered by a re-scrape.
    Returns the number of newly inserted rows.
    """
    inserted = 0
    with connect() as conn:
        for row in rows:
            cur = conn.execute(
                "SELECT 1 FROM opportunities WHERE notice_id = ?", (row["notice_id"],)
            )
            if cur.fetchone():
                conn.execute(
                    """UPDATE opportunities SET
                         title=?, response_deadline=?, archive_date=?, notice_type=?,
                         raw_json=?, updated_at=datetime('now')
                       WHERE notice_id=?""",
                    (row["title"], row["response_deadline"], row["archive_date"],
                     row["notice_type"], row["raw_json"], row["notice_id"]),
                )
            else:
                conn.execute(
                    """INSERT INTO opportunities (
                         notice_id, title, solicitation_number, agency, sub_agency,
                         office, naics, classification_code, set_aside, notice_type,
                         posted_date, response_deadline, archive_date,
                         place_of_performance, description_url, ui_link, source, raw_json
                       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (row["notice_id"], row["title"], row["solicitation_number"],
                     row["agency"], row["sub_agency"], row["office"], row["naics"],
                     row["classification_code"], row["set_aside"], row["notice_type"],
                     row["posted_date"], row["response_deadline"], row["archive_date"],
                     row["place_of_performance"], row["description_url"],
                     row["ui_link"], row.get("source", "sam.gov"), row["raw_json"]),
                )
                inserted += 1
    return inserted


def list_opportunities(status=None, limit=25, order="score"):
    order_sql = {
        "score": "score DESC",
        "deadline": "response_deadline ASC",
        "posted": "posted_date DESC",
    }.get(order, "score DESC")
    sql = "SELECT * FROM opportunities"
    params = []
    if status:
        sql += " WHERE status = ?"
        params.append(status)
    sql += f" ORDER BY {order_sql} LIMIT ?"
    params.append(limit)
    with connect() as conn:
        return [dict(r) for r in conn.execute(sql, params).fetchall()]


def get_opportunity(notice_id):
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM opportunities WHERE notice_id = ? OR solicitation_number = ?",
            (notice_id, notice_id),
        ).fetchone()
        return dict(row) if row else None


def set_status(notice_id, status, note=None):
    if status not in VALID_STATUSES:
        raise ValueError(f"Invalid status {status!r}. Valid: {', '.join(VALID_STATUSES)}")
    with connect() as conn:
        cur = conn.execute(
            "UPDATE opportunities SET status=?, updated_at=datetime('now') WHERE notice_id=?",
            (status, notice_id),
        )
        if cur.rowcount == 0:
            raise KeyError(f"No opportunity with notice_id {notice_id!r}")
        if note:
            conn.execute(
                "UPDATE opportunities SET notes = notes || ? WHERE notice_id=?",
                (f"\n[{status}] {note}", notice_id),
            )


def save_scores(scored):
    with connect() as conn:
        for notice_id, score, reasons in scored:
            conn.execute(
                "UPDATE opportunities SET score=?, score_reasons=? WHERE notice_id=?",
                (score, json.dumps(reasons), notice_id),
            )


def pipeline_summary():
    with connect() as conn:
        rows = conn.execute(
            "SELECT status, COUNT(*) AS n FROM opportunities GROUP BY status ORDER BY n DESC"
        ).fetchall()
        return {r["status"]: r["n"] for r in rows}
