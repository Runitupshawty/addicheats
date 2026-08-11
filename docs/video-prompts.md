# Video-Generation Prompts for the Scroll-Through Site

Companion to [the main guide](3d-property-site-prompting-guide.md). These prompts are
written for Higgsfield's image-to-video mode — you supply a real photo of the property,
the model adds the camera move. One clip per chapter of the scroll journey.

## The rules that make clips scrub well

These clips get **scrubbed by scroll**, not just played. Scrubbing runs footage
backwards and at variable speed, so:

- **One continuous move, no cuts.** A cut looks like a glitch when scrubbed.
- **Constant speed, no ramps.** Speed changes feel broken under a scroll wheel.
- **Nothing moving except the camera.** People walking or cars driving look wrong
  the moment someone scrolls upward.
- **Near-still hold at both ends** (~half a second). These become the clean resting
  frames between chapters.
- **5 seconds is plenty.** Scroll sections never need more; 3–8s is the whole range.
- **16:9, highest resolution offered.** Desktop shows the full frame; phones crop in.

And the standing rule from the main guide: generate from real photos of the real
property, never invent interiors. AI camera movement over your actual photo is a
cinematography tool; AI rooms that don't exist are false advertising.

## The master prompt

Paste this with every generation, swapping in one shot line from the table below:

> Use the attached photo as the source. Keep the scene exactly as it appears — same
> architecture, furniture, finishes, and layout; do not add, remove, or invent
> anything. One continuous shot, no cuts, no speed ramps: **[SHOT LINE]**. Slow,
> perfectly steady, constant speed, as if on a gimbal. Warm golden-hour light, soft
> shadows, photorealistic, premium real-estate film feel. Straight lines stay
> straight — no warping walls or bending verticals. No people, no vehicles in motion,
> no on-screen text, no watermark. Begin and end on a near-still hold. 5 seconds,
> 16:9, highest resolution.

## The eight shot lines

Name each downloaded clip after its chapter ID so it drops straight into the site.

| Clip filename | Source photo | Shot line |
|---|---|---|
| `exterior-aerial` | Building from above / best wide exterior | a slow aerial push-in, descending gently from about 80 feet toward the building's face |
| `exterior-street` | Building from across the street | an eye-level dolly forward from across the street toward the entrance |
| `lobby` | Entrance doors / lobby | a smooth glide through the front doors into the lobby |
| `living` | Living room from its doorway | a slow push-in from the doorway into the living room, toward the window light |
| `kitchen` | Kitchen, wide | a slow lateral dolly left-to-right along the kitchen counters and island |
| `bedroom` | Bedroom, wide | a gentle, calm push-in toward the bed and window |
| `amenity-courtyard` | Courtyard | a slow crane-down into the courtyard, settling at eye level |
| `neighborhood` | Street corner / block view | a slow rising pull-back revealing the building in its block |

## Order of operations

1. Generate the **two exteriors first** — highest impact, and they tell you fastest
   whether your source photos are good enough.
2. Review each clip *scrubbing in your head*: would this look right run backwards at
   half speed? If anything drifts, warps, or moves on its own, regenerate.
3. Only generate the remaining six once the exterior look is locked — this is where
   credits go to waste otherwise.

## Fixes for common failures

- **Walls bend or verticals wobble** → add "architectural photography, rectilinear
  lens, tripod-stable" and shorten to 3–4 seconds.
- **The model invents furniture or decor** → strengthen to "this is a documentary
  shot of an existing building; change nothing about the scene, move only the camera."
- **Motion too fast** → "extremely slow, 10% speed, subtle drift" — slower always
  scrubs better than faster.
- **Flicker or shimmer in fine detail** → pick a source photo with less
  high-frequency texture, or crop tighter.
