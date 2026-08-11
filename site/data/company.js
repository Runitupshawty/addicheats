/* ==========================================================================
   COMPANY DATA — THE ONLY FILE YOU EDIT
   ==========================================================================

   Hello! This one file is the entire "content management system" for this
   site. Everything the site says — the company name, the phone number, the
   walkthrough copy, the services, the prices, the quote form's labels —
   lives right here, in plain text.

   WHAT THIS SITE IS
   This is the marketing site for a PROPERTY MANAGEMENT COMPANY. It sells
   management services to PROPERTY OWNERS AND INVESTORS. Nothing on it is
   for rent, and no visitor to it is a prospective tenant. If a line of copy
   starts sounding like an apartment listing ("your new home", "you'll love
   the light"), it is in the wrong voice — rewrite it for the owner.

   HOW TO EDIT
   1. Anything wrapped in [SQUARE BRACKETS] is a placeholder standing in for
      a real fact we do not have yet. Replace the whole thing, brackets and
      all:
          "[COMPANY NAME]"   ->  "Harbor & Vine Management"
          "[8%]"             ->  "7.5%"
          "[(555) 555-0100]" ->  "(312) 555-0184"
   2. Keep the quotation marks around every value.
   3. Keep the commas at the end of lines exactly as they are.
   4. Save the file and refresh the site in your browser. That's it.

   THE BRACKETS ARE A SAFETY RAIL, NOT DECORATION
   Every number on this site is bracketed because none of them has been
   confirmed. Do not un-bracket a number by guessing at it. A visible
   "[24 hrs]" on a live site is embarrassing for an afternoon; an invented
   "24 hrs" you cannot actually hit is a promise you will be held to.

   You do NOT need to touch any other file. If something breaks, undo your
   last change — the most common mistake is a deleted quote mark or comma.
   Open the browser console (F12) and the site will tell you, by name,
   exactly which line it could not find.
   ========================================================================== */

window.COMPANY = {

  /* ==================================================================
     1. THE BASICS
     Shown in the header, the quote section and the footer.
     ================================================================== */

  // Your company's name, exactly as it should appear in print.
  name: "[COMPANY NAME]",

  // One short line: what you do and who for. Sits under the name in the
  // hero. Keep it to a single breath — under about 12 words.
  tagline: "[Property management for owners of small and mid-size multifamily]",

  // The city or metro you work in. Used in the hero and the quote panel.
  // If you cover several, write them the way an owner would say them:
  // "Chicago & the North Shore", not "IL-Cook-Lake".
  serviceArea: "[CITY / METRO AREA]",

  // How owners reach you. The phone becomes a tap-to-call link and the
  // email becomes a click-to-email link, automatically.
  phone: "[(555) 555-0100]",
  email: "[owners@example.com]",
  hours: "[Mon–Fri 9–6]",

  // Your office address. Printed in the quote panel and the footer.
  address: {
    line1: "[123 EXAMPLE ST]",
    city: "[CITY]",
    state: "[ST]",
    zip: "[00000]",
  },

  /* ==================================================================
     2. BUTTON LABELS
     header = the button in the top bar
     sticky = the floating button that follows visitors as they scroll
     form   = the submit button at the bottom of the quote form
     All three lead to the same place: the quote request.
     ================================================================== */
  cta: {
    header: "Get a Quote",
    sticky: "Get a Quote",
    form: "Request My Quote",
  },

  /* ==================================================================
     3. THE SCROLL WALKTHROUGH — EIGHT CHAPTERS

     As an owner scrolls, they walk through a building from the street to
     the surrounding blocks. The argument is NOT "come live here." It is
     PROOF OF STANDARD: this is the condition we hold buildings to, and
     this is the operational work that keeps them there.

     Order: arrival -> approach (curb) -> entrance (common areas) ->
     living (turnover) -> kitchen (preventive maintenance) ->
     rest (inspections) -> amenities (shared spaces) ->
     neighborhood (local market knowledge).

     Each chapter has three lines:
       eyebrow  — tiny label above the headline (2–4 words)
       headline — the big line (keep it under about 8 words)
       body     — two or three short sentences

     HOUSE STYLE, if you rewrite:
       • Address the OWNER. Never "your new home", never "you'll love".
       • Use the operational nouns of this business — turnover days, work
         orders, inspection cadence, reserve planning, days on market.
         They are the vocabulary that proves you actually do the job.
       • Name real things rather than feelings. Short sentences.
       • No "nestled", no "boasts", no "full-service excellence".
       • Any number stays in [BRACKETS] until it is confirmed and true.
     ================================================================== */
  chapters: {

    // Chapter 1 — the aerial hero. First thing anyone sees.
    // This one introduces the COMPANY, not a building.
    arrival: {
      eyebrow: "Property management",
      headline: "The standard we hold buildings to",
      body: "[COMPANY NAME] manages small and mid-size multifamily for owners across [CITY / METRO AREA]. What follows is a walk through a building run to that standard — curb to courtyard — and the work behind each part of it.",
    },

    // Chapter 2 — the view from the sidewalk. Curb appeal as an asset.
    approach: {
      eyebrow: "From the curb",
      headline: "The first showing happens before anyone calls",
      body: "Landscaping on a schedule. Enclosures that close, signage that is lit and current, masonry and gutters logged the season they start to go rather than the year they fail. A prospect decides what kind of building this is from the sidewalk — and so does an appraiser.",
    },

    // Chapter 3 — through the front doors. Common areas and cleaning cadence.
    entrance: {
      eyebrow: "Common areas",
      headline: "Cleaned on a cadence, not on a complaint",
      body: "Lobbies, corridors, stairs and mail rooms on a [weekly] cleaning schedule with a signed log. Door hardware, access codes and lighting checked [monthly] and photographed. Common areas are where deferred maintenance hides, because nobody's lease depends on them.",
    },

    // Chapter 4 — inside a unit. Turnover quality and re-let speed.
    living: {
      eyebrow: "Turnover",
      headline: "Re-let ready, not just empty",
      body: "A move-out inspection with dated photographs, a scoped punch list, and trades booked before the keys are back on the hook. Paint, deep clean, hardware, filters, then listed. We work to [X] days from move-out to on-market, because vacancy is the most expensive line on your statement.",
    },

    // Chapter 5 — the kitchen. Preventive maintenance and capital planning.
    kitchen: {
      eyebrow: "Preventive maintenance",
      headline: "Replace it on your schedule, or on its own",
      body: "Appliances, water heaters, HVAC and roofs tracked by install date and remaining life, so a replacement lands in a budget year instead of on a Saturday at emergency rates. Every building carries a reserve plan, and the plan is updated the month a capital item is spent.",
    },

    // Chapter 6 — bedroom and bath. Inspections and tenant care.
    rest: {
      eyebrow: "Inspections",
      headline: "Small problems, found early, in writing",
      body: "Interior inspections [twice a year], each one a dated report with photographs. Work orders acknowledged within [24 hours] and tracked until they close. A resident who can reach someone reports the leak in week one instead of at move-out, when it has become a floor.",
    },

    // Chapter 7 — shared amenities. The spaces that cost money.
    amenities: {
      eyebrow: "Shared spaces",
      headline: "The rooms that earn their renewals",
      body: "Courtyards, gyms, laundry and parcel rooms cost money every month and only pay it back at renewal. Equipment under service contract, surfaces and lighting on the same cadence as the lobby, and every cost itemised on your statement so you can see what each room actually returns.",
    },

    // Chapter 8 — the neighborhood. Local market knowledge and pricing.
    neighborhood: {
      eyebrow: "This market",
      headline: "Priced to the block, not to the metro",
      body: "Rents set from comparable units within [a half-mile], re-checked at every renewal rather than once a year. Concessions, days on market and renewal rates reported to you [monthly]. A rent increase should be a decision with evidence behind it, and a decision you make.",
    },
  },

  /* ==================================================================
     4. SERVICES — what an owner is actually buying

     Five to seven services. Each one needs:
       id    — short unique code, lowercase, no spaces (leave these as-is)
       title — the service, named the way an owner would name it
       body  — one or two sentences on why it matters to their return
       items — the CONCRETE DELIVERABLES. This is the part owners read.
               "Vetted vendors" is a sentiment; "Owner approval required
               above [$500]" is a deliverable. Aim for the second kind.

     To remove a service, delete its whole { … } block including the
     trailing comma. To add one, copy an existing block and edit it.
     ================================================================== */
  services: [

    {
      id: "leasing",
      title: "Leasing & tenant placement",
      body: "Filling a vacancy with a resident who pays and stays is the single highest-value thing we do. Listing, showings, screening and signing run as one process, so a unit never sits waiting on a handoff between two people.",
      items: [
        "Photography, listing copy and syndication to the major portals",
        "Showings scheduled and covered, with prospect follow-up",
        "Credit, income, rental history and eviction screening on written criteria",
        "Lease preparation, e-signature and deposit handling",
        "Move-in inspection with dated photographs of every room",
      ],
    },

    {
      id: "rent",
      title: "Rent collection & owner accounting",
      body: "Rent in on time, money out where it belongs, and a monthly statement your accountant can use without rebuilding it first.",
      items: [
        "Online payments with autopay enrolment at signing",
        "Late notices and delinquency follow-up on a fixed, documented schedule",
        "Owner draw on the same day every month",
        "Monthly statement, annual summary and year-end [1099] packet",
        "Income and expense tracked per property, not pooled",
      ],
    },

    {
      id: "maintenance",
      title: "Maintenance & work orders",
      body: "One intake, one queue, one record. A resident reports it, a vetted trade fixes it, and you can see afterwards what it cost and why it was necessary.",
      items: [
        "[24/7] emergency line answered by a dispatcher, not voicemail",
        "Licensed and insured trades, with certificates tracked on file",
        "Your written approval required on any repair over [$500]",
        "Before-and-after photographs attached to every closed work order",
        "A preventive maintenance calendar per building, not per crisis",
      ],
    },

    {
      id: "turnover",
      title: "Turnovers & make-ready",
      body: "The gap between residents is the only stretch of the year the building earns nothing. We compress it by writing the scope on move-out day and booking trades in the order they can actually work.",
      items: [
        "Move-out inspection and deposit disposition inside the statutory window",
        "Itemised make-ready scope with bids, sent to you before work starts",
        "Paint, clean, flooring and hardware sequenced rather than stacked",
        "Re-listed the day the unit is show-ready, not the week after",
      ],
    },

    {
      id: "compliance",
      title: "Compliance & risk",
      body: "Leases, notices and inspections that hold up when they are tested. The expensive part of property management is the part that goes wrong, and most of it goes wrong on paper first.",
      items: [
        "Lease documents kept current with state and city requirements",
        "Notices served correctly, with a documented delivery trail",
        "Habitability, smoke/CO and [local registration] inspections calendared",
        "Insurance certificates collected and re-collected from every vendor",
        "Filing and court coordination when an eviction is unavoidable",
      ],
    },

    {
      id: "reporting",
      title: "Reporting & capital planning",
      body: "You should be able to answer “how is the building doing” in under a minute, and plan the next five years without a spreadsheet archaeology project. That is what the monthly package is for.",
      items: [
        "Monthly owner statement opening with a plain-English summary",
        "Rent roll, delinquency and occupancy on one page",
        "Rolling [12]-month capital plan with a reserve target per building",
        "Annual budget and rent review before renewal season, not after",
        "A named manager who knows your building and answers their own phone",
      ],
    },
  ],

  /* ==================================================================
     5. WHY OWNERS CHOOSE US — three or four differentiators

     Each one needs:
       id    — short unique code (leave as-is)
       stat  — OPTIONAL big number or short phrase. MUST stay bracketed
               until it is measured. Delete the line entirely if a point
               has no number worth pulling out.
       title — the claim, in four or five words
       body  — two or three sentences of substance behind it

     READ THIS BEFORE PUBLISHING: every line below is a promise an owner
     will hold you to in month three. Delete any you cannot keep. A
     differentiator you miss is worse than one you never claimed.
     ================================================================== */
  why: [

    {
      id: "response",
      stat: "[24 hrs]",
      title: "Someone actually answers",
      body: "Every work order is acknowledged within [24 hours] by a person with your building's history already in front of them — not a ticket number and a callback window. Emergencies route to a [24/7] line staffed by a dispatcher who can send a trade tonight.",
    },

    {
      id: "book",
      stat: "[X units]",
      title: "A capped book per manager",
      body: "No manager here carries more than [X] units. That cap is the whole difference between an inspection that happens and one that gets rescheduled twice. If your building needs a walk-through this week, there is someone with the room to do it.",
    },

    {
      id: "transparency",
      stat: "[0%]",
      title: "No markup on repairs",
      body: "Vendor invoices pass through at cost with the original attached. We do not own a maintenance company, we do not take vendor rebates, and we do not bill a percentage on top of a repair. Our management fee is the whole of what we make from your building.",
    },

    {
      id: "local",
      stat: "[Since 20XX]",
      title: "One market, known properly",
      body: "We work [CITY / METRO AREA] and nowhere else. That means comparable rents from the same blocks rather than a metro average, trades we have used for years who will take the call tomorrow, and inspectors and clerks we know by name.",
    },
  ],

  /* ==================================================================
     6. PRICING

     model — ONE paragraph on how your fees work, in the owner's terms.
             This is where you head off the questions a table cannot
             answer: what the percentage is taken from, what is charged
             once versus monthly, and what it costs to leave.

     tiers — exactly three. Each needs:
               id       — short code (leave as-is)
               name     — the plan name
               rate     — the headline number, bracketed
               rateNote — what the rate is charged on
               summary  — one line: who this tier is for
               includes — the bullet list
               featured — true on EXACTLY ONE tier, false on the others.
                          The featured tier is drawn larger.
               badge    — OPTIONAL short label on the featured tier only.
                          Leave it out and it reads "Recommended".

     notes — the fine print an owner asks about on the call anyway. Every
             one of these is a commitment; keep them bracketed until each
             is confirmed against your actual management agreement.
     ================================================================== */
  pricing: {

    model:
      "Management is billed as a percentage of rent actually collected — if a unit sits empty or a resident does not pay, we are not paid on it either. Leasing is billed once per placement, so filling a vacancy shows up as its own visible line rather than being buried in a higher monthly rate. There is no onboarding fee and no markup on vendor invoices, and the agreement ends on [30 days'] written notice without a termination penalty. Treat every number below as a starting point: unit count, current condition and the state of the rent roll all move it, which is why the quote comes after we have walked the building.",

    tiers: [

      {
        id: "essential",
        name: "[Essential]",
        rate: "[8%]",
        rateNote: "of monthly rent collected",
        summary: "For owners who handle their own leasing and need the month to simply run.",
        includes: [
          "Rent collection, autopay and delinquency follow-up",
          "Maintenance intake and vendor dispatch",
          "Monthly owner statement and a fixed draw date",
          "Lease renewals and an annual rent review",
          "[One] interior inspection a year, with photographs",
        ],
        featured: false,
      },

      {
        id: "full",
        name: "[Full Service]",
        rate: "[10%]",
        rateNote: "of monthly rent collected",
        summary: "The whole operation — leasing, turnovers and the reporting most owners actually want.",
        includes: [
          "Everything in [Essential]",
          "Leasing and tenant placement, at [half of one month's rent] per placement",
          "Turnover scoping, bids and make-ready management",
          "[Semi-annual] interior inspections with dated reports",
          "Rolling [12]-month capital plan and reserve target",
          "Compliance calendar, notice service and filings",
        ],
        featured: true,
        badge: "[Most owners start here]",
      },

      {
        id: "portfolio",
        name: "[Portfolio]",
        rate: "[Custom]",
        rateNote: "quoted per portfolio, from [20] units",
        summary: "For owners running several buildings, where one flat percentage stops making sense.",
        includes: [
          "Everything in [Full Service]",
          "A blended rate across every building you own",
          "A named manager and a standing monthly call",
          "Consolidated reporting plus per-property detail",
          "Annual budget, reserve review and refinance-ready packets",
          "Acquisition walk-throughs and take-over planning",
        ],
        featured: false,
      },
    ],

    notes: [
      "[Leasing fee: half of one month's rent, charged only when a lease is signed.]",
      "[No setup, onboarding or take-over fee.]",
      "[No markup on vendor invoices — you pay what the trade charges.]",
      "[Your written approval is required on any repair over $500.]",
      "[Cancel on 30 days' written notice. No termination penalty.]",
      "[Rates shown are illustrative until we have seen the property.]",
    ],
  },

  /* ==================================================================
     7. THE QUOTE FORM

     intro          — one or two sentences setting expectations BEFORE
                      someone starts typing. Say what they get back and
                      how long it takes.
     fields         — the label and hint for each field, so wording can be
                      changed here without touching any JavaScript.
                      • label — always shown, always visible (never a
                        placeholder-only field; placeholders vanish the
                        moment someone types and take the question with
                        them)
                      • hint  — optional. Delete the line if a field does
                        not need one. Hints are read aloud by screen
                        readers along with the label.
     situations     — the choices in the "where you are today" menu.
     propertyTypes  — the choices in the "property type" menu.

     Required fields are name, contact, property address and unit count.
     Which fields are required is set in js/site.js — the wording is here.
     ================================================================== */
  quote: {

    intro:
      "Tell us about the property and we will come back with a written quote: the rate, exactly what it covers, and what we would do in the first [30] days. It costs nothing, it commits you to nothing, and if we are not the right manager for this building we will say so.",

    fields: {

      name: {
        label: "Your name",
      },

      contact: {
        label: "Phone or email",
        hint: "Either is fine — whichever is easier to reach you on. We do not add you to a mailing list.",
      },

      propertyAddress: {
        label: "Property address",
        hint: "Street and city is enough. If this is a portfolio, give us the largest building.",
      },

      units: {
        label: "Number of units",
        hint: "Count doors, not buildings. Enter 1 for a single house.",
      },

      propertyType: {
        label: "Property type",
      },

      situation: {
        label: "Where you are today",
      },

      message: {
        label: "Anything we should know",
        hint: "Optional. Current headaches, timing, a target handover date — whatever matters most.",
      },
    },

    situations: [
      "Self-managed today",
      "With another manager",
      "New acquisition",
      "Still deciding",
    ],

    propertyTypes: [
      "Single-family",
      "Duplex / triplex",
      "Small multifamily (4–20)",
      "Mid-size multifamily (20–100)",
      "Larger / mixed portfolio",
    ],
  },

  /* ==================================================================
     8. LEGAL + HONESTY LINES

     These keep the site truthful about what a visitor is looking at.
     Do not quietly delete them.

     This matters more on this site than it would on a rental listing.
     An owner scrolling these chapters is being shown a standard of work,
     and it would be easy for them to read the footage as a portfolio of
     buildings under management. It is not one. Implying otherwise is a
     false claim about the BUSINESS, not just about a photograph.

       equalHousing  — leave as true; prints the Equal Housing
                       Opportunity statement in the footer.
       footageLabel  — the small label printed on each VIDEO chapter.
       artLabel      — the small label printed on each DRAWN chapter.
       imagery       — the full explanation, printed in the footer at
                       ordinary body size. Remove it ONLY when every clip
                       and every drawing has been replaced with real
                       photography of buildings you really manage — and
                       then replace it with a credit, not with nothing.
       disclaimer    — your standard fees-and-terms disclaimer.
     ================================================================== */
  legal: {

    equalHousing: true,

    footageLabel: "Illustrative footage — not a property under management",

    artLabel: "Illustration — placeholder for photography",

    imagery:
      "The moving footage on this page is AI-generated and the still images are drawings. Neither shows a building [COMPANY NAME] manages, has managed, or is connected to in any way — there is no real address anywhere on this site. Nothing here is a portfolio, a case study or a before-and-after. The walkthrough exists to describe the standard of work we hold buildings to; for the actual condition of the properties under our management, ask us and we will put you in touch with the owners.",

    disclaimer: "[Fees and terms are illustrative and subject to a signed management agreement.]",
  },
};

/* ============================================================================
   INTEGRATION NOTE: for the Structure owner — per-chapter honesty labels
   ============================================================================

   Two ready-made strings live above so the wording stays in exactly one
   place, and js/site.js fills them automatically via textContent:

     window.COMPANY.legal.footageLabel  -> the four VIDEO chapters
       (ch-arrival, ch-approach, ch-living, ch-kitchen)
     window.COMPANY.legal.artLabel      -> the four SVG chapters
       (ch-entrance, ch-rest, ch-amenities, ch-neighborhood)

   Bind them like any other copy:

     <p class="chapter__note" data-bind="legal.footageLabel">
       Illustrative footage — not a property under management</p>

   Keep the fallback text inside the element so it survives JavaScript
   being switched off. The long-form version (legal.imagery) is printed in
   the footer by js/site.js under a headed "About the imagery on this page"
   block — unless index.html already carries a
   data-bind="legal.imagery" element, in which case site.js stands down and
   lets the markup own it, so it can never appear twice.
   ============================================================================ */
