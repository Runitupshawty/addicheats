/* =============================================================================
   scroll.js — the scroll engine for the property journey
   =============================================================================

   WHAT THIS FILE DOES (in plain English)
   --------------------------------------
   As you scroll, this script keeps a handful of numbers and CSS classes up to
   date. It does not move the page, speed it up, slow it down or take it over in
   any way. All it does is *describe* where you are, and let CSS do the drawing.

   Specifically, on every frame it updates:

     • `--p` on each `.chapter`      a number from 0 to 1 describing how far that
                                    one chapter has travelled through the screen.
                                    0 = its top edge is just touching the bottom
                                    of the screen. 1 = its bottom edge has just
                                    passed the top of the screen.
     • `--scroll-progress` on :root  0 to 1 for the whole document.
     • `.is-active`                  on the chapter filling most of the screen.
     • `.is-seen`                    on any chapter that has been reached. Once
                                     added it is never taken away.
     • `.is-scrolled` on <body>      once you are past the first screenful.
                                     (The sticky CTA reveals off this. Styling
                                     that is Structure's job, not ours.)

   SCROLL-SCRUBBED VIDEO
   ---------------------
   Four chapters carry real footage. Their `<video data-chapter-video>` ships
   with no `src` at all — this file supplies one, and only for chapters that are
   nearly on screen, so four clips never download at once. Once a clip has its
   metadata, `currentTime` is driven straight off that chapter's `--p`: the
   scrollbar *is* the transport. Nothing is ever played. `play()` is not called
   anywhere in this file, there is no loop, and the files are silent.

   The rules that keep that cheap rather than expensive all live in section 4:
   one rendition chosen per viewport, a load window with hysteresis, a hard cap
   on how many clips may be resident, a one-frame deadband on seeking, and a
   strict "never issue a seek while one is in flight" rule. If a file cannot be
   decoded the element is emptied again so its `poster` — never a black box —
   is what the visitor sees. Under reduced motion no clip is loaded at all, and
   with JavaScript off no `src` is ever set, so the poster is all there is.

   HOW IT STAYS FAST
   -----------------
   Reading a page's geometry (how tall things are, where they sit) is expensive.
   Writing styles is cheap. If you interleave the two the browser has to redo
   layout over and over — "layout thrashing". So:

     • Geometry (each chapter's position and height in the document) is measured
       ONCE, cached, and only re-measured on resize / orientation change /
       image load — and even then it is debounced.
     • The scroll listener does nothing except say "something changed, please
       schedule a frame". No measuring, no style writing, ever, inside it.
     • All the real work happens inside requestAnimationFrame, where reads are
       batched first and writes second.
     • The rAF loop switches itself off a few frames after scrolling stops, so
       an idle page costs nothing.

   WHAT IT DELIBERATELY DOES NOT DO
   --------------------------------
     • No scroll-jacking. No smooth-scroll emulation. No easing, no snapping.
     • No preventDefault on wheel, touch, or key events. Ever.
     • No listeners that are not passive.
     Native scrolling is left completely alone. If you delete this file the page
     still works — it just stops animating.

   REDUCED MOTION
   --------------
   If the visitor has asked their OS for reduced motion, the whole animation
   engine is skipped. Chapters get their settled end-state classes once, and no
   rAF loop ever starts. The visual flattening itself lives in chapters.css as
   real CSS (a `prefers-reduced-motion` block) — not as a branch in here. This
   file also listens for the preference changing mid-session and swaps modes.

   Vanilla ES2020+. No dependencies, no build step. One namespaced global
   (`window.SiteMotion`) exposed purely so the integrator can poke at it.
   ========================================================================== */

(function () {
  'use strict';

  /* ---------------------------------------------------------------------- *
   * Tuning knobs
   * ---------------------------------------------------------------------- */

  /** Wait this long after the last resize event before re-measuring. */
  var RESIZE_DEBOUNCE_MS = 150;

  /** Keep the rAF loop alive this many idle frames after scrolling stops. */
  var IDLE_FRAMES = 6;

  /** `--p` is written to this many decimal places. More is wasted precision. */
  var P_PRECISION = 4;

  /**
   * Hysteresis for `.is-scrolled`, in pixels. The class goes on at exactly one
   * viewport height and only comes off once you are this far back above it, so
   * hovering right on the boundary cannot make the sticky CTA flicker.
   */
  var SCROLLED_HYSTERESIS_PX = 64;

  /* ---------------------------------------------------------------------- *
   * Tuning knobs — video scrubbing
   * ---------------------------------------------------------------------- */

  /**
   * Frame rate of the supplied clips (all 24fps, 5.04s, GOP 12). This is used
   * for one thing only: sizing the deadband below which a seek is not worth
   * issuing. Being a frame out either way is invisible; thrashing the decoder
   * with sub-frame seeks is not.
   */
  var VIDEO_FPS = 24;
  var VIDEO_FRAME_SECONDS = 1 / VIDEO_FPS;

  /** Give a clip a `src` once its chapter is within this many viewports. */
  var VIDEO_LOAD_VH = 1.5;

  /**
   * ...and take it away again once the chapter is this far off. The gap
   * between the two numbers is deliberate hysteresis: with a single threshold,
   * parking the scrollbar exactly on the boundary would load and unload the
   * same few megabytes over and over.
   */
  var VIDEO_UNLOAD_VH = 2.25;

  /**
   * Hard ceiling on resident clips, whatever the geometry says. Chapters are a
   * viewport tall, so the load window normally holds two or three; this is the
   * backstop that makes "four videos never download at once" a property of the
   * code rather than a property of the current layout.
   */
  var VIDEO_MAX_LOADED = 3;

  /**
   * When the cap has to evict somebody, a clip that is already resident gets
   * this much of a viewport knocked off its distance first. Without that bias,
   * two chapters whose gaps cross each other would take turns being evicted and
   * refetched — the same flapping the load/unload hysteresis exists to prevent,
   * just expressed through the cap instead of through the thresholds.
   */
  var VIDEO_LOYALTY_VH = 0.35;

  /**
   * Viewport width in device pixels (CSS px x DPR, DPR capped at 2) at or above
   * which the 1080 rendition earns its extra ~1.5MB. A 1440px desktop clears it;
   * a 390px phone at DPR 2 (780) does not and gets the 720 file.
   */
  var VIDEO_HD_MIN_DEVICE_PX = 1200;

  /**
   * A seek that never reports back would wedge the queue forever. If `seeked`
   * has not fired within this long we assume it was dropped and allow another.
   */
  var VIDEO_SEEK_TIMEOUT_MS = 1500;

  /**
   * The clip is scrubbed across this window of `--p`, not the whole 0..1 range.
   * The chapter arrives holding frame 0 for a beat and leaves holding the last
   * frame for a beat, instead of the clip being half over by the time the
   * chapter has finished sliding into view.
   */
  var VIDEO_SCRUB_IN = 0.1;
  var VIDEO_SCRUB_OUT = 0.9;

  /* ---------------------------------------------------------------------- *
   * Module state
   * ---------------------------------------------------------------------- */

  var root = document.documentElement;

  /** Cached geometry, one record per chapter: {el, top, height, seen, p, vid}. */
  var records = [];

  /** One entry per `[data-chapter-video]` on the page. See section 4. */
  var videos = [];

  /** Scratch array reused every frame so ranking clips allocates nothing. */
  var videoRank = [];

  /** Which rendition the current viewport wants. Recomputed in measure(). */
  var videoUseHD = false;

  /** Cached viewport height and maximum scrollable distance. */
  var viewportH = 1;
  var maxScroll = 1;

  /** rAF bookkeeping. */
  var rafId = 0;
  var idleFrames = 0;
  var running = false;

  /** Last values written, so we can skip no-op DOM writes. */
  var lastScrollY = -1;
  var lastProgress = -1;
  var lastActiveEl = null;
  var lastScrolledState = null;

  /** Debounce timer for resize. */
  var resizeTimer = 0;

  /** The reduced-motion media query, kept around so we can watch it. */
  var reduceMQ = null;

  /** Optional ResizeObserver watching the journey for layout changes. */
  var resizeObserver = null;

  /** Which mode we are currently in: 'motion', 'reduced', or null (stopped). */
  var mode = null;

  /* ---------------------------------------------------------------------- *
   * Small helpers
   * ---------------------------------------------------------------------- */

  /** Clamp n into the 0..1 range. */
  function clamp01(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }

  /** Current vertical scroll offset, with an old-browser fallback. */
  function scrollTop() {
    return window.pageYOffset !== undefined
      ? window.pageYOffset
      : root.scrollTop || 0;
  }

  /** Round to P_PRECISION decimals and return a string CSS can consume. */
  function fixed(n) {
    return n.toFixed(P_PRECISION);
  }

  /* ---------------------------------------------------------------------- *
   * 1. Collect the chapters
   * ---------------------------------------------------------------------- */

  /**
   * Find every `.chapter`. We prefer to look inside `.journey`, but fall back
   * to the whole document so a rearranged page still animates. Returns an empty
   * array if there is nothing to find — every later step tolerates that, which
   * is what keeps this file from throwing on a page with no journey at all.
   */
  function collect() {
    var scope = document.querySelector('.journey') || document;
    var found = scope.querySelectorAll('.chapter');
    var out = [];
    videos = [];
    for (var i = 0; i < found.length; i++) {
      var chapter = found[i];
      var rec = {
        el: chapter,
        top: 0,       // distance from the top of the document, in px
        height: 0,    // border-box height, in px
        seen: false,  // has `.is-seen` been applied yet?
        p: -1,        // last `--p` written, so we can skip repeats
        vid: null     // video state, for the four chapters that have footage
      };
      var video = chapter.querySelector('[data-chapter-video]');
      if (video) {
        // One state object per element, for the lifetime of the element. The
        // preference can flip mid-session, which re-runs collect(); building a
        // fresh state each time would quietly stack up duplicate listeners.
        if (!video._motionVideo) {
          video._motionVideo = makeVideoState(video, chapter);
        }
        rec.vid = video._motionVideo;
        videos.push(rec.vid);
      }
      out.push(rec);
    }
    return out;
  }

  /* ---------------------------------------------------------------------- *
   * 2. Measure (the only place we read layout)
   * ---------------------------------------------------------------------- */

  /**
   * Cache each chapter's position in *document* coordinates, plus the viewport
   * height and total scrollable distance.
   *
   * getBoundingClientRect() is viewport-relative, so we add the current scroll
   * offset to convert it to a document-relative position that stays valid until
   * the layout itself changes. All reads happen together, before any writes.
   */
  function measure() {
    var y = scrollTop();

    viewportH = window.innerHeight || root.clientHeight || 1;

    var docHeight = Math.max(
      root.scrollHeight,
      document.body ? document.body.scrollHeight : 0
    );
    // Guard against a zero/negative denominator on very short pages.
    maxScroll = Math.max(1, docHeight - viewportH);

    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      var rect = rec.el.getBoundingClientRect();
      rec.top = rect.top + y;
      rec.height = rect.height || 1; // never divide by zero later
    }

    // Picking a video rendition needs `innerWidth`, which is a layout read, so
    // it happens here with the other reads rather than once per frame.
    chooseRendition();

    // Force the next update() to write everything, since the maths just moved.
    lastScrollY = -1;
    lastProgress = -1;
  }

  /* ---------------------------------------------------------------------- *
   * 3. Update (reads only cached numbers, then writes)
   * ---------------------------------------------------------------------- */

  /**
   * The per-frame work. Given a scroll offset, compute and apply everything.
   *
   * THE CHAPTER PROGRESS FORMULA
   * ----------------------------
   * Let `rectTop` be the chapter's top edge relative to the viewport, `h` its
   * height and `vh` the viewport height. The chapter's full travel — from "top
   * edge touching the bottom of the screen" to "bottom edge touching the top of
   * the screen" — is `vh + h` pixels. How far through that travel we are is:
   *
   *     p = (vh - rectTop) / (vh + h)
   *
   * Sanity checks:
   *   rectTop = vh   (just entering from below) -> p = 0        / (vh+h) = 0
   *   rectTop = 0    (top aligned with screen)  -> p = vh       / (vh+h)
   *   rectTop = -h   (just left the top)        -> p = (vh + h) / (vh+h) = 1
   *
   * Clamped to 0..1 so chapters miles off-screen sit cleanly at the ends.
   */
  function update(y) {
    var vh = viewportH;

    /* ---- global document progress ---- */
    var progress = clamp01(y / maxScroll);
    if (progress !== lastProgress) {
      root.style.setProperty('--scroll-progress', fixed(progress));
      lastProgress = progress;
    }

    /* ---- body.is-scrolled, with hysteresis ---- */
    var body = document.body;
    if (body) {
      var scrolled = lastScrolledState === true
        ? y >= vh - SCROLLED_HYSTERESIS_PX  // already on: hold until well back
        : y >= vh;                          // off: turn on at one full screen
      if (scrolled !== lastScrolledState) {
        body.classList.toggle('is-scrolled', scrolled);
        lastScrolledState = scrolled;
      }
    }

    /* ---- per-chapter progress, and find the most-visible chapter ---- */
    var bestEl = null;
    var bestVisible = 0;

    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      var rectTop = rec.top - y;               // viewport-relative top edge
      var rectBottom = rectTop + rec.height;   // viewport-relative bottom edge

      var p = clamp01((vh - rectTop) / (vh + rec.height));

      // Only touch the DOM when the rounded value actually changed.
      var rounded = Math.round(p * 10000) / 10000;
      if (rounded !== rec.p) {
        rec.el.style.setProperty('--p', fixed(p));
        rec.p = rounded;
      }

      // How many pixels of this chapter are inside the viewport right now.
      var visible = Math.min(vh, rectBottom) - Math.max(0, rectTop);
      if (visible > bestVisible) {
        bestVisible = visible;
        bestEl = rec.el;
      }

      // `.is-seen` is sticky: applied the first time the chapter is reached,
      // and never removed afterwards. The test is `p > 0` rather than "is on
      // screen right now" so that jumping straight down the page — an anchor
      // click, a restored scroll position, a find-in-page — still counts every
      // chapter above the landing point as reached, which is what it is.
      if (!rec.seen && p > 0) {
        rec.seen = true;
        rec.el.classList.add('is-seen');
      }

      // Hand the video engine this chapter's progress and its distance from the
      // viewport, in pixels. Both come from numbers we already have; no extra
      // layout is read. Nothing is decided here — see syncVideos().
      if (rec.vid) {
        rec.vid.p = p;
        rec.vid.gap = rectTop > vh
          ? rectTop - vh          // still below the fold, this far down
          : rectBottom < 0
            ? -rectBottom         // gone past the top, this far up
            : 0;                  // some part of it is on screen
      }
    }

    /* ---- lazily load / release / scrub the chapter clips ---- */
    if (videos.length) syncVideos(vh);

    /* ---- .is-active moves to whichever chapter fills most of the screen ---- */
    if (bestEl !== lastActiveEl) {
      if (lastActiveEl) lastActiveEl.classList.remove('is-active');
      if (bestEl) bestEl.classList.add('is-active');
      lastActiveEl = bestEl;
    }

    lastScrollY = y;
  }

  /* ---------------------------------------------------------------------- *
   * 4. Scroll-scrubbed video
   * ----------------------------------------------------------------------
   *
   * The shape of the problem
   * ------------------------
   * A `<video>` is not a texture you can sample at an arbitrary time for free.
   * Asking for a new `currentTime` starts an asynchronous seek: the decoder
   * rewinds to the nearest keyframe (every 12 frames here, so half a second)
   * and decodes forward. Issue seeks faster than they complete and they queue,
   * or get dropped, and the picture stops tracking the scrollbar.
   *
   * So the loop below is built around three refusals:
   *
   *   1. Refuse to seek at all until the element reports HAVE_METADATA. Before
   *      that, `duration` is NaN and `currentTime` is a no-op; the target is
   *      parked in `pending` and applied the moment metadata arrives.
   *   2. Refuse to seek while a seek is in flight. The newest target replaces
   *      whatever was queued — there is no point servicing a scroll position
   *      the visitor has already left — and it is issued from the `seeked`
   *      handler. One seek outstanding, ever.
   *   3. Refuse to seek for less than a frame. At 24fps anything under 1/24s
   *      cannot change the picture, so it is pure decoder churn.
   *
   * Everything else here is about bytes: one rendition per viewport, a load
   * window with hysteresis, and a hard cap on resident clips.
   *
   * `play()` is never called. Not on load, not on seek, not on visibility
   * change. This is a filmstrip attached to the scrollbar, not a player.
   * ---------------------------------------------------------------------- */

  /** Build the bookkeeping for one `<video>` and wire its three events. */
  function makeVideoState(el, chapter) {
    var st = {
      el: el,
      chapter: chapter,
      src: '',          // URL currently assigned; '' means released
      failedSrc: '',    // URL that errored, so we do not retry it forever
      ready: false,     // metadata has arrived
      duration: 0,
      seeking: false,   // a seek is in flight
      seekAt: 0,        // when it was issued, for the watchdog
      pending: -1,      // target queued behind the in-flight seek; -1 = none
      target: -1,       // last time we asked for, for debugging
      gap: Infinity,    // px between this chapter's box and the viewport
      rank: Infinity,   // gap, biased in favour of clips already resident
      p: 0
    };

    // The poster is also painted as the media frame's background (see
    // chapters.css), which is what guarantees "never a black box" even if the
    // element itself fails in some way we have not thought of.
    var poster = el.getAttribute('poster');
    if (poster && chapter) {
      var media = el.closest ? el.closest('.chapter__media') : null;
      (media || chapter).style.setProperty(
        '--chapter-poster', 'url("' + poster.replace(/"/g, '%22') + '")'
      );
    }

    el.addEventListener('loadedmetadata', function () { onVideoMeta(st); });
    el.addEventListener('seeked', function () { onVideoSeeked(st); });
    el.addEventListener('error', function () { onVideoError(st); });

    return st;
  }

  /**
   * Pick 720 vs 1080 for this viewport. Called from measure(), never per frame,
   * because `innerWidth` and `devicePixelRatio` are layout reads.
   *
   * DPR is capped at 2 — beyond that the extra density is well past what a
   * scrubbed background clip needs — and Save-Data, if the browser offers it,
   * pins us to the small file regardless of screen size.
   */
  function chooseRendition() {
    var dpr = window.devicePixelRatio || 1;
    if (dpr > 2) dpr = 2;
    var w = (window.innerWidth || root.clientWidth || 0) * dpr;

    var save = false;
    try {
      var conn = navigator.connection || navigator.webkitConnection;
      if (conn) {
        save = !!conn.saveData ||
          conn.effectiveType === 'slow-2g' ||
          conn.effectiveType === '2g' ||
          conn.effectiveType === '3g';
      }
    } catch (err) { /* the API is optional; absence just means "no opinion" */ }

    videoUseHD = !save && w >= VIDEO_HD_MIN_DEVICE_PX;
  }

  /** The URL this element should be given right now, or '' if it has none. */
  function pickVideoSrc(el) {
    var hd = el.getAttribute('data-src-1080') || '';
    var sd = el.getAttribute('data-src-720') || '';
    if (!hd) return sd;
    if (!sd) return hd;
    return videoUseHD ? hd : sd;
  }

  /** Attach a URL and start fetching. Nothing plays; `load()` only buffers. */
  function loadVideo(st, url) {
    var v = st.el;

    st.src = url;
    st.ready = false;
    st.seeking = false;
    st.pending = -1;
    st.target = -1;
    st.duration = 0;

    // The markup ships `preload="none"` precisely so that assigning a `src`
    // does not start a download. We are the ones who decide it is time.
    v.preload = 'auto';
    v.muted = true;          // belt and braces; the files carry no audio track
    v.setAttribute('src', url);
    if (st.chapter) st.chapter.setAttribute('data-video-state', 'loading');

    try { v.load(); } catch (err) { /* nothing sensible to do */ }
  }

  /**
   * Detach the URL and let the browser reclaim the buffer. Removing the
   * attribute and calling load() puts the element back to exactly the state it
   * shipped in — empty, showing its poster.
   */
  function releaseVideo(st) {
    var v = st.el;
    if (!st.src) return;

    st.src = '';
    st.ready = false;
    st.seeking = false;
    st.pending = -1;
    st.target = -1;
    st.duration = 0;

    v.removeAttribute('src');
    v.preload = 'none';
    if (st.chapter && st.chapter.getAttribute('data-video-state') !== 'error') {
      st.chapter.setAttribute('data-video-state', 'idle');
    }

    try { v.load(); } catch (err) { /* nothing sensible to do */ }
  }

  function onVideoMeta(st) {
    st.ready = true;
    var d = st.el.duration;
    st.duration = (typeof d === 'number' && isFinite(d) && d > 0) ? d : 0;
    if (st.chapter) st.chapter.setAttribute('data-video-state', 'ready');

    // Apply whatever the scroll position asked for while we were waiting.
    if (st.pending >= 0) {
      var t = st.pending;
      st.pending = -1;
      seekVideo(st, t);
    }
  }

  function onVideoSeeked(st) {
    st.seeking = false;
    if (st.pending >= 0) {
      var t = st.pending;
      st.pending = -1;
      seekVideo(st, t);
    }
  }

  /**
   * Decode or network failure. The contract is explicit: the poster stays, and
   * the visitor never sees a black rectangle. So we empty the element (which
   * restores the poster), mark the chapter so chapters.css can hide the video
   * box outright, and remember which URL failed.
   *
   * The failure is remembered per-URL rather than per-element on purpose. A
   * codec the browser cannot handle will not start working on the fourth
   * attempt, and retrying every time the chapter scrolls past would be a
   * request loop. But if the viewport later changes rendition, the other file
   * is a genuinely different thing to try, so that one is allowed through.
   */
  function onVideoError(st) {
    if (!st.src) return;  // fired while releasing; not a real failure
    st.failedSrc = st.src;
    releaseVideo(st);
    if (st.chapter) st.chapter.setAttribute('data-video-state', 'error');
  }

  /**
   * Ask for a time. Enforces refusals 1, 2 and 3 from the section header, in
   * that order, and is the ONLY place `currentTime` is assigned.
   */
  function seekVideo(st, t) {
    var v = st.el;

    // 1. Not before metadata. HAVE_NOTHING means duration is still unknown.
    if (!st.ready || v.readyState < 1 || !st.duration) {
      st.pending = t;
      return;
    }

    // Never sit exactly on the duration boundary — some decoders return a
    // blank frame there and it also risks firing `ended`.
    var max = st.duration - VIDEO_FRAME_SECONDS;
    if (max < 0) max = 0;
    if (t > max) t = max;
    if (t < 0) t = 0;
    st.target = t;

    // 2. Never two seeks at once. Newest target wins; `seeked` will drain it.
    if (st.seeking) {
      if (Date.now() - st.seekAt < VIDEO_SEEK_TIMEOUT_MS) {
        st.pending = t;
        return;
      }
      st.seeking = false;  // watchdog: the seek was dropped, take the lock back
    }

    // 3. Never for less than one frame.
    if (Math.abs(t - v.currentTime) < VIDEO_FRAME_SECONDS) {
      st.pending = -1;
      return;
    }

    st.pending = -1;
    st.seeking = true;
    st.seekAt = Date.now();
    try {
      v.currentTime = t;
    } catch (err) {
      st.seeking = false;
    }
  }

  /**
   * Map this chapter's `--p` onto the clip. Strictly increasing in `p`, so
   * scrolling up runs the footage exactly backwards, and stopping stops it.
   */
  function scrubVideo(st) {
    if (!st.duration) return;
    var span = VIDEO_SCRUB_OUT - VIDEO_SCRUB_IN;
    var q = clamp01((st.p - VIDEO_SCRUB_IN) / span);
    seekVideo(st, q * st.duration);
  }

  /**
   * Decide, once per frame, which clips should be resident — then scrub the
   * ones that are. Runs off `gap` values computed in update() from cached
   * geometry, so it reads no layout of its own.
   */
  function syncVideos(vh) {
    var loadEdge = VIDEO_LOAD_VH * vh;
    var dropEdge = VIDEO_UNLOAD_VH * vh;
    var i, st;

    // Rank every candidate inside the load window by distance, with a bias in
    // favour of clips we already hold. `videoRank` is reused rather than
    // reallocated; at four entries the sort is free.
    var loyalty = VIDEO_LOYALTY_VH * vh;
    videoRank.length = 0;
    for (i = 0; i < videos.length; i++) {
      st = videos[i];
      // A clip we do not hold has to come inside the load window to qualify; a
      // clip we do hold keeps its place until the wider unload window. That
      // difference IS the hysteresis — parking the scrollbar on the boundary
      // cannot make the same file load and unload over and over.
      if (st.gap > (st.src ? dropEdge : loadEdge)) continue;
      st.rank = st.src ? st.gap - loyalty : st.gap;
      videoRank.push(st);
    }
    if (videoRank.length > 1) {
      videoRank.sort(function (a, b) { return a.rank - b.rank; });
    }
    var keep = videoRank.length < VIDEO_MAX_LOADED
      ? videoRank.length
      : VIDEO_MAX_LOADED;

    for (i = 0; i < videos.length; i++) {
      st = videos[i];

      var wanted = false;
      for (var k = 0; k < keep; k++) {
        if (videoRank[k] === st) { wanted = true; break; }
      }

      if (wanted) {
        var url = pickVideoSrc(st.el);
        // The URL that already failed is off the table; a *different* one is
        // fair game, which is how a rendition change gets a second chance.
        if (url && url !== st.failedSrc && st.src !== url) loadVideo(st, url);
        if (st.src) scrubVideo(st);
      } else if (st.src) {
        // Out of the running: either too far away, or squeezed out by the cap
        // because three nearer chapters want the memory more. Either way the
        // buffer goes back and the poster takes over. The cap is enforced here
        // rather than only at load time, which is what makes "four clips are
        // never resident at once" true of the code rather than of the layout.
        releaseVideo(st);
      }
    }
  }

  /** Used when leaving motion mode, and by destroy(). */
  function releaseAllVideos() {
    for (var i = 0; i < videos.length; i++) releaseVideo(videos[i]);
  }

  /* ---------------------------------------------------------------------- *
   * 5. The frame loop
   * ---------------------------------------------------------------------- */

  function schedule() {
    if (!rafId && running) {
      rafId = window.requestAnimationFrame(frame);
    }
  }

  function frame() {
    rafId = 0;
    if (!running) return;

    var y = scrollTop();

    // Count how long the page has been still. Momentum scrolling on touch
    // devices can coast between scroll events, so we keep ticking for a few
    // frames past the last movement rather than stopping the instant the
    // event stream pauses.
    if (y !== lastScrollY) {
      idleFrames = 0;
    } else {
      idleFrames++;
    }

    update(y);

    if (idleFrames < IDLE_FRAMES) schedule();
  }

  /**
   * The scroll listener. Note what is NOT here: no getBoundingClientRect, no
   * innerHeight, no style writes. It only raises a flag and asks for a frame.
   * Registered passive so the browser never has to wait on us to scroll.
   */
  function onScroll() {
    idleFrames = 0;
    schedule();
  }

  /* ---------------------------------------------------------------------- *
   * 6. Resize handling (debounced — measuring is the expensive part)
   * ---------------------------------------------------------------------- */

  function onResize() {
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      resizeTimer = 0;
      if (!running) return;
      measure();
      idleFrames = 0;
      schedule();
    }, RESIZE_DEBOUNCE_MS);
  }

  /**
   * Images (the chapter artwork) can change the page height after first paint,
   * which would leave our cached geometry stale. `load` covers the simple case;
   * a ResizeObserver on the journey covers everything else — a font swapping in,
   * a floor-plan panel opening, a details element expanding. Both funnel into
   * the same debounced re-measure.
   */
  function watchLayout() {
    window.addEventListener('load', onResize, { passive: true });

    if (typeof window.ResizeObserver !== 'function') return;
    var target = document.querySelector('.journey') || document.body;
    if (!target) return;
    try {
      resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(target);
    } catch (err) {
      resizeObserver = null; // Non-fatal: we still have the resize listener.
    }
  }

  /* ---------------------------------------------------------------------- *
   * 7. Mode: full motion
   * ---------------------------------------------------------------------- */

  function startMotion() {
    mode = 'motion';
    running = true;

    measure();
    update(scrollTop());

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });
    watchLayout();

    schedule();
  }

  function stopMotion() {
    running = false;

    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (resizeTimer) {
      window.clearTimeout(resizeTimer);
      resizeTimer = 0;
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onResize);
    window.removeEventListener('load', onResize);

    // Nothing is going to drive `currentTime` any more, so hand the buffers
    // back. Each element returns to showing its poster, which is the correct
    // resting state for a clip nobody is scrubbing.
    releaseAllVideos();

    mode = null;
  }

  /* ---------------------------------------------------------------------- *
   * 8. Mode: reduced motion
   * ---------------------------------------------------------------------- */

  /**
   * The animation engine does not run at all here. No geometry cache, no `--p`,
   * no `.is-active`, and — crucially — no repeating rAF loop. Every chapter is
   * put straight into its settled end state and left there; chapters.css then
   * draws them as plain static panels via its own `prefers-reduced-motion`
   * block. Because `--p` is never set, the CSS falls back to its settled
   * default, which is exactly the state a visitor with JavaScript switched off
   * gets too.
   *
   * One thing does still have to work: `.is-scrolled`. The sticky CTA reveals
   * off it, so it is functionality rather than decoration, and dropping it
   * would hide the "Book a Tour" button from precisely the visitors least
   * likely to go hunting for it.
   *
   * It is handled by a passive scroll listener that coalesces into a single
   * animation frame — one frame per scroll burst, which reads `scrollY` and
   * toggles one class. It does not re-schedule itself, so it is not a loop; it
   * is the cheapest correct way to keep one boolean up to date. (An
   * IntersectionObserver sentinel would avoid even that, but it reports only on
   * threshold *crossings*, which makes jump-scrolls — anchor clicks, restored
   * positions — fiddly to get right, and it is the harder thing to test.)
   *
   * VIDEO IS NOT LOADED HERE AT ALL. Not paused, not loaded-then-parked: no
   * `src` is ever assigned, so nothing is fetched and nothing is decoded. Each
   * `<video>` shows its `poster`, which is a still frame of the same footage —
   * exactly what a visitor who asked for less motion should get, and the same
   * thing a visitor with JavaScript disabled gets.
   */
  function startReduced() {
    mode = 'reduced';
    running = false;

    releaseAllVideos();

    var chapters = document.querySelectorAll('.chapter');
    for (var i = 0; i < chapters.length; i++) {
      // Any `--p` left over from a previous session in motion mode must go, or
      // it would keep driving calc() values that the reduced block does not
      // override.
      chapters[i].style.removeProperty('--p');
      chapters[i].classList.add('is-seen');
      chapters[i].classList.remove('is-active');
    }
    root.style.removeProperty('--scroll-progress');
    lastActiveEl = null;

    window.addEventListener('scroll', onReducedScroll, { passive: true });
    window.addEventListener('resize', onReducedScroll, { passive: true });
    window.addEventListener('orientationchange', onReducedScroll, { passive: true });
    reducedTick();
  }

  /** rAF handle for the reduced-mode one-shot. Never re-schedules itself. */
  var reducedRafId = 0;

  function onReducedScroll() {
    if (reducedRafId) return; // already queued for this burst
    reducedRafId = window.requestAnimationFrame(reducedTick);
  }

  function reducedTick() {
    reducedRafId = 0;
    var body = document.body;
    if (!body) return;

    var vh = window.innerHeight || root.clientHeight || 1;
    var y = scrollTop();
    var scrolled = lastScrolledState === true
      ? y >= vh - SCROLLED_HYSTERESIS_PX
      : y >= vh;

    if (scrolled !== lastScrolledState) {
      body.classList.toggle('is-scrolled', scrolled);
      lastScrolledState = scrolled;
    }
  }

  function stopReduced() {
    if (reducedRafId) {
      window.cancelAnimationFrame(reducedRafId);
      reducedRafId = 0;
    }
    window.removeEventListener('scroll', onReducedScroll);
    window.removeEventListener('resize', onReducedScroll);
    window.removeEventListener('orientationchange', onReducedScroll);
    mode = null;
  }

  /* ---------------------------------------------------------------------- *
   * 9. Boot, and react to the preference changing at runtime
   * ---------------------------------------------------------------------- */

  function prefersReduced() {
    return !!(reduceMQ && reduceMQ.matches);
  }

  function applyMode() {
    var wanted = prefersReduced() ? 'reduced' : 'motion';
    if (wanted === mode) return;

    if (mode === 'motion') stopMotion();
    else if (mode === 'reduced') stopReduced();

    // Reset the write-caches so the incoming mode starts from a clean slate.
    lastScrollY = -1;
    lastProgress = -1;
    lastScrolledState = null;

    // Collected in both modes. Reduced motion still wants the video states to
    // exist — that is what publishes each clip's poster to CSS as
    // `--chapter-poster`, and it is what `releaseAllVideos()` acts on if the
    // visitor turns the preference on while a clip is resident.
    records = collect();

    if (wanted === 'reduced') {
      startReduced();
    } else {
      startMotion();
    }
  }

  function boot() {
    if (typeof window.matchMedia === 'function') {
      reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

      // addEventListener is the modern API; addListener is the Safari <14 name.
      if (typeof reduceMQ.addEventListener === 'function') {
        reduceMQ.addEventListener('change', applyMode);
      } else if (typeof reduceMQ.addListener === 'function') {
        reduceMQ.addListener(applyMode);
      }
    }
    applyMode();
  }

  // The script tag sits at the end of <body>, so the DOM is normally ready. The
  // guard is there for the case where somebody moves it into <head>.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  /* ---------------------------------------------------------------------- *
   * 10. The one global we expose
   * ---------------------------------------------------------------------- */

  /**
   * window.SiteMotion
   *   .refresh()   re-measure now (call after injecting or resizing content)
   *   .destroy()   remove every listener and stop entirely
   *   .isReduced() true when running in reduced-motion mode
   *   .mode        'motion' | 'reduced' | null
   *   .videos()    a snapshot of the scrub engine, for debugging and for the
   *                automated checks. Read-only: it copies out numbers, it does
   *                not hand back the live state objects.
   */
  window.SiteMotion = {
    refresh: function () {
      if (mode !== 'motion') return;
      measure();
      idleFrames = 0;
      schedule();
    },
    destroy: function () {
      if (mode === 'motion') stopMotion();
      else if (mode === 'reduced') stopReduced();
      releaseAllVideos();
    },
    isReduced: prefersReduced,
    videos: function () {
      var out = [];
      for (var i = 0; i < videos.length; i++) {
        var st = videos[i];
        out.push({
          chapter: st.chapter ? st.chapter.id : '',
          src: st.src,
          hasSrcAttr: st.el.hasAttribute('src'),
          failedSrc: st.failedSrc,
          state: st.chapter ? st.chapter.getAttribute('data-video-state') : '',
          ready: st.ready,
          duration: st.duration,
          currentTime: st.el.currentTime,
          target: st.target,
          seeking: st.seeking,
          pending: st.pending,
          readyState: st.el.readyState,
          gapVh: viewportH ? st.gap / viewportH : 0,
          p: st.p
        });
      }
      return out;
    },
    get mode() { return mode; }
  };
})();

/* =============================================================================
   INTEGRATION NOTE: for the integrator — changes needed in files I do not own
   =============================================================================

   1. CSS LOAD ORDER (index.html — Structure)
      `css/chapters.css` must be linked AFTER `css/layout.css`, which itself
      comes after `css/tokens.css`:

          <link rel="stylesheet" href="css/tokens.css">
          <link rel="stylesheet" href="css/layout.css">
          <link rel="stylesheet" href="css/chapters.css">

      chapters.css sets the copy colour and the media scrim that guarantee the
      4.5:1 contrast requirement over the artwork. If layout.css loads last and
      sets a colour on `.chapter__copy` descendants at equal specificity, it
      wins and the contrast guarantee is lost.

   2. SMOOTH SCROLL FOR THE `#tour` ANCHORS (tokens.css or layout.css —
      Structure). This file deliberately implements no JS easing for anchor
      clicks. If you want the header and sticky CTA to glide to the tour form,
      use the native property, and gate it on the motion preference:

          @media (prefers-reduced-motion: no-preference) {
            html { scroll-behavior: smooth; }
          }

      Also give `#tour` a `scroll-margin-top` roughly equal to the sticky header
      height so the form heading is not tucked under the header on arrival.

   3. IF `js/site.js` INJECTS OR REPLACES CHAPTER CONTENT after load
      (Data owns that file). Anything that changes the page height invalidates
      the cached geometry. A ResizeObserver on `.journey` already covers the
      common cases automatically, but after a large synchronous DOM swap it is
      cheapest to just call:

          if (window.SiteMotion) window.SiteMotion.refresh();

      One caution while we are here: `--p` is safe to use for `transform`,
      `opacity`, `color` and the like, but do not drive a layout-affecting
      property with it (height, margin, font-size, grid sizing). Doing so makes
      the page resize as it scrolls, which trips the ResizeObserver, which
      re-measures, which changes `--p` again — a slow feedback loop that will
      look like jitter.

   4. THE `<img>` INSIDE `[data-media]`
      chapters.css styles `.chapter__media img`, per the brief. Whoever fills
      `[data-media]` should put a single `<img>` there, with real alt text
      (or `alt=""` if a caption already carries the meaning), plus
      `loading="lazy"` and `decoding="async"` on every chapter after the first.
      The first chapter's image should be eager, so the hero is not blank.
      No wrapper element is required, and any wrapper is ignored by the motion
      rules — the transform is applied to the `img` itself.

   5. NOTHING IN THIS FILE TOUCHES `preventDefault`, wheel, touch or key events.
      If a later change to the site introduces a scroll-hijacking library, it
      will fight this engine and break the contract. Please don't.
   ========================================================================== */
