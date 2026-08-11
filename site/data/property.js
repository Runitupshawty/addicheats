/* ==========================================================================
   PROPERTY DATA — THE ONLY FILE YOU EDIT
   ==========================================================================

   Hello! This file is the entire "content management system" for this site.
   Everything the site says — the property name, the address, the story copy,
   the floor plans, the prices — lives right here, in plain text.

   HOW TO EDIT:
   1. Anything wrapped in [SQUARE BRACKETS] is a fake placeholder.
      Replace the whole thing, brackets included:
         "[PROPERTY NAME]"  ->  "The Meridian"
   2. Keep the quotation marks around every value.
   3. Keep the commas at the end of lines exactly as they are.
   4. Save the file and refresh the site in your browser. That's it.

   You do NOT need to touch any other file. If something breaks, undo your
   last change — the most common mistake is a deleted quote mark or comma.
   ========================================================================== */

window.PROPERTY = {

  /* ------------------------------------------------------------------
     THE BASICS
     Shown in the header, the tour section, and the footer.
     ------------------------------------------------------------------ */
  name: "[PROPERTY NAME]",

  // One short line describing the property. Appears near the top.
  tagline: "[30 residences in the heart of [NEIGHBORHOOD]]",

  // Street address. Shown in the tour section and footer.
  address: {
    line1: "[123 EXAMPLE ST]",
    city: "[CITY]",
    state: "[ST]",
    zip: "[00000]",
  },

  // Leasing office contact info. The phone becomes a tap-to-call link,
  // the email becomes a click-to-email link.
  phone: "[(555) 555-0100]",
  email: "[leasing@example.com]",
  hours: "[Mon–Fri 9–6, Sat 10–4]",

  /* ------------------------------------------------------------------
     BUTTON LABELS
     header = button in the top bar
     sticky = floating button that follows the visitor as they scroll
     form   = submit button on the tour request form
     ------------------------------------------------------------------ */
  cta: {
    header: "Book a Tour",
    sticky: "Book a Tour",
    form: "Request a Tour",
  },

  /* ------------------------------------------------------------------
     THE SCROLL STORY — EIGHT CHAPTERS
     As visitors scroll, they walk through the property in this order:
     arrival (aerial) -> approach (street) -> entrance (lobby) ->
     living room -> kitchen -> bedroom & bath -> amenities -> neighborhood.

     Each chapter has three lines:
       eyebrow  — tiny label above the headline (2–4 words)
       headline — the big line (keep it under 8 words)
       body     — one or two short sentences

     HOUSE STYLE, if you rewrite: name real things (brick, terrazzo, the
     corner shop) rather than feelings. Short sentences. No "nestled",
     no "boasts", no "luxury living" — the pictures do that job. If a fact
     is not confirmed yet, leave it in [BRACKETS] rather than guessing.
     ------------------------------------------------------------------ */
  chapters: {

    // Chapter 1 — the aerial hero shot. First thing anyone sees.
    arrival: {
      eyebrow: "First sight",
      headline: "Thirty homes above [NEIGHBORHOOD]",
      body: "Four storeys of brick wrapped around a planted courtyard. Thirty front doors, one address you can point to.",
    },

    // Chapter 2 — the view from the sidewalk.
    approach: {
      eyebrow: "From the sidewalk",
      headline: "Brick, glass, good proportions",
      body: "[EXAMPLE ST] at street level: tall ground-floor windows, a brass canopy over the recessed entry, bike racks under the trees.",
    },

    // Chapter 3 — through the front doors.
    entrance: {
      eyebrow: "Through the doors",
      headline: "The lobby sets the tone",
      body: "Terrazzo floor, a timber-panelled wall, a brass mail bank. There's a bench by the door for the two minutes you're waiting.",
    },

    // Chapter 4 — inside a residence: the living room.
    living: {
      eyebrow: "The living room",
      headline: "Room for the big sofa",
      body: "Deep window reveals, oak floors, corners square enough for real furniture. Afternoon light crosses the room and stays a while.",
    },

    // Chapter 5 — the kitchen.
    kitchen: {
      eyebrow: "The kitchen",
      headline: "Counter space you'll use",
      body: "Full-size appliances and a stone run long enough for two cooks. Tall pantry, deep drawers, brass tap over an undermount sink.",
    },

    // Chapter 6 — bedroom and bath.
    rest: {
      eyebrow: "Rest easy",
      headline: "Quiet where it counts",
      body: "Bedrooms face away from [EXAMPLE ST], so the day ends when you say it does. The bath is small and works: wall-hung vanity, wide mirror, tile to the ceiling.",
    },

    // Chapter 7 — shared amenities.
    amenities: {
      eyebrow: "Beyond your door",
      headline: "The courtyard is the third room",
      body: "One mature tree, a long table, planted beds either side. Gym and laundry sit behind the ground-floor glass, so neither means leaving the building.",
    },

    // Chapter 8 — the neighborhood.
    neighborhood: {
      eyebrow: "Out the front door",
      headline: "[NEIGHBORHOOD] does the rest",
      body: "Coffee on the corner, groceries two blocks down, [EXAMPLE PARK] a [N]-minute walk. Give it a month and you'll have a usual order somewhere.",
    },
  },

  /* ------------------------------------------------------------------
     FLOOR PLANS
     One entry per plan. These build the tabbed floor-plan section
     and the "unit type" choices on the tour form.

     For each plan:
       id        — short unique code, lowercase, no spaces (leave as is)
       label     — the name visitors see on the tab and as the plan title
       art       — the drawing file to show (matches a file in assets/)
       sqft      — square footage. NUMBER ONLY, no "sq ft" — the site adds
                   the unit for you. Keep the brackets until it's confirmed.
       rent      — monthly rent or range, as text. The site adds "per month".
       beds      — number of bedrooms (0 for studio), no quotes
       baths     — number of bathrooms, no quotes
       available — short availability note shown as a badge,
                   e.g. "[2 available]" or "[Waitlist]"
       note      — OPTIONAL one-line detail shown under the plan name.
                   Delete the line entirely if a plan doesn't need one.
     ------------------------------------------------------------------ */
  plans: [
    {
      id: "studio",
      label: "Studio",
      art: "plan-studio",
      sqft: "[480]",
      rent: "[$1,250–$1,400]",
      beds: 0,
      baths: 1,
      available: "[2 available]",
      note: "[Courtyard-facing, top two floors]",
    },
    {
      id: "1br",
      label: "One Bedroom",
      art: "plan-1br",
      sqft: "[680]",
      rent: "[$1,550–$1,750]",
      beds: 1,
      baths: 1,
      available: "[5 available]",
      note: "[Bedroom off the street side, walk-in closet]",
    },
    {
      id: "2br",
      label: "Two Bedroom",
      art: "plan-2br",
      sqft: "[950]",
      rent: "[$1,950–$2,300]",
      beds: 2,
      baths: 2,
      available: "[Waitlist]",
      note: "[Corner homes, windows on two sides]",
    },
  ],

  /* ------------------------------------------------------------------
     LEGAL + HONESTY LINES — shown in the footer
     These are the lines that keep the site honest about what the
     visitor is actually looking at. Do not quietly delete them.

     equalHousing       — leave as true; prints the Equal Housing
                          Opportunity statement.
     enhancedImagery    — the drawings. Update or remove once real
                          photography is in.
     illustrativeFootage— the four video chapters. The current clips are
                          AI-generated and are NOT this building. Remove
                          this line ONLY when the videos are replaced with
                          real footage of the real property.
     footageLabel       — short version of the above, printed as a small
                          label on each video chapter.
     artLabel           — short version for the drawn (SVG) chapters.
     disclaimer         — your standard pricing/availability disclaimer.
     ------------------------------------------------------------------ */
  legal: {
    equalHousing: true,

    enhancedImagery:
      "Every still image on this site is a hand-drawn illustration standing in for photography. None of them is a photograph of [PROPERTY NAME].",

    illustrativeFootage:
      "The four video chapters — arrival, approach, living room and kitchen — are AI-generated illustrative footage. They are not the actual property and do not show any real unit, finish or view here.",

    footageLabel: "Illustrative footage — not the actual property",
    artLabel: "Illustration — placeholder for photography",

    disclaimer: "[Pricing and availability subject to change.]",
  },
};

/* INTEGRATION NOTE: for the Structure owner — per-chapter honesty labels.
   The Round 2 addendum asks every chapter to carry a small, legible note.
   Two ready-made strings live above so the wording stays in one place:

     window.PROPERTY.legal.footageLabel  -> the four VIDEO chapters
       (ch-arrival, ch-approach, ch-living, ch-kitchen)
     window.PROPERTY.legal.artLabel      -> the four SVG chapters
       (ch-entrance, ch-rest, ch-amenities, ch-neighborhood)

   Bind them the same way as any other copy — js/site.js fills these
   automatically via textContent, no extra JS required:

     <p class="chapter__disclosure" data-bind="legal.footageLabel">
       Illustrative footage — not the actual property</p>

   (Keep the fallback text inside the element so it survives JS being off.)
   The long-form versions of both lines are printed in the footer by
   js/site.js under a headed "About the imagery on this page" block. */
