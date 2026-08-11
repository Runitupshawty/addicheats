# Build contract — scroll-through property site

Every agent working on this site MUST follow this contract exactly. It is the only
thing keeping four parallel workstreams from colliding. Do not rename anything defined
here. Do not create or edit files outside your assigned ownership.

## File ownership

| Owner | Files | Must not touch |
|---|---|---|
| **Structure** | `index.html`, `css/tokens.css`, `css/layout.css` | js/, assets/, data/ |
| **Motion** | `js/scroll.js`, `css/chapters.css` | index.html, other css, data/ |
| **Art** | `assets/*.svg` | everything else |
| **Data** | `data/property.js`, `js/site.js` | index.html, css/ |

If you need a change in someone else's file, write it as a note at the end of your
own file in a comment block starting `INTEGRATION NOTE:` — the integrator will apply it.

## The scroll journey (fixed order)

| # | id | `data-chapter` | `data-art` | Purpose |
|---|---|---|---|---|
| 1 | `ch-arrival` | `arrival` | `exterior-aerial` | Hero. Aerial arrival, property name |
| 2 | `ch-approach` | `approach` | `exterior-street` | Curb view, the building in its street |
| 3 | `ch-entrance` | `entrance` | `lobby` | Through the doors into the lobby |
| 4 | `ch-living` | `living` | `living` | Inside a home — living room |
| 5 | `ch-kitchen` | `kitchen` | `kitchen` | The kitchen |
| 6 | `ch-rest` | `rest` | `bedroom` | Bedroom and bath |
| 7 | `ch-amenities` | `amenities` | `amenity-courtyard` | Courtyard, gym, laundry |
| 8 | `ch-neighborhood` | `neighborhood` | `neighborhood` | Where it sits in the city |

After the chapters, in order: `#floorplans`, `#tour`, `footer.site-footer`.

## DOM contract

`index.html` must produce exactly this shape. Class names are load-bearing.

```html
<body>
  <header class="site-header">
    <span class="site-header__name" data-bind="name"></span>
    <a class="site-header__cta" href="#tour" data-bind="cta.header"></a>
  </header>

  <main class="journey">
    <section class="chapter" id="ch-arrival"
             data-chapter="arrival" data-art="exterior-aerial">
      <div class="chapter__media" data-media></div>
      <div class="chapter__copy">
        <p  class="chapter__eyebrow" data-bind="chapters.arrival.eyebrow"></p>
        <h2 class="chapter__headline" data-bind="chapters.arrival.headline"></h2>
        <p  class="chapter__body" data-bind="chapters.arrival.body"></p>
      </div>
    </section>
    <!-- …one <section class="chapter"> per row of the table above… -->

    <section class="plans" id="floorplans">
      <div class="plans__tabs" data-plan-tabs></div>
      <div class="plans__panels" data-plan-panels></div>
    </section>

    <section class="tour" id="tour">
      <form class="tour__form" data-tour-form novalidate>
        <!-- fields: name, contact, movein, unit — see Data contract -->
      </form>
      <div class="tour__details" data-tour-details></div>
    </section>
  </main>

  <a class="sticky-cta" href="#tour" data-sticky-cta></a>
  <footer class="site-footer" data-footer></footer>
</body>
```

Load order at end of `<body>`, exactly:
```html
<script src="data/property.js"></script>
<script src="js/site.js"></script>
<script src="js/scroll.js"></script>
```

## Motion contract

`js/scroll.js` owns all scroll state. It must, on every frame it updates:

- Set `--p` on each `.chapter` — a `0`→`1` unitless number for that chapter's own
  progress through the viewport. `0` = just entering from below, `1` = just left the top.
- Set `--scroll-progress` on `:root` — `0`→`1` for the whole document.
- Add `.is-active` to the chapter currently filling most of the viewport.
- Add `.is-seen` (once, never removed) to any chapter that has been reached.
- Add `.is-scrolled` to `<body>` once the user is past the first viewport. The sticky
  CTA reveals off this class — that is Structure's styling job, not Motion's.

Rules:
- Never hijack, smooth, or intercept native scrolling. No scroll-jacking of any kind.
- Read scroll state in a `requestAnimationFrame` loop or via `IntersectionObserver`;
  never do layout work directly inside a `scroll` handler.
- Under `@media (prefers-reduced-motion: reduce)`, chapters must render as clean static
  panels with a simple opacity fade and no transform. Ship this as real CSS in
  `chapters.css`, not as a JS branch.
- The site must be readable and navigable with JavaScript disabled entirely: chapters
  visible, copy legible, phone number and form reachable.

## Art contract

`assets/` holds hand-authored SVGs. One per `data-art` value in the journey table,
plus `plan-studio.svg`, `plan-1br.svg`, `plan-2br.svg`.

- Filename is exactly `<data-art>.svg`.
- Every chapter SVG: `viewBox="0 0 1600 1000"`, `preserveAspectRatio="xMidYMid slice"`.
- Floor plan SVGs: `viewBox="0 0 800 800"`, `preserveAspectRatio="xMidYMid meet"`.
- No external references, no raster embeds, no `<image>`. Pure vector.
- Draw from the palette in `tokens.css` by hardcoding the hex values listed below —
  SVGs are loaded as `<img>` and cannot inherit CSS variables.
- These are **placeholders standing in for photographs**. They must read as clean
  architectural illustration, not as clip art, and every one must carry a small
  `PLACEHOLDER` label so nobody mistakes it for the real property.

## Data contract

`data/property.js` sets `window.PROPERTY`. This is the one file a non-programmer edits.
It must be heavily commented and every placeholder value must be obviously fake and
wrapped in `[SQUARE BRACKETS]`.

```js
window.PROPERTY = {
  name: "[PROPERTY NAME]",
  tagline: "[30 residences in the heart of [NEIGHBORHOOD]]",
  address: { line1: "[123 EXAMPLE ST]", city: "[CITY]", state: "[ST]", zip: "[00000]" },
  phone: "[(555) 555-0100]",
  email: "[leasing@example.com]",
  hours: "[Mon–Fri 9–6, Sat 10–4]",
  cta: { header: "Book a Tour", sticky: "Book a Tour", form: "Request a Tour" },
  chapters: {
    arrival:      { eyebrow: "", headline: "", body: "" },
    approach:     { eyebrow: "", headline: "", body: "" },
    entrance:     { eyebrow: "", headline: "", body: "" },
    living:       { eyebrow: "", headline: "", body: "" },
    kitchen:      { eyebrow: "", headline: "", body: "" },
    rest:         { eyebrow: "", headline: "", body: "" },
    amenities:    { eyebrow: "", headline: "", body: "" },
    neighborhood: { eyebrow: "", headline: "", body: "" },
  },
  plans: [
    { id: "studio", label: "Studio", art: "plan-studio", sqft: "[480]",
      rent: "[$1,250–$1,400]", beds: 0, baths: 1, available: "[2 available]" },
    { id: "1br", label: "One Bedroom", art: "plan-1br", sqft: "[680]",
      rent: "[$1,550–$1,750]", beds: 1, baths: 1, available: "[5 available]" },
    { id: "2br", label: "Two Bedroom", art: "plan-2br", sqft: "[950]",
      rent: "[$1,950–$2,300]", beds: 2, baths: 2, available: "[Waitlist]" },
  ],
  legal: {
    equalHousing: true,
    enhancedImagery: "Illustrations are placeholders pending photography.",
    disclaimer: "[Pricing and availability subject to change.]",
  },
};
```

`js/site.js` must:
- Fill every `[data-bind="dotted.path"]` element's `textContent` from `window.PROPERTY`.
- Build the floor plan tabs and panels from `plans[]` into `[data-plan-tabs]` /
  `[data-plan-panels]`; tabs are real `<button>`s, keyboard operable, correct
  `aria-selected` / `aria-controls`.
- Build the tour form fields (name, contact, move-in date, unit type — unit options
  from `plans[]`), the `[data-tour-details]` block (phone as `tel:` link, address,
  hours), the `[data-sticky-cta]` label, and the `[data-footer]` contents
  including the Equal Housing notice and both legal lines.
- Validate the form on submit and show inline errors. Do **not** wire a backend —
  on success, show a clearly-marked "not yet connected" confirmation and log the
  payload. Leave a commented `INTEGRATION NOTE:` block naming the two or three
  simplest free form services and where to paste the endpoint.
- Fail loudly in the console if `window.PROPERTY` is missing a key it needs.

## Palette (hardcode these hexes in SVG; mirror as vars in `tokens.css`)

| Token | Hex | Use |
|---|---|---|
| `--c-ink` | `#16120E` | Primary text, dark panels |
| `--c-paper` | `#FBF8F3` | Page background |
| `--c-card` | `#F1EADE` | Cards, insets |
| `--c-accent` | `#B4813A` | Brass accent, CTAs, rules |
| `--c-muted` | `#6B6157` | Secondary text |
| `--c-rule` | `#E4DACB` | Hairlines, borders |
| `--c-sky` | `#CBD5D8` | SVG sky / glass |
| `--c-stone` | `#B9AE9E` | SVG masonry / mid-tone |
| `--c-shadow` | `#8A7F72` | SVG shading |

Type: headings `"Bitstream Charter", "Liberation Serif", Georgia, serif`;
body `"Liberation Sans", "DejaVu Sans", system-ui, sans-serif`. No webfonts, no CDNs.

## Non-negotiables

- Static site. No build step, no framework, no package.json, no external requests.
- Mobile first. Everything must hold together at 390px wide and at 1440px.
- Accessible: real landmarks, one `<h1>`, focus states, labelled inputs, alt text
  on every `<img>`, colour contrast at least 4.5:1 for body text.
- Honest: every placeholder visibly reads as a placeholder.

---

# Round 2 addendum — refinement

Round 1 shipped a working site. This round fixes what the screenshots exposed.
Same file ownership as above. Same rule: do not touch another owner's files.

## Confirmed defects (from rendered screenshots)

1. **Desktop hero clips its own headline.** At 1440×900 the `h1` renders as
   `[PROPERTY` — the text is cut off by its card. Critical.
2. **Chapters are not cinematic.** Media renders as a small floating card occupying
   roughly a third of the viewport. The entire premise is a full-screen walk-through;
   media must fill the chapter and copy must sit over it.
3. **Artwork reads washed out** — pale, low-contrast, muddy. It should read premium.
4. **Sticky CTA dominates on mobile** — a full-width black pill covering content.
5. **Floor-plan panel** — plan art is clipped at the bottom; the detail column
   floats oddly to the right.

## Video contract (new)

Four chapters now have real footage in `assets/video/`. The other four keep SVG art.

| Chapter | `data-art` | Has video |
|---|---|---|
| `ch-arrival` | `exterior-aerial` | **yes** |
| `ch-approach` | `exterior-street` | **yes** |
| `ch-entrance` | `lobby` | no — SVG |
| `ch-living` | `living` | **yes** |
| `ch-kitchen` | `kitchen` | **yes** |
| `ch-rest` | `bedroom` | no — SVG |
| `ch-amenities` | `amenity-courtyard` | no — SVG |
| `ch-neighborhood` | `neighborhood` | no — SVG |

Files per video chapter: `assets/video/<art>-1080.mp4`, `<art>-720.mp4`,
`<art>-poster.jpg`. All are H.264, silent, 5.04s, 24fps, faststart, GOP 12.

**Markup** (Structure owns; Motion codes against it). Inside `.chapter__media`:

```html
<video class="chapter__video" data-chapter-video
       data-src-720="assets/video/living-720.mp4"
       data-src-1080="assets/video/living-1080.mp4"
       poster="assets/video/living-poster.jpg"
       muted playsinline preload="none"
       disablepictureinpicture aria-hidden="true"></video>
```

- No `src` in the markup — **Motion sets it** from `data-src-*` based on viewport
  width, and only for chapters near the viewport. This prevents four videos
  downloading on page load.
- Chapters without video keep their existing `<img>` exactly as-is.
- Video chapters must ALSO keep a `<noscript>`-safe still: the `poster` covers the
  JS-off case, so no `<img>` is needed inside a video chapter, but the poster
  attribute is mandatory.

**Scrub behaviour** (Motion owns):
- Drive `video.currentTime` from the chapter's `--p` so scrolling scrubs the clip.
- Never call `play()`. This is scrubbed, not played. No autoplay, no loop.
- Seek only when the delta is meaningful (~1 frame, 1/24s) to avoid seek thrash.
- Set `src` lazily when the chapter is within ~1.5 viewports; drop it when far away.
- Under `prefers-reduced-motion: reduce`, do not load video at all — show the poster.
- If the browser cannot decode the file, the poster must remain visible — never a
  black box.

## Honesty requirement (unchanged, now load-bearing)

The current footage is AI-generated and is **not** this property. Every video chapter
must carry a small, legible "Illustrative footage — not the actual property" note,
styled quietly but genuinely readable (not 8px grey-on-grey). Same for SVG chapters,
which already carry their `PLACEHOLDER` tag.
