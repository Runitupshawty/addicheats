# Build contract v3 — property MANAGEMENT COMPANY site

**This supersedes CONTRACT.md wherever the two disagree.** Read this one first.

## What changed and why

v1 and v2 built a leasing site advertising a single apartment building. That was
wrong. This is the marketing site for a **property management company** selling its
**services to property owners and investors**. Nothing on this site is for rent.

The scroll walkthrough stays — but its *job* has changed. It is no longer "come live
here." It is **proof of standard**: this is the condition we hold buildings to, this
is what a well-run property looks like under our management. Same footage, same
chapters, completely different argument.

Confirmed by the site owner:
- **Audience:** property owners and investors. Not tenants.
- **Primary action:** request a management quote.
- **Sections after the walkthrough:** Services, Why owners choose us, Pricing.
- **No portfolio/track-record section.** No floor plans. No tenant tour form.
- Real company details are not available yet — everything stays in `[BRACKETS]`.

## File ownership (unchanged owners, new scope)

| Owner | Files | Must not touch |
|---|---|---|
| **Structure** | `index.html`, `css/tokens.css`, `css/layout.css` | js/, assets/, data/ |
| **Content** | `data/company.js`, `js/site.js` | index.html, css/, assets/ |
| **Motion** | `js/scroll.js`, `css/chapters.css` | everything else |
| **Art** | `assets/*.svg` | everything else |

**Motion and Art are DONE and must not be modified.** The scroll engine, video
scrubbing, scrim and artwork all carry over unchanged. If you believe you need a
change there, write an `INTEGRATION NOTE:` instead.

`data/property.js` is **renamed** to `data/company.js` and `window.PROPERTY` becomes
`window.COMPANY`. Structure updates the `<script src>`; Content writes the new file.
Delete the old one.

## The walkthrough, reframed (same 8 chapters, same ids, same art)

Chapter ids, `data-chapter` and `data-art` values are **unchanged** — Motion's engine
and the video wiring key off them. Only the copy's argument changes.

| # | id | New job — what this chapter argues to an owner |
|---|---|---|
| 1 | `ch-arrival` | Hero. The company, what it does, for whom. Not a building's name. |
| 2 | `ch-approach` | Kerb appeal and exterior upkeep — the first thing a prospective tenant sees, and what it says about management |
| 3 | `ch-entrance` | Common areas, lobbies, security, cleaning cadence |
| 4 | `ch-living` | Turnover quality — the condition a unit is handed over in, and how fast it re-lets |
| 5 | `ch-kitchen` | Preventive maintenance and capital planning — appliances, systems, replacing before failing |
| 6 | `ch-rest` | Inspections and tenant care — routine checks, documentation, issues caught early |
| 7 | `ch-amenities` | Shared amenity upkeep — the spaces that cost money and win renewals |
| 8 | `ch-neighborhood` | Local market knowledge — pricing, demand, positioning in this specific market |

Copy rules: address the **owner**, not the tenant. Never "your new home," never
"you'll love." Concrete operational nouns — turnover days, work orders, inspection
cadence, reserve planning. Every number in `[BRACKETS]`; invent no statistics.

## New sections, replacing `#floorplans` and `#tour`

In order after the chapters: `#services`, `#why`, `#pricing`, `#quote`, then footer.

```html
<section class="services" id="services">
  <h2 …>…</h2>
  <div class="services__grid" data-services></div>
</section>

<section class="why" id="why">
  <h2 …>…</h2>
  <div class="why__grid" data-why></div>
</section>

<section class="pricing" id="pricing">
  <h2 …>…</h2>
  <div class="pricing__model" data-pricing-model></div>
  <div class="pricing__tiers" data-pricing-tiers></div>
  <div class="pricing__notes" data-pricing-notes></div>
</section>

<section class="quote" id="quote">
  <form class="quote__form" data-quote-form novalidate></form>
  <div class="quote__details" data-quote-details></div>
</section>
```

All anchors that pointed at `#tour` now point at `#quote`. The sticky CTA and header
CTA both target `#quote`.

## Data contract — `data/company.js` sets `window.COMPANY`

Heavily commented; this is the one file a non-programmer edits. Every fact bracketed.

```js
window.COMPANY = {
  name: "[COMPANY NAME]",
  tagline: "[Property management for owners of small and mid-size multifamily]",
  serviceArea: "[CITY / METRO AREA]",
  phone: "[(555) 555-0100]",
  email: "[owners@example.com]",
  hours: "[Mon–Fri 9–6]",
  address: { line1: "[123 EXAMPLE ST]", city: "[CITY]", state: "[ST]", zip: "[00000]" },

  cta: { header: "Get a Quote", sticky: "Get a Quote", form: "Request My Quote" },

  chapters: { arrival:{eyebrow,headline,body}, …all 8, ids unchanged… },

  // 5–7 services. `items` are the concrete deliverables under each.
  services: [
    { id:"leasing", title:"Leasing & tenant placement",
      body:"…", items:["Marketing & listing","Showings","Screening","Lease prep"] },
    …
  ],

  // 3–4 reasons owners choose you. `stat` optional and MUST be bracketed.
  why: [
    { id:"response", stat:"[24 hrs]", title:"…", body:"…" },
    …
  ],

  pricing: {
    model: "…one paragraph on how fees work…",
    tiers: [
      { id:"essential", name:"[Essential]", rate:"[8%]", rateNote:"of monthly rent collected",
        summary:"…", includes:["…","…"], featured:false },
      …3 tiers, exactly one featured:true…
    ],
    notes: ["[Leasing fee: …]", "[No setup fee]", "…"],
  },

  quote: {
    intro: "…one or two sentences setting expectations…",
    // field labels/hints live here so copy is editable without touching JS
    fields: { name:{…}, contact:{…}, propertyAddress:{…}, units:{…},
              propertyType:{…}, situation:{…}, message:{…} },
    situations: ["Self-managed today","With another manager","New acquisition","Still deciding"],
    propertyTypes: ["Single-family","Duplex / triplex","Small multifamily (4–20)",
                    "Mid-size multifamily (20–100)","Larger / mixed portfolio"],
  },

  legal: {
    equalHousing: true,
    footageLabel: "Illustrative footage — not a property under management",
    artLabel: "Illustration — placeholder for photography",
    imagery: "…states plainly that the video is AI-generated, the stills are drawings,
              and none of it depicts a property this company manages…",
    disclaimer: "[Fees and terms are illustrative and subject to agreement.]",
  },
};
```

## `js/site.js` must

- Fill every `[data-bind="dotted.path"]` from `window.COMPANY` via `textContent`.
- Render `services[]` into `[data-services]`, `why[]` into `[data-why]`,
  `pricing.*` into the three pricing hooks.
- Build the **quote form**: name, contact (phone or email), property address,
  number of units (`type="number"`, min 1), property type (`<select>` from
  `quote.propertyTypes`), current situation (`<select>` from `quote.situations`),
  optional message (`<textarea>`). Name, contact, address and units are required.
- Keep every accessibility and UX behaviour already built and verified in v2:
  validate on blur only once touched, specific contact errors, `aria-describedby`
  wiring, `aria-invalid`, focus the first invalid field, the pointerdown/submit
  fix that stops error-painting from swallowing the submit click, live error
  clearing on input, and the `role="status"` confirmation inserted empty then
  populated so screen readers announce it.
- Send nothing. Confirmation states plainly that nothing was submitted and nobody
  was notified, with `tel:` and `mailto:` links, the `mailto:` prefilled with the
  payload. Keep the `>>> PASTE ENDPOINT SUBMIT HERE <<<` marker and the
  Formspree/Netlify/mailto integration note.
- Fail loudly in the console listing every missing required path, and abort render.

## Non-negotiables (carried over)

- Static site. No build step, no framework, no external requests.
- Mobile first; must hold at 390px and 1440px with zero horizontal overflow.
- One `<h1>`, real landmarks, labelled inputs, focus-visible states, alt text.
- Body text contrast ≥ 4.5:1, measured from rendered pixels, not estimated.
- Fully readable with JavaScript disabled: chapters visible, copy legible, phone
  number reachable, a `mailto:` fallback for the quote request.
- **Honesty.** The footage is AI-generated and depicts no property under this
  company's management. Per-chapter labels stay on all eight chapters, and the
  footer carries the full explanation at readable body size. This matters more
  here than it did for a leasing site: implying a portfolio you do not manage
  would be a false claim about the business, not just about a photo.

## Verification

Serve over the range-capable server at `http://127.0.0.1:8900/` — **never `file://`**,
which breaks video seeking. Chromium is at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. This build has **no H.264**;
video falls back to the WebM companions automatically. Screenshot at 1440×900 and
390×844 and *look* at the results with the Read tool before claiming anything works.
