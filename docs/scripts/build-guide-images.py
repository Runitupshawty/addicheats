#!/usr/bin/env python3
"""Render the property-site prompting guide into designed JPG pages."""
import os, subprocess, textwrap
from PIL import Image

OUT = "/home/user/addicheats/docs/guide-images"
WORK = "/tmp/claude-0/-home-user-addicheats/fd013f5e-22b1-516e-832a-36763816a5d3/scratchpad/pages"
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
W, H, SCALE = 1400, 1244, 2

os.makedirs(OUT, exist_ok=True)
os.makedirs(WORK, exist_ok=True)

CSS = """
* { margin:0; padding:0; box-sizing:border-box; }
:root{
  --ink:#16120E; --paper:#FBF8F3; --brass:#B4813A; --brass-lt:#D8B madeup;
  --muted:#6B6157; --rule:#E4DACB; --card:#F4EEE4;
}
html,body{ -webkit-font-smoothing:antialiased; }
body{ font-family:"Liberation Sans","DejaVu Sans",sans-serif; color:#16120E; }
.page{
  width:1400px; height:1244px; position:relative; overflow:hidden;
  background:#FBF8F3; padding:88px 96px 82px;
}
.page.dark{ background:#16120E; color:#FBF8F3; }

/* running header */
.rh{ position:absolute; top:44px; left:96px; right:96px;
  display:flex; justify-content:space-between; align-items:center;
  font-size:14px; letter-spacing:.22em; text-transform:uppercase; color:#9A8E80; }
.rh .dot{ width:5px; height:5px; background:#B4813A; border-radius:50%; }
.pnum{ position:absolute; bottom:38px; right:96px; font-size:15px; color:#8E8478;
  letter-spacing:.16em; font-weight:700; }
.foot{ position:absolute; bottom:38px; left:96px; font-size:14px; color:#8E8478;
  letter-spacing:.22em; text-transform:uppercase; font-weight:700; }
.dark .pnum, .dark .foot{ color:#7E7365; }

/* type */
h1{ font-family:"Bitstream Charter","Liberation Serif",serif; font-weight:700;
    font-size:82px; line-height:1.04; letter-spacing:-.018em; }
h2{ font-family:"Bitstream Charter","Liberation Serif",serif; font-weight:700;
    font-size:46px; line-height:1.12; letter-spacing:-.012em; margin-bottom:10px; }
h3{ font-size:23px; font-weight:700; letter-spacing:-.005em; margin-bottom:9px; }
p{ font-size:20px; line-height:1.55; color:#3D362E; }
.dark p{ color:#CFC4B4; }
.lede{ font-size:24px; line-height:1.5; color:#5C544A; }
.dark .lede{ color:#BFB3A2; }
.eyebrow{ font-size:14px; letter-spacing:.26em; text-transform:uppercase;
  color:#B4813A; font-weight:700; margin-bottom:20px; }
.kicker{ font-size:15px; letter-spacing:.2em; text-transform:uppercase;
  color:#9A8E80; margin-bottom:8px; }
strong{ color:#16120E; font-weight:700; }
.dark strong{ color:#FBF8F3; }
em{ font-style:italic; }
.rule{ height:2px; background:#B4813A; width:76px; margin:22px 0 30px; }
.hr{ height:1px; background:#E4DACB; margin:34px 0; }

/* cover */
.cover-mark{ font-size:15px; letter-spacing:.3em; text-transform:uppercase;
  color:#B4813A; font-weight:700; }
.cover h1{ font-size:92px; margin-top:26px; }
.cover .sub{ font-size:26px; line-height:1.48; color:#BFB3A2; margin-top:30px;
  max-width:1000px; }

/* scroll timeline on cover */
.timeline{ margin-top:60px; position:relative; padding-left:46px; }
.timeline:before{ content:""; position:absolute; left:11px; top:12px; bottom:12px;
  width:2px; background:linear-gradient(#B4813A,#4A3A22); }
.tl-item{ position:relative; margin-bottom:25px; }
.tl-item:before{ content:""; position:absolute; left:-41px; top:9px;
  width:12px; height:12px; border-radius:50%; background:#B4813A; }
.tl-item .t{ font-size:23px; font-weight:700; color:#FBF8F3; }
.tl-item .d{ font-size:18px; color:#A29686; margin-top:3px; }

/* option cards */
.opts{ display:flex; gap:22px; margin-top:8px; }
.opt{ flex:1; background:#F4EEE4; border-top:4px solid #DCD1BF;
  padding:26px 24px 24px; border-radius:3px; }
.opt.pick{ border-top-color:#B4813A; background:#F6EFE1; }
.opt .lbl{ font-size:13px; letter-spacing:.2em; text-transform:uppercase;
  color:#9A8E80; font-weight:700; }
.opt.pick .lbl{ color:#B4813A; }
.opt h3{ margin-top:9px; font-size:25px; }
.opt p{ font-size:17px; line-height:1.5; }
.opt .meta{ margin-top:16px; font-size:15px; color:#7A7064; line-height:1.5; }
.opt .meta b{ color:#16120E; }
.badge{ display:inline-block; margin-top:16px; background:#B4813A; color:#fff;
  font-size:13px; letter-spacing:.14em; text-transform:uppercase; font-weight:700;
  padding:6px 12px; border-radius:2px; }

/* checklist */
.check li{ list-style:none; font-size:20px; line-height:1.45; color:#3D362E;
  padding-left:36px; position:relative; margin-bottom:15px; }
.check li:before{ content:""; position:absolute; left:0; top:9px; width:9px; height:9px;
  background:#B4813A; border-radius:50%; }
.check li b{ color:#16120E; }

/* two-column material lists */
.cols{ display:flex; gap:34px; }
.cols > div{ flex:1; }
.mat{ background:#F4EEE4; border-radius:3px; padding:24px 26px; margin-bottom:20px; }
.mat h3{ color:#16120E; display:flex; align-items:center; gap:10px; }
.mat h3 .n{ width:26px; height:26px; background:#B4813A; color:#fff; border-radius:50%;
  font-size:14px; display:flex; align-items:center; justify-content:center; }
.mat li{ list-style:none; font-size:18px; line-height:1.46; color:#4A4239;
  padding-left:20px; position:relative; margin-bottom:8px; }
.mat li:before{ content:""; position:absolute; left:2px; top:10px; width:6px; height:6px;
  background:#C4B49B; border-radius:50%; }
.mat li b{ color:#16120E; }

/* steps */
.step{ display:flex; gap:22px; margin-bottom:22px; }
.step .n{ flex:none; width:44px; height:44px; border:2px solid #B4813A; color:#B4813A;
  border-radius:50%; font-size:19px; font-weight:700;
  display:flex; align-items:center; justify-content:center; }
.step .b{ font-size:19px; line-height:1.5; color:#3D362E; padding-top:8px; }
.step .b b{ color:#16120E; }

/* prompt card */
.prompt{ background:#F4EEE4; border-left:5px solid #B4813A; border-radius:3px;
  padding:24px 28px; margin-bottom:26px; }
.prompt .hd{ display:flex; align-items:baseline; gap:14px; margin-bottom:14px; }
.prompt .num{ font-size:13px; letter-spacing:.2em; text-transform:uppercase;
  color:#B4813A; font-weight:700; }
.prompt .ttl{ font-size:23px; font-weight:700; }
.prompt .txt{ font-family:"Bitstream Charter","Liberation Serif",serif;
  font-size:19px; line-height:1.52; color:#2E2820; }
.prompt .txt p + p{ margin-top:11px; }
.prompt .txt b{ font-weight:700; color:#16120E; }
.blank{ background:#EADDC4; padding:1px 5px; border-radius:2px; font-weight:700;
  color:#7A5518; }
.why{ font-size:17px; line-height:1.5; color:#7A7064; margin-top:12px;
  padding-left:2px; font-style:italic; }

/* callout */
.callout{ background:#16120E; color:#FBF8F3; border-radius:3px; padding:26px 30px; }
.callout h3{ color:#FBF8F3; font-size:22px; }
.callout p{ color:#C6BAA8; font-size:19px; line-height:1.5; }
.callout .k{ color:#E0B368; font-weight:700; }
.warn{ background:#F6EFE1; border:1px solid #E0CDA6; border-radius:3px;
  padding:22px 26px; }
.warn p{ font-size:19px; line-height:1.5; }

/* tldr */
.tldr li{ list-style:none; position:relative; padding-left:52px; margin-bottom:20px;
  font-size:21px; line-height:1.5; color:#3D362E; counter-increment:t; }
.tldr li:before{ content:counter(t); position:absolute; left:0; top:1px;
  width:32px; height:32px; background:#B4813A; color:#fff; border-radius:50%;
  font-size:16px; font-weight:700; display:flex; align-items:center;
  justify-content:center; }
.tldr{ counter-reset:t; }
.url{ font-family:"DejaVu Sans Mono",monospace; font-size:18px; color:#7A5518;
  background:#EFE3CC; padding:2px 8px; border-radius:2px; }
.dark .url{ background:#2C241A; color:#E0B368; }
"""


def page(body, cls="", header=True, num=None, total=None, foot="Property Site Playbook"):
    rh = ""
    if header and num:
        rh = ('<div class="rh"><span>%s</span><span class="dot"></span>'
              '<span>Section %s</span></div>' % (foot.upper(), num))
    pn = ('<div class="foot">%s</div><div class="pnum">%02d / %02d</div>'
          % (foot, num, total)) if num else ""
    return ('<div class="page %s">%s%s%s</div>' % (cls, rh if False else "", body, pn))


# ---------------------------------------------------------------- page bodies
P = []

P.append("""
<div class="cover">
  <div class="cover-mark">A Step-by-Step Playbook</div>
  <h1>How to Prompt<br>Claude Into Building<br>Your 3D Property Site</h1>
  <div class="sub">A cinematic, scroll-driven website for a 30-unit multifamily
  property &mdash; one that walks visitors through the building inside and out as
  they scroll, and turns that attention into booked tours.</div>
  <div class="timeline">
    <div class="tl-item"><div class="t">The Approach</div>
      <div class="d">Aerial arrival &mdash; the building revealed from above</div></div>
    <div class="tl-item"><div class="t">The Entrance</div>
      <div class="d">Doors part as the visitor keeps scrolling</div></div>
    <div class="tl-item"><div class="t">Inside a Home</div>
      <div class="d">Kitchen, living, bedroom, bath &mdash; room by room</div></div>
    <div class="tl-item"><div class="t">The Amenities</div>
      <div class="d">Courtyard, gym, laundry, roof deck</div></div>
    <div class="tl-item"><div class="t">Plans &amp; Pricing</div>
      <div class="d">Floor plans, rent ranges, live availability</div></div>
    <div class="tl-item"><div class="t">Schedule a Tour</div>
      <div class="d">The whole scroll has been leading here</div></div>
  </div>
</div>
""")

P.append("""
<div class="eyebrow">01 &nbsp;&mdash;&nbsp; The Big Picture</div>
<h2>Three ways to build it.<br>Start with the first one.</h2>
<div class="rule"></div>
<p style="max-width:1120px;margin-bottom:34px">What you are describing is a
<strong>&ldquo;scrollytelling&rdquo;</strong> site: the whole page is one continuous
story and the visitor&rsquo;s scroll wheel is the remote control. There are three ways
to produce the visuals, and knowing them helps you ask for the right one.</p>

<div class="opts">
  <div class="opt pick">
    <div class="lbl">Option A</div>
    <h3>Scroll-Scrubbed Video</h3>
    <p>Cinematic footage is turned into frames, and scrolling scrubs through them
    &mdash; the Apple product-page trick.</p>
    <div class="meta"><b>Effort:</b> Low&ndash;medium<br>
      <b>Best for:</b> The fastest path to &ldquo;wow,&rdquo; and it works on
      every phone.</div>
    <div class="badge">Start Here</div>
  </div>
  <div class="opt">
    <div class="lbl">Option B</div>
    <h3>Real 3D Capture</h3>
    <p>You film a slow walkthrough on your phone; a service turns it into a photoreal
    3D scene we fly a camera through in the browser.</p>
    <div class="meta"><b>Effort:</b> Medium<br>
      <b>Best for:</b> The true &ldquo;walk through <em>my actual building</em>&rdquo;
      feeling. Add later for one hero moment.</div>
  </div>
  <div class="opt">
    <div class="lbl">Option C</div>
    <h3>Built 3D Model</h3>
    <p>A digital 3D model of the building, either commissioned or purchased, rendered
    live in the browser.</p>
    <div class="meta"><b>Effort:</b> High<br>
      <b>Best for:</b> A stylized look. Hardest of the three to make photoreal.</div>
  </div>
</div>

<div class="hr"></div>

<h3 style="font-size:26px;margin-bottom:20px">What actually grabs human attention
&mdash; whichever option you pick</h3>
<ul class="check">
  <li><b>Motion that responds instantly to scroll.</b> No laggy, hijacked scrolling
  &mdash; the moment it fights the visitor, they leave.</li>
  <li><b>One idea per screenful.</b> A headline, an image, and nothing else
  competing for the eye.</li>
  <li><b>Real photos of the real property.</b> Trust converts. Stock photography
  does the opposite.</li>
  <li><b>It loads fast.</b> Attention is lost in the first three seconds, not in
  minute three.</li>
  <li><b>A &ldquo;Book a Tour&rdquo; button always within thumb&rsquo;s reach.</b></li>
</ul>
""")

P.append("""
<div class="eyebrow">02 &nbsp;&mdash;&nbsp; Step Zero</div>
<h2>Gather your raw materials first.</h2>
<div class="rule"></div>
<p style="max-width:1120px;margin-bottom:30px">Claude can only work with what you
provide. Fifteen minutes of gathering makes every prompt after this ten times more
effective &mdash; this matters more than anything you will type.</p>

<div class="cols">
  <div>
    <div class="mat">
      <h3><span class="n">1</span> Property Facts</h3>
      <ul>
        <li>Name, address, and neighborhood selling points</li>
        <li>Unit count and mix &mdash; e.g. <b>12 one-bed, 14 two-bed, 4 studios</b>
        &mdash; plus square footages</li>
        <li>Rent ranges and what is included</li>
        <li>Pet policy and parking</li>
        <li>Amenities worth showing: laundry, gym, courtyard, roof deck,
        secured entry</li>
        <li>Contact phone and email, office hours, how tours get booked today</li>
      </ul>
    </div>
    <div class="mat">
      <h3><span class="n">2</span> Brand</h3>
      <ul>
        <li>Logo file and brand colors</li>
        <li>No brand yet? Simply say <b>&ldquo;propose a brand look for me&rdquo;</b>
        in the first prompt</li>
      </ul>
    </div>
    <div class="mat">
      <h3><span class="n">3</span> Floor Plans &amp; Legal</h3>
      <ul>
        <li>Floor plan PDFs or images, one per unit type</li>
        <li>Equal Housing Opportunity logo</li>
        <li>Any license numbers, and a disclaimer line if imagery will be
        AI-enhanced</li>
      </ul>
    </div>
  </div>
  <div>
    <div class="mat" style="background:#F6EFE1">
      <h3><span class="n">4</span> Media &mdash; the most important pile</h3>
      <ul>
        <li><b>20&ndash;40 photos.</b> Exterior from across the street, the entrance,
        the lobby, every room of your best unit, and the amenities</li>
        <li>Shoot <b>landscape orientation, in daylight, lights on,
        blinds open</b></li>
        <li>Any drone footage or walkthrough video you already have</li>
        <li>For the real-3D option later: film a <b>slow, steady, horizontal phone
        video</b> walking the exact path a visitor would walk &mdash; the outside
        approach, through the door, through the unit</li>
        <li>Move like you are carrying a full cup of coffee. Steadiness beats
        everything else</li>
      </ul>
    </div>
    <div class="callout">
      <h3>How to hand the files to Claude</h3>
      <p style="margin-top:10px">Upload them into your repository &mdash; on GitHub,
      <span class="k">Add file &rarr; Upload files</span> into an
      <span class="k">assets/</span> folder &mdash; or drop everything into a Google
      Drive folder and simply tell Claude the folder name. Claude can read connected
      Google Drive files directly.</p>
    </div>
  </div>
</div>
""")

P.append("""
<div class="eyebrow">03 &nbsp;&mdash;&nbsp; Step One</div>
<h2>Connect the Higgsfield connector.</h2>
<div class="rule"></div>
<div class="cols" style="gap:44px">
  <div style="flex:1.15">
    <p style="margin-bottom:26px">Higgsfield is an AI video platform known for
    cinematic camera moves &mdash; drone orbits, dolly-ins, FPV fly-throughs &mdash;
    generated from still photographs. It runs an official MCP connector, which means
    Claude can drive it for you from inside the chat.</p>

    <div class="step"><div class="n">1</div><div class="b">Create an account at
      <b>higgsfield.ai</b>. Generations spend Higgsfield credits, so check what your
      plan includes before generating a lot of video.</div></div>
    <div class="step"><div class="n">2</div><div class="b">Go to
      <b>higgsfield.ai/mcp</b> and copy the MCP server URL:
      <span class="url">https://mcp.higgsfield.ai</span></div></div>
    <div class="step"><div class="n">3</div><div class="b">In Claude, open
      <b>Settings &rarr; Connectors &rarr; Add custom connector</b>. Name it
      <b>Higgsfield</b>, paste the URL, and complete the sign-in it asks for.</div></div>
    <div class="step"><div class="n">4</div><div class="b">Make sure the connector is
      toggled <b>on for the chat</b> where you are building the site.</div></div>
  </div>
  <div style="flex:.85">
    <div class="mat" style="background:#F4EEE4">
      <h3>What to use it for</h3>
      <ul>
        <li>Turning your best stills into short cinematic clips</li>
        <li>An <b>aerial push-in</b> on the building</li>
        <li>A <b>slow dolly</b> through the lobby</li>
        <li>A <b>sweep</b> across the kitchen</li>
        <li>Those clips become the scroll-scrubbed backbone of the site</li>
        <li>Generate <b>3&ndash;8 second</b> clips &mdash; scroll sections never
        need more</li>
      </ul>
    </div>
    <div class="warn">
      <h3 style="color:#7A5518;margin-bottom:10px">A rule that protects you</h3>
      <p>AI video <em>of your real property, from your real photos</em> is a
      cinematography tool. AI video of interiors that do not exist is false
      advertising.</p>
      <p style="margin-top:12px">Keep every generated shot anchored to a real
      photograph of the actual property, and label anything stylized.</p>
    </div>
  </div>
</div>

<div class="hr" style="margin:30px 0 26px"></div>

<div class="cols" style="gap:34px">
  <div>
    <h3 style="font-size:22px">If you would rather skip Higgsfield entirely</h3>
    <p style="font-size:19px">You can build the whole site from still photographs.
    Claude can pan, zoom, and cross-dissolve your stills on scroll, which gets you
    most of the cinematic feeling for zero credits. Say
    <b>&ldquo;no AI video &mdash; animate my stills instead&rdquo;</b> in Prompt One
    and everything else in this playbook stays exactly the same.</p>
  </div>
  <div>
    <h3 style="font-size:22px">Order of operations that saves money</h3>
    <p style="font-size:19px">Build the site with plain stills first, get the scroll
    and the layout right, and only then generate video for the two or three moments
    that deserve it &mdash; usually <b>the aerial arrival</b> and
    <b>stepping into the unit</b>. Generating clips before the storyboard is settled
    is how credits get wasted.</p>
  </div>
</div>
""")

P.append("""
<div class="eyebrow">04 &nbsp;&mdash;&nbsp; The Prompt Sequence</div>
<h2>Prompts 1 and 2</h2>
<div class="rule"></div>
<p style="margin-bottom:26px">Work top to bottom, <strong>one prompt per
message</strong>. Let each step finish and look at it before moving on &mdash;
course-correcting early is cheap, redoing a finished site is not. Fill in every
<span class="blank">[BLANK]</span> before you send.</p>

<div class="prompt">
  <div class="hd"><span class="num">Prompt One</span>
    <span class="ttl">Kickoff &mdash; make Claude plan before it builds</span></div>
  <div class="txt">
    <p>I want to build a one-page, scroll-driven cinematic website for my apartment
    community, <span class="blank">[PROPERTY NAME]</span>, a
    <span class="blank">[30]</span>-unit multifamily property at
    <span class="blank">[ADDRESS]</span>. As visitors scroll, the site should walk
    them through the property &mdash; exterior approach, entrance and lobby, inside a
    typical unit room by room, then amenities &mdash; ending with floor plans,
    pricing, and a &ldquo;Schedule a Tour&rdquo; form.</p>
    <p>Assets I have: <span class="blank">[list what you gathered, and where you put
    it. If you have nothing yet: &ldquo;none yet &mdash; build with clearly marked
    placeholders I can replace, and give me a shot list of exactly what to
    photograph.&rdquo;]</span></p>
    <p>Build it in this repo as a static site I can deploy for free. Use the
    scroll-scrubbed-video approach unless you would recommend otherwise for my
    assets &mdash; explain your choice in one paragraph.</p>
    <p><b>Before writing any code, show me: (1) the section-by-section storyboard of
    the scroll journey, (2) what you will build each section from, and (3) anything
    missing from my assets. Wait for my OK.</b></p>
  </div>
  <div class="why">You should get back a storyboard like &ldquo;Section 1: night
  aerial of building, headline fades in &rarr; Section 2: doors part as you
  scroll.&rdquo; Push on it. Reorder it. Cut sections. This is the cheapest moment
  to change your mind.</div>
</div>

<div class="prompt">
  <div class="hd"><span class="num">Prompt Two</span>
    <span class="ttl">Pick the look before the motion</span></div>
  <div class="txt">
    <p>Before building the scroll experience, show me 2&ndash;3 style directions as
    static mockups of the hero screen: one modern minimal luxury, one warm and
    community-focused, one bold and urban. Use my logo and real property name. Sites
    whose feel I like: <span class="blank">[paste 1&ndash;3 links &mdash; real estate
    or not]</span>. I will pick one direction and we will build everything in it.</p>
  </div>
  <div class="why">Arguing about fonts and colors on a static mockup takes minutes.
  Doing it after the animations are built takes hours. Pick one, and say what to keep
  from the others.</div>
</div>
""")

P.append("""
<div class="eyebrow">05 &nbsp;&mdash;&nbsp; The Prompt Sequence</div>
<h2>Prompts 3 and 4</h2>
<div class="rule"></div>

<div class="prompt">
  <div class="hd"><span class="num">Prompt Three</span>
    <span class="ttl">The hero and the scroll engine</span></div>
  <div class="txt">
    <p>Build the hero and the scroll system in the
    <span class="blank">[chosen]</span> style: a full-screen opening shot of the
    property, the property name in large type, one line &mdash;
    <span class="blank">[e.g. &ldquo;30 residences in the heart of
    [NEIGHBORHOOD]&rdquo;]</span> &mdash; and a subtle &ldquo;scroll&rdquo; cue. As I
    begin to scroll, start the journey toward the entrance.</p>
    <p>Make scrolling buttery on desktop and mobile, and set the site up so my real
    photos and clips can be dropped in by filename later.
    <b>Screenshot the result at phone size and desktop size and show me both.</b></p>
  </div>
  <div class="why">Insist on both screenshots every time. Most scroll sites that
  fail, fail on phones &mdash; and the majority of your traffic will be on one.</div>
</div>

<div class="prompt">
  <div class="hd"><span class="num">Prompt Four</span>
    <span class="ttl">The walkthrough, one chapter at a time</span></div>
  <div class="txt">
    <p style="color:#7A7064;font-style:italic">Repeat this prompt for each chapter:
    exterior &rarr; entrance and lobby &rarr; the unit, room by room &rarr; amenities
    &rarr; neighborhood.</p>
    <p>Build the <span class="blank">[LOBBY]</span> chapter next. As I scroll,
    <span class="blank">[the camera moves from the front doors through the lobby
    &mdash; use clip/photos: FILENAMES]</span>. Overlay copy:
    <span class="blank">[HEADLINE]</span> and
    <span class="blank">[one supporting line]</span>. The text should appear
    <span class="blank">[fade in / slide up]</span> as the camera settles, then
    release into the next chapter. Show me a screenshot sequence of the
    transition.</p>
  </div>
  <div class="why">This is also where you ask for footage, if you connected
  Higgsfield:</div>
  <div class="txt" style="margin-top:12px;border-top:1px solid #DFD3BE;padding-top:14px">
    <p>Using the Higgsfield connector, generate a
    <span class="blank">[5-second slow dolly-in]</span> from the attached photo of
    <span class="blank">[the lobby]</span>, keeping the space exactly as it looks in
    the photo &mdash; <b>no invented furniture or finishes</b>. Then wire it into the
    lobby chapter.</p>
  </div>
</div>

<div class="warn">
  <h3 style="color:#7A5518;margin-bottom:10px">Build the chapters in order, and stop
  when you have enough</h3>
  <p>Five or six chapters is a complete tour. Ten is a chore. If you find yourself
  adding a chapter for a room you would not show on an actual walkthrough, that is
  the signal to stop and move on to floor plans.</p>
</div>
""")

P.append("""
<div class="eyebrow">06 &nbsp;&mdash;&nbsp; The Prompt Sequence</div>
<h2>Prompts 5 and 6</h2>
<div class="rule"></div>

<div class="prompt">
  <div class="hd"><span class="num">Prompt Five</span>
    <span class="ttl">Floor plans, pricing, availability</span></div>
  <div class="txt">
    <p>Build the floor plans section: a tab or card for each unit type &mdash;
    <span class="blank">[Studio / 1BR / 2BR]</span> &mdash; with the floor plan image,
    square footage, rent range, and an availability badge I can edit easily. Make
    &ldquo;Check availability&rdquo; scroll to the tour form.</p>
    <p><b>Tell me exactly which file to edit when rents or availability change, and
    make that a 30-second job for a non-programmer.</b></p>
  </div>
  <div class="why">This one line is what keeps the site from going stale the month
  after it launches.</div>
</div>

<div class="prompt">
  <div class="hd"><span class="num">Prompt Six</span>
    <span class="ttl">Turn attention into tours</span></div>
  <div class="txt">
    <p>Build the closing section: a &ldquo;Schedule a Tour&rdquo; form &mdash; name,
    phone or email, move-in date, unit type &mdash; a tap-to-call phone button, the
    address with an embedded map, office hours, and fair-housing and license
    information.</p>
    <p>Add a small <b>sticky &ldquo;Book a Tour&rdquo; button</b> that stays visible
    after the first screen. Recommend the simplest free way to make the form actually
    reach me at <span class="blank">[EMAIL]</span>, and set it up.</p>
  </div>
  <div class="why">Ask for a plain email form, not a tenant portal or an account
  system. Every field you add past four costs you leads, and anything requiring a
  login costs you nearly all of them.</div>
</div>

<div class="warn" style="margin-top:6px">
  <h3 style="color:#7A5518;margin-bottom:10px">The single most common mistake</h3>
  <p>Beautiful scroll experiences that never ask for the tour. Every chapter should
  leave the visitor one thumb-tap away from booking &mdash; that is what the sticky
  button is for.</p>
</div>
""")

P.append("""
<div class="eyebrow">07 &nbsp;&mdash;&nbsp; Finish and Ship</div>
<h2>Prompts 7 and 8</h2>
<div class="rule"></div>

<div class="prompt">
  <div class="hd"><span class="num">Prompt Seven</span>
    <span class="ttl">The polish pass &mdash; do not skip this</span></div>
  <div class="txt">
    <p>Polish pass: <b>(1)</b> Test every section at phone size and screenshot each
    one &mdash; fix anything cramped, overflowing, or janky. <b>(2)</b> Make it fast:
    compress images, lazy-load everything below the first screen, and tell me the
    final page weight. <b>(3)</b> Add a reduced-motion fallback &mdash; clean static
    sections with fades &mdash; for visitors whose devices ask for less motion.
    <b>(4)</b> Add page titles, descriptions, and a social-share preview card so
    links look good in text messages. <b>(5)</b> Give me a one-paragraph summary of
    what you fixed.</p>
  </div>
</div>

<div class="prompt">
  <div class="hd"><span class="num">Prompt Eight</span>
    <span class="ttl">Put it live</span></div>
  <div class="txt">
    <p>Set this up to deploy free and give me the URL. Then list the exact steps to
    connect my custom domain <span class="blank">[YOURPROPERTY.com]</span>, written
    for someone who has never touched DNS settings.</p>
  </div>
</div>

<div class="hr"></div>

<h3 style="font-size:26px;margin-bottom:18px">How to steer Claude &mdash; the actual
skill</h3>
<ul class="check">
  <li><b>Name the section, describe the problem in plain words.</b> &ldquo;In the
  lobby section, the text is hard to read over the video&rdquo; beats &ldquo;make it
  better.&rdquo;</li>
  <li><b>One or two changes per message.</b> Ten changes at once gets you a muddy
  average of all ten.</li>
  <li><b>Paste screenshots</b> of what you are seeing, and ask Claude to screenshot
  what <em>it</em> sees.</li>
  <li><b>Pair vibes with a reference.</b> &ldquo;More premium &mdash; closer to how
  [link] feels&rdquo; gives a vague word something to aim at.</li>
  <li><b>Speed of motion is fair game.</b> &ldquo;The unit tour moves too fast, let me
  linger&rdquo; is exactly the right note.</li>
  <li><b>You can always ask why.</b> &ldquo;Explain what you did in plain
  English&rdquo; is a legitimate prompt, at any time.</li>
</ul>
""")

P.append("""
<div class="eyebrow">08 &nbsp;&mdash;&nbsp; The Last Mile</div>
<h2>The audit, the rules,<br>and where to start.</h2>
<div class="rule"></div>

<div class="cols" style="gap:38px">
  <div style="flex:1.05">
    <div class="prompt" style="margin-bottom:22px">
      <div class="hd"><span class="num">Final Prompt</span>
        <span class="ttl">The attention audit</span></div>
      <div class="txt">
        <p>Audit the site against this list and fix what fails: the first screen makes
        someone stop scrolling their phone within three seconds; the property name and
        neighborhood are unmissable; every section has exactly one job; a first-time
        visitor can find the rent and book a tour in under fifteen seconds from any
        point; the page loads fast on a phone on cellular data; nothing moves so much
        that it feels like a theme park; the site works with JavaScript disabled at
        least well enough to show photos and the phone number.</p>
      </div>
    </div>

    <div class="warn">
      <h3 style="color:#7A5518;margin-bottom:12px">Play it straight</h3>
      <p style="margin-bottom:10px"><b>Show the real property.</b> Use AI for camera
      movement over real photos, never to invent granite counters you do not have. A
      visitor who tours after seeing the site should feel it <em>undersold</em> the
      place.</p>
      <p style="margin-bottom:10px"><b>Label enhanced imagery.</b> A small
      &ldquo;Some imagery digitally enhanced&rdquo; note wherever it applies.</p>
      <p style="margin-bottom:10px"><b>Fair housing.</b> Include the Equal Housing
      Opportunity logo and describe the property, never the tenant you imagine.</p>
      <p><b>Keep pricing current.</b> Prompt Five sets up the 30-second edit that
      makes this painless.</p>
    </div>
  </div>

  <div style="flex:.95">
    <div class="callout" style="padding:34px 34px 30px">
      <div class="eyebrow" style="color:#E0B368;margin-bottom:14px">Do This Right Now</div>
      <ul class="tldr">
        <li style="color:#D6CABA">Spend fifteen minutes on the Step Zero checklist
        &mdash; facts and photos.</li>
        <li style="color:#D6CABA">Connect Higgsfield: Settings &rarr; Connectors
        &rarr; Add custom connector &rarr;
        <span class="url">https://mcp.higgsfield.ai</span></li>
        <li style="color:#D6CABA">Paste <b style="color:#FBF8F3">Prompt One</b> with
        your blanks filled in.</li>
        <li style="color:#D6CABA">React to the storyboard, then walk Prompts Two
        through Eight in order, one at a time.</li>
        <li style="color:#D6CABA">Finish with the audit, then send the link to five
        people and watch where they stop scrolling.</li>
      </ul>
      <div style="height:1px;background:#3A3128;margin:26px 0 22px"></div>
      <p style="font-size:19px;color:#BFB3A2">You can start Prompt One in the very
      same conversation &mdash; the repository and branch are already set up and
      waiting.</p>
    </div>
  </div>
</div>
""")


def build():
    total = len(P)
    jpgs = []
    for i, body in enumerate(P, start=1):
        dark = "dark cover" if i == 1 else ""
        bg = "#16120E" if i == 1 else "#FBF8F3"
        foot = "Property Site Playbook"
        pn = ('<div class="foot">%s</div><div class="pnum">%02d&nbsp;/&nbsp;%02d</div>'
              % (foot, i, total))
        html = ("<!doctype html><html><head><meta charset='utf-8'>"
                "<style>%s\nhtml,body{background:%s}</style></head><body>"
                "<div class='page %s'>%s%s</div></body></html>"
                % (CSS, bg, dark, body, pn))
        hp = os.path.join(WORK, "p%02d.html" % i)
        with open(hp, "w") as f:
            f.write(html)
        png = os.path.join(WORK, "p%02d.png" % i)
        # Headless Chromium reserves ~87px of the requested window for chrome, and
        # never paints below the resulting viewport. Oversize the window, then crop.
        subprocess.run([
            CHROME, "--headless", "--disable-gpu", "--no-sandbox",
            "--hide-scrollbars", "--force-device-scale-factor=%d" % SCALE,
            "--window-size=%d,%d" % (W, H + 300),
            "--screenshot=%s" % png, "file://%s" % hp,
        ], check=True, capture_output=True)
        im = Image.open(png).convert("RGB")
        assert im.height >= H * SCALE, "capture %dpx short of page" % (H * SCALE - im.height)
        im = im.crop((0, 0, W * SCALE, H * SCALE))
        out = os.path.join(OUT, "property-site-guide-%02d.jpg" % i)
        im.save(out, "JPEG", quality=88, optimize=True, progressive=True)
        jpgs.append(out)
        print("page %d -> %s (%dx%d, %d KB)"
              % (i, out, im.width, im.height, os.path.getsize(out) // 1024))

    # single tall stitched version
    ims = [Image.open(p) for p in jpgs]
    tw = ims[0].width
    th = sum(i.height for i in ims)
    tall = Image.new("RGB", (tw, th), "#FBF8F3")
    y = 0
    for im in ims:
        tall.paste(im, (0, y))
        y += im.height
    # downscale the tall one so it opens easily anywhere
    tall = tall.resize((tw // 2, th // 2), Image.LANCZOS)
    tp = os.path.join(OUT, "property-site-guide-full.jpg")
    tall.save(tp, "JPEG", quality=86, optimize=True, progressive=True)
    print("full -> %s (%dx%d, %d KB)"
          % (tp, tall.width, tall.height, os.path.getsize(tp) // 1024))


build()
