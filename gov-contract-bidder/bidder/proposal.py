"""Generate a draft bid package (Markdown) for an opportunity.

The draft is a starting point: it pulls in your company profile, the
opportunity details, and a compliance checklist. You review, complete the
pricing, and submit it yourself through the portal named in the notice —
submission is deliberately NOT automated because a bid is a binding offer.
"""

import json
from datetime import datetime

from . import config


def _section(title, body):
    return f"## {title}\n\n{body.strip()}\n"


def build_draft(opp, profile):
    poc = profile.get("point_of_contact", {})
    certs = ", ".join(profile.get("certifications", [])) or "None listed"
    caps = profile.get("capabilities", [])
    past = profile.get("past_performance", [])

    parts = [
        f"# Bid Draft: {opp['title']}",
        "",
        f"*Generated {datetime.now():%Y-%m-%d %H:%M} — DRAFT, requires human review "
        "and manual submission through the portal listed in the notice.*",
        "",
        _section("Opportunity Summary", "\n".join(filter(None, [
            f"- **Notice ID:** {opp['notice_id']}",
            f"- **Solicitation #:** {opp.get('solicitation_number') or 'n/a'}",
            f"- **Agency:** {opp.get('agency') or 'n/a'}"
            + (f" / {opp['sub_agency']}" if opp.get("sub_agency") else ""),
            f"- **Type:** {opp.get('notice_type') or 'n/a'}",
            f"- **NAICS:** {opp.get('naics') or 'n/a'}",
            f"- **Set-aside:** {opp.get('set_aside') or 'Full & open'}",
            f"- **Response deadline:** {opp.get('response_deadline') or 'see notice'}",
            f"- **Place of performance:** {opp.get('place_of_performance') or 'see notice'}",
            f"- **Notice link:** {opp.get('ui_link') or 'n/a'}",
        ]))),
        _section("Offeror Information", "\n".join([
            f"- **Company:** {profile.get('company_name')}",
            f"- **UEI:** {profile.get('uei') or 'TODO'}",
            f"- **CAGE:** {profile.get('cage_code') or 'TODO'}",
            f"- **POC:** {poc.get('name', '')} — {poc.get('email', '')} {poc.get('phone', '')}".strip(),
            f"- **Certifications:** {certs}",
        ])),
        _section("Understanding of the Requirement",
                 "TODO: Read the full solicitation (link above) and summarize what the "
                 "agency is buying, the period of performance, and evaluation criteria here."),
        _section("Technical Approach", "\n".join(
            [f"- {c}" for c in caps] or
            ["TODO: Describe how you will perform the work."]
        ) + "\n\nTODO: Tailor each capability to the statement of work."),
        _section("Past Performance", "\n".join(
            [f"- **{p.get('title', 'Project')}** — {p.get('client', '')}: {p.get('summary', '')}"
             for p in past] or
            ["TODO: Add 2-3 relevant past projects with client, value, and outcome."]
        )),
        _section("Pricing", "TODO: Complete pricing per the solicitation's format "
                            "(CLIN structure, labor categories, or lump sum as required). "
                            "**Never submit without confirming pricing.**"),
        _section("Compliance Checklist", "\n".join([
            "- [ ] Read the FULL solicitation document and all attachments",
            "- [ ] Confirm SAM.gov registration is active (UEI current)",
            "- [ ] Confirm eligibility for the set-aside (if any)",
            "- [ ] Include all required reps & certs / forms",
            "- [ ] Follow page limits, fonts, and file-format instructions exactly",
            "- [ ] Ask questions before the Q&A cutoff date",
            "- [ ] Submit through the exact method in the notice (portal/email) BEFORE the deadline",
        ])),
    ]
    return "\n".join(parts)


def write_draft(opp, profile):
    config.DRAFTS_DIR.mkdir(parents=True, exist_ok=True)
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in opp["notice_id"])[:60]
    path = config.DRAFTS_DIR / f"{safe}.md"
    path.write_text(build_draft(opp, profile))
    return path
