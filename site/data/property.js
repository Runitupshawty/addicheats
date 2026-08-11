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

     The copy below is finished — you only need to swap the
     [BRACKETED] facts for your own. Rewrite freely if you like.
     ------------------------------------------------------------------ */
  chapters: {

    // Chapter 1 — the aerial hero shot. First thing anyone sees.
    arrival: {
      eyebrow: "Welcome home",
      headline: "Thirty homes above [NEIGHBORHOOD]",
      body: "Some addresses you have to explain. This one you just point to. [PROPERTY NAME] sits where the city is at its best — and keeps the noise politely below.",
    },

    // Chapter 2 — the view from the sidewalk.
    approach: {
      eyebrow: "The approach",
      headline: "A building that belongs on its street",
      body: "Brick, glass, and good proportions on [EXAMPLE ST]. It was designed to be walked past slowly — and walked into often.",
    },

    // Chapter 3 — through the front doors.
    entrance: {
      eyebrow: "Step inside",
      headline: "The lobby sets the tone",
      body: "Warm light, honest materials, and a front desk that learns your name by week two. This is the last time you'll ever feel like a visitor here.",
    },

    // Chapter 4 — inside a residence: the living room.
    living: {
      eyebrow: "The living room",
      headline: "Room to actually live in",
      body: "Tall windows, real corners for real furniture, and light that moves across the floor all afternoon. Bring the big sofa. It fits.",
    },

    // Chapter 5 — the kitchen.
    kitchen: {
      eyebrow: "The kitchen",
      headline: "Cook like you mean it",
      body: "Full-size appliances, counter space that doesn't make you choose, and storage where you'd expect it. Tuesday dinners just got ambitious.",
    },

    // Chapter 6 — bedroom and bath.
    rest: {
      eyebrow: "Rest easy",
      headline: "Quiet where it counts",
      body: "Bedrooms sit off the street side, so the day ends when you say it does. The bath keeps mornings simple: good light, hot water, no drama.",
    },

    // Chapter 7 — shared amenities.
    amenities: {
      eyebrow: "Beyond your door",
      headline: "The courtyard is the third room",
      body: "A planted courtyard for slow mornings, a gym for honest ones, and laundry that never means leaving the building. Small luxuries, used daily.",
    },

    // Chapter 8 — the neighborhood.
    neighborhood: {
      eyebrow: "Out the front door",
      headline: "[NEIGHBORHOOD] does the rest",
      body: "Coffee at the corner, groceries two blocks down, the [EXAMPLE PARK] a short walk away. Live here a month and you'll have a usual order somewhere.",
    },
  },

  /* ------------------------------------------------------------------
     FLOOR PLANS
     One entry per plan. These build the tabbed floor-plan section
     and the "unit type" choices on the tour form.

     For each plan:
       id        — short unique code, lowercase, no spaces (leave as is)
       label     — the name visitors see on the tab
       art       — the drawing file to show (matches a file in assets/)
       sqft      — square footage, as text
       rent      — monthly rent or range, as text
       beds      — number of bedrooms (0 for studio), no quotes
       baths     — number of bathrooms, no quotes
       available — short availability note shown as a badge,
                   e.g. "[2 available]" or "[Waitlist]"
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
    },
  ],

  /* ------------------------------------------------------------------
     LEGAL LINES — shown in the footer
     equalHousing    — leave as true; prints the Equal Housing
                       Opportunity statement.
     enhancedImagery — honesty line about the placeholder illustrations.
                       Update or remove once real photography is in.
     disclaimer      — your standard pricing/availability disclaimer.
     ------------------------------------------------------------------ */
  legal: {
    equalHousing: true,
    enhancedImagery: "Illustrations are placeholders pending photography.",
    disclaimer: "[Pricing and availability subject to change.]",
  },
};
