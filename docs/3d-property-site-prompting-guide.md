# How to Prompt Claude Into Building Your 3D Scroll-Through Property Website

A step-by-step playbook for getting a cinematic, scroll-driven website for a ~30-unit
multifamily property — one that walks visitors through the property inside and out as
they scroll, and turns that attention into booked tours.

Each numbered step below ends with a **copy-paste prompt**. Fill in the `[BLANKS]`,
paste it into Claude, and react to what comes back. You never need to know how the
code works — you need to know what to ask for and how to say "not quite, more like this."

---

## 1. The big picture (read this once)

What you're describing is a **"scrollytelling" site**: the whole page is one continuous
story, and the visitor's scroll wheel is the remote control. As they scroll, the camera
arrives at the building, glides to the front door, moves through the lobby, steps inside
a unit, tours the amenities, and lands on floor plans and a **Schedule a Tour** button.

There are three ways to build the visuals. Knowing them helps you ask for the right one:

| Option | What it is | Effort | Best for |
|---|---|---|---|
| **A. Scroll-scrubbed video** | Cinematic footage is turned into frames; scrolling scrubs through them (the Apple product-page trick) | Low–medium | Fastest path to "wow," works on every phone |
| **B. Real 3D capture (Gaussian splats)** | You film a slow walkthrough on your phone; a service like Luma AI or Polycam turns it into a photoreal 3D scene we fly a camera through in the browser | Medium | The true "walk through *my actual building*" feel |
| **C. Built 3D model (Three.js)** | A digital 3D model of the building, made or bought | High | Stylized look; hardest to make photoreal |

**Recommendation for a 30-unit property:** start with **A** — it's reliable, phone-friendly,
and looks incredible — and add **B** later for one hero moment (stepping inside the model
unit) if you want to go further. Your Higgsfield connector (Step 2) is what makes Option A
cheap: it can generate drone-style and dolly camera moves from ordinary photos.

What actually grabs human attention, whichever option you pick:

- Motion that responds *instantly* to scroll (no laggy, hijacked scrolling)
- One idea per screenful — a headline, an image, nothing else competing
- Real photos of the real property (trust converts; stock photos don't)
- Loads fast — attention is lost in the first 3 seconds, not minute 3
- A "Book a Tour" button that is always within thumb's reach

---

## 2. Step 0 — Gather your raw materials

Claude can only work with what you provide. Fifteen minutes of gathering makes every
prompt after this ten times more effective.

**Property facts** (put these in a note you can paste):
- Property name, address, and neighborhood selling points
- Unit count and mix (e.g., 12 one-bed, 14 two-bed, 4 studios), square footages
- Rent ranges and what's included; pet policy; parking
- Amenities worth showing (laundry, gym, courtyard, roof deck, secured entry)
- Contact phone/email, office hours, and how tours get booked today

**Brand:** logo file, brand colors if you have them, or just say
"propose a brand look for me" in Prompt 1.

**Media (the most important pile):**
- 20–40 photos: exterior from across the street, entrance, lobby, each room of your
  best unit, amenities. Landscape orientation, daylight, lights on, blinds open.
- Any drone footage or walkthrough video you already have.
- If you want the real-3D option later: film a **slow, steady, horizontal phone video**
  walking the path a visitor would walk — outside approach, through the door, through
  the unit. Move like you're carrying a full cup of coffee.

**Floor plans:** PDFs or images, one per unit type.

**Legal:** Equal Housing logo, any license numbers, and a disclaimer line if any imagery
will be AI-enhanced (see Section 7).

**How to get files to Claude:** upload them into this repo (on GitHub: *Add file →
Upload files* into an `assets/` folder), or put them in a Google Drive folder and tell
Claude the folder name — Claude can read connected Google Drive files directly.

---

## 3. Step 1 — Connect the Higgsfield MCP connector

Higgsfield is an AI video platform known for cinematic camera moves (drone orbits,
dolly-ins, FPV fly-throughs) generated from still photos, and it runs an official MCP
connector — meaning Claude can drive it for you from inside the chat.

**To connect it (one time, ~2 minutes):**
1. Create an account at **higgsfield.ai** and note that generations use Higgsfield
   credits — check what your plan includes before generating a lot of video.
2. Go to **higgsfield.ai/mcp** and copy the MCP server URL (`https://mcp.higgsfield.ai`).
3. In Claude: **Settings → Connectors → Add custom connector**, name it *Higgsfield*,
   paste the URL, and finish the sign-in it asks for.
4. Make sure the connector is toggled **on for the chat** where you're building the site.

**What to use it for:** turning your best stills into short cinematic clips — an aerial
push-in on the building, a slow dolly through the lobby, a sweep across the kitchen.
Those clips become the scroll-scrubbed backbone of the site. Generate 3–8 second clips;
scroll sections don't need more.

**A rule that protects you:** AI video *of your real property, from your real photos*
is a cinematography tool. AI video of interiors that don't exist is false advertising.
Keep every generated shot anchored to a real photo of the actual property, and label
anything stylized (see Section 7).

---

## 4. The prompt sequence

Work top to bottom. One prompt per message. Let each step finish and look at it before
moving on — course-correcting early is cheap, redoing a finished site is not.

### Prompt 1 — Kickoff (make Claude plan before it builds)

> I want to build a one-page, scroll-driven cinematic website for my apartment
> community, **[PROPERTY NAME]**, a **[30]**-unit multifamily property at
> **[ADDRESS]**. As visitors scroll, the site should walk them through the property —
> exterior approach, entrance and lobby, inside a typical unit room by room, then
> amenities — ending with floor plans, pricing, and a "Schedule a Tour" form.
>
> Assets I have: **[list what you gathered in Step 0, and where you put it — repo
> folder or Drive folder name. If you have nothing yet: "none yet — build with clearly
> marked placeholders I can replace, and give me a shot list of exactly what to
> photograph."]**
>
> Build it in this repo as a static site I can deploy for free. Use the
> scroll-scrubbed-video approach unless you'd recommend otherwise for my assets —
> explain your choice in one paragraph.
>
> Before writing any code, show me: (1) the section-by-section storyboard of the
> scroll journey, (2) what you'll build each section from, and (3) anything missing
> from my assets. Wait for my OK.

*You should get back:* a storyboard like "Section 1: night aerial of building, headline
fades in → Section 2: doors part as you scroll → …" Push on it. Reorder it. Cut sections.
This is the cheapest moment to change your mind.

### Prompt 2 — Pick the look before the motion

> Before building the scroll experience, show me 2–3 style directions as static mockups
> of the hero screen: one modern minimal luxury, one warm and community-focused, one
> bold and urban. Use my logo and real property name. Sites whose feel I like:
> **[paste 1–3 links — real estate or not]**. I'll pick one direction and we'll build
> everything in it.

*Why:* arguing about fonts and colors on a static mockup takes minutes. Doing it after
the animations are built takes hours. Pick one, say what to keep from the others.

### Prompt 3 — The hero and the scroll engine

> Build the hero and the scroll system in the **[chosen]** style: full-screen opening
> shot of the property, property name in large type, one line — "**[e.g., 30 residences
> in the heart of [NEIGHBORHOOD]]**" — and a subtle "scroll" cue. As I begin to scroll,
> start the journey toward the entrance. Make scrolling buttery on desktop and mobile,
> and set up the site so my real photos/clips can be dropped in by filename later.
> Screenshot the result at phone size and desktop size and show me both.

### Prompt 4 — The walkthrough, one chapter at a time

Repeat this prompt for each chapter: *exterior → entrance/lobby → unit (kitchen,
living, bedroom, bath) → amenities → neighborhood.*

> Build the **[LOBBY]** chapter next. As I scroll, **[the camera moves from the front
> doors through the lobby — use clip/photos: FILENAMES]**. Overlay copy:
> "**[HEADLINE]**" and "**[one supporting line]**". The text should appear
> **[fade in / slide up]** as the camera settles, then release into the next chapter.
> Show me a screenshot sequence of the transition.

If you're using Higgsfield, this is also where you ask for footage:

> Using the Higgsfield connector, generate a **[5-second slow dolly-in]** from the
> attached photo of **[the lobby]**, keeping the space exactly as it looks in the
> photo — no invented furniture or finishes. Then wire it into the lobby chapter.

### Prompt 5 — Floor plans, pricing, availability

> Build the floor plans section: a tab or card for each unit type — **[Studio / 1BR /
> 2BR]** — with the floor plan image, square footage, rent range, and an availability
> badge I can edit easily. Make "Check availability" scroll to the tour form. Tell me
> exactly which file to edit when rents or availability change, and make that a
> 30-second job for a non-programmer.

### Prompt 6 — Turn attention into tours

> Build the closing section: a "Schedule a Tour" form (name, phone/email, move-in
> date, unit type), a tap-to-call phone button, address with an embedded map, office
> hours, and fair-housing/license info. Add a small sticky "Book a Tour" button that's
> always visible after the first screen. Recommend the simplest free way to make the
> form actually reach me at **[EMAIL]**, and set it up.

### Prompt 7 — The polish pass (do not skip)

> Polish pass: (1) Test every section at phone size and screenshot each one — fix
> anything cramped, overflowing, or janky. (2) Make it fast: compress images, lazy-load
> everything below the first screen, and tell me the final page weight. (3) Add a
> reduced-motion fallback — clean static sections with fades — for visitors whose
> devices ask for less motion. (4) Add page titles, descriptions, and a social-share
> preview card so links look good in texts. (5) Give me a one-paragraph summary of
> what you fixed.

### Prompt 8 — Put it live

> Set this up to deploy free and give me the URL. Then list the exact steps to connect
> my custom domain **[YOURPROPERTY.com]**, written for someone who has never touched
> DNS settings.

*(This repo already has GitHub Pages configured, so publishing can be as simple as
merging to the main branch — but Claude may recommend a dedicated repo or Vercel for
the new site. Let it explain, then decide.)*

---

## 5. How to steer Claude (the actual skill)

The build succeeds or fails on your feedback. What works:

- **Name the section, describe the problem in plain words.** "In the lobby section,
  the text is hard to read over the video" beats "make it better."
- **One or two changes per message.** Ten changes at once get you a muddy average.
- **Paste screenshots** of what you're seeing, and ask Claude to screenshot what *it*
  sees: "screenshot every section and show me" catches problems early.
- **Pair vibes with a reference.** "More premium — closer to how [link] feels" gives
  a vague word something to aim at.
- **Speed of motion is fair game.** "The unit tour moves too fast, let me linger" or
  "the intro takes too long to get to the point" are exactly the right notes.
- **You can always ask why.** "Explain what you did in plain English" is a legitimate
  prompt, any time.

---

## 6. The attention checklist (ask for this audit at the end)

Paste this as a final prompt when everything's built:

> Audit the site against this list and fix what fails: first screen makes someone stop
> scrolling their phone within 3 seconds; the property name and neighborhood are
> unmissable; every section has exactly one job; a first-time visitor can find the rent
> and book a tour in under 15 seconds from any point; the page loads fast on a phone on
> cellular data; nothing moves so much it feels like a theme park; the site works with
> JavaScript disabled at least well enough to show photos and the phone number.

---

## 7. Play it straight (real-estate-specific rules)

- **Show the real property.** Use AI tools for camera movement over real photos, not to
  invent granite counters you don't have. A visitor who tours after seeing the site
  should feel the site *undersold* it.
- **Label enhanced imagery.** A small "Some imagery digitally enhanced" or "Artist's
  rendering" note wherever applicable.
- **Fair housing.** Include the Equal Housing Opportunity logo and follow fair-housing
  advertising rules in your marketing copy (describe the property, not the tenant you
  imagine).
- **Keep pricing honest and current** — Prompt 5 sets up the 30-second edit for this.

---

## 8. TL;DR — do this right now

1. Spend 15 minutes on the Step 0 checklist (facts + photos).
2. Connect Higgsfield: **Settings → Connectors → Add custom connector →**
   `https://mcp.higgsfield.ai` (get the URL from higgsfield.ai/mcp).
3. Paste **Prompt 1** with your blanks filled in.
4. React to the storyboard, then walk Prompts 2–8 in order, one at a time.
5. Finish with the Section 6 audit, then send the link to five people and watch
   where they stop scrolling.

You can start Prompt 1 in this very conversation — the repo and branch are already set up.
