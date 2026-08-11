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
   *
   * These are the DEFAULT edges. The real ones are computed per chapter in
   * measure() — see `reachableScrubWindow()` for why that matters.
   */
  var VIDEO_SCRUB_IN = 0.1;
  var VIDEO_SCRUB_OUT = 0.9;

  /** Refuse to squeeze a whole clip into a narrower window of `--p` than this. */
  var VIDEO_SCRUB_MIN_SPAN = 0.25;

  /**
   * How far a completed seek may land from where it was asked to before we
   * treat it as not having happened at all. Generous — a real seek lands
   * within a frame; this is looking for "did not move", not "landed early".
   */
  var VIDEO_STALL_TOLERANCE = 0.25;

  /** That many times in a row, and the source is declared unscrubbable. */
  var VIDEO_STALL_LIMIT = 3;

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

  /**
   * Which container this browser can actually decode: 'mp4', 'webm', or ''
   * when neither. Probed once, lazily, in decodableFormat(). May be revised
   * once by onVideoError() if the probe turns out to have been optimistic.
   */
  var videoFormat = null;

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
  var lastAtQuoteState = null;

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

    // The scrub window depends on the geometry that was just measured, so it
    // is derived here too — never per frame.
    for (var j = 0; j < records.length; j++) {
      if (records[j].vid) reachableScrubWindow(records[j]);
    }

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

      /* ---- body.at-quote ----
       * True once any part of #quote is on screen. The sticky CTA is a
       * shortcut TO that section, so it becomes obstruction the moment you
       * reach it — on a phone it lands squarely on the form's own inputs.
       * Read from the same cached rect pass as everything else; no extra
       * layout work, and it stays correct without an observer. */
      var quoteEl = document.getElementById('quote');
      if (quoteEl) {
        var qr = quoteEl.getBoundingClientRect();
        var atQuote = qr.top < vh && qr.bottom > 0;
        if (atQuote !== lastAtQuoteState) {
          body.classList.toggle('at-quote', atQuote);
          lastAtQuoteState = atQuote;
        }
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
      p: 0,
      stalls: 0,        // consecutive seeks that completed without moving
      seekFrom: 0,      // playhead when the in-flight seek was issued
      seekTo: 0,        // where that seek was sent
      // The window of `--p` the clip is mapped across. Recomputed per chapter
      // in measure(); see reachableScrubWindow().
      scrubIn: VIDEO_SCRUB_IN,
      scrubOut: VIDEO_SCRUB_OUT
    };

    // The poster is also painted as the media frame's background (see
    // chapters.css), which is what guarantees "never a black box" even if the
    // element itself fails in some way we have not thought of.
    //
    // The URL is absolutised first, and that is not fussiness. A relative URL
    // inside a custom property is resolved against the stylesheet the `var()`
    // is USED in, not against the document — so `assets/video/x-poster.jpg`
    // handed straight through would be fetched as `css/assets/video/…` from
    // chapters.css and 404. Structure caught this one; it showed up as two
    // black rectangles at 1440.
    var poster = el.getAttribute('poster');
    if (poster && chapter) {
      var href = poster;
      try {
        href = new URL(poster, document.baseURI).href;
      } catch (err) { /* pre-URL browsers keep the relative form */ }
      var media = el.closest ? el.closest('.chapter__media') : null;
      (media || chapter).style.setProperty(
        '--chapter-poster', 'url("' + href.replace(/"/g, '%22') + '")'
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

  /**
   * Which container to ask for. Probed once and cached — `canPlayType` is
   * cheap but not free, and the answer cannot change mid-session.
   *
   * MP4/H.264 is preferred wherever it is supported: it has hardware decode on
   * essentially every phone and laptop shipped this decade, which for a clip
   * being seeked dozens of times a second is the difference between the fan
   * staying off and not, and Safari has no VP9 fallback worth relying on.
   * WebM/VP9 is the fallback for builds without the proprietary decoder —
   * Chromium-based browsers compiled from source, some Linux distributions'
   * packages, and the headless build these checks run under.
   *
   * `canPlayType` returns 'probably' / 'maybe' / '' — anything non-empty is
   * treated as a yes, since 'maybe' is what a browser says when it cannot know
   * without fetching, and the `error` handler covers being wrong.
   */
  function decodableFormat() {
    if (videoFormat !== null) return videoFormat;

    videoFormat = '';
    try {
      var probe = document.createElement('video');
      if (probe.canPlayType) {
        if (probe.canPlayType('video/mp4; codecs="avc1.42E01E"')) {
          videoFormat = 'mp4';
        } else if (probe.canPlayType('video/webm; codecs="vp9"') ||
                   probe.canPlayType('video/webm; codecs="vp8"')) {
          videoFormat = 'webm';
        }
      }
    } catch (err) {
      videoFormat = '';
    }
    return videoFormat;
  }

  /**
   * The URL this element should be given right now, or '' if it has none.
   * Two independent choices: the container (what this browser can decode) and
   * the rendition (what this viewport is worth). All four combinations exist
   * on disk; any that are missing simply fall through.
   */
  function pickVideoSrc(el) {
    var fmt = decodableFormat();
    // Neither container is playable: hand back nothing at all, so no request
    // is made and the poster is left in place. This is the correct outcome,
    // not a failure — see the `error` handler for the other route to it.
    if (!fmt) return '';

    var suffix = fmt === 'webm' ? '-webm' : '';
    var hd = el.getAttribute('data-src-1080' + suffix) || '';
    var sd = el.getAttribute('data-src-720' + suffix) || '';

    // Fall back to the other container if this one is not authored for this
    // element — better a file that might not decode (the poster survives it)
    // than no picture at all.
    if (!hd && !sd) {
      hd = el.getAttribute('data-src-1080') || '';
      sd = el.getAttribute('data-src-720') || '';
    }

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
    st.stalls = 0;

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
    st.stalls = 0;

    v.removeAttribute('src');
    v.preload = 'none';
    var prior = st.chapter ? st.chapter.getAttribute('data-video-state') : '';
    if (st.chapter && prior !== 'error' && prior !== 'unseekable') {
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

  /**
   * A `seeked` event is NOT proof that the position moved.
   *
   * Seeking a media element needs random access to the bytes, which over HTTP
   * means the host has to answer a Range request with a 206. A host that
   * ignores `Range` and returns the whole file with a 200 leaves the element
   * with an empty `seekable` range: assignments to `currentTime` are accepted,
   * `seeked` fires, and the position stays exactly where it was. So a naive
   * "wait for seeked, then issue the next one" loop reports perfect health
   * while the picture never changes — which is the worst kind of bug, because
   * every instrument says it is working.
   *
   * The defence is to check the outcome rather than the event. Three seeks in
   * a row that land nowhere near where they were sent and the source is
   * declared unscrubbable: the clip is dropped and the poster takes over. A
   * clean still is a perfectly respectable thing to show. A permanently frozen
   * first frame, sitting under copy that talks about movement, is not.
   */
  function onVideoSeeked(st) {
    st.seeking = false;
    var v = st.el;

    // The test is DID IT MOVE, not DID IT ARRIVE. Those are different
    // questions and only the first one is safe to ask here. Under fast
    // scrubbing this handler routinely runs for a seek whose target has
    // already been superseded twice over: the playhead is somewhere sensible
    // and travelling, just not at the newest target yet. Comparing against
    // that target flags a perfectly healthy clip as broken — which it did,
    // the first time this was written.
    //
    // So: a stall is a seek that was asked to travel a meaningful distance and
    // did not move at all. That is the signature of a source with no seekable
    // range, and nothing else produces it.
    var asked = Math.abs(st.seekTo - st.seekFrom);
    var moved = Math.abs(v.currentTime - st.seekFrom);

    if (asked > VIDEO_STALL_TOLERANCE && moved < VIDEO_FRAME_SECONDS) {
      st.stalls++;
      if (st.stalls >= VIDEO_STALL_LIMIT) {
        markUnscrubbable(st, 'seeks are completing without moving the playhead');
        return;
      }
    } else {
      st.stalls = 0;
    }

    if (st.pending >= 0) {
      var t = st.pending;
      st.pending = -1;
      seekVideo(st, t);
    }
  }

  /**
   * Give up on this source and fall back to the poster — deliberately, and
   * without pretending it is an error in the file. Used for a source that
   * cannot be seeked at all (no byte ranges, no finite duration) and for one
   * whose seeks are being silently dropped.
   */
  function markUnscrubbable(st, why) {
    st.failedSrc = st.src;
    releaseVideo(st);
    if (st.chapter) st.chapter.setAttribute('data-video-state', 'unseekable');
    if (window.console && console.info) {
      console.info('[scroll.js] ' + (st.chapter ? st.chapter.id : 'chapter') +
        ': showing the poster instead of the clip — ' + why + '. ' +
        'Scroll-scrubbed video needs a host that serves HTTP byte ranges.');
    }
  }

  /**
   * Can this element be seeked at all? `seekable` is the browser's own answer
   * to "which parts of this can I jump to", and it is empty when the source
   * cannot be range-requested. Duration has to be finite too — a live or
   * unknown-length stream has nothing to scrub across.
   */
  function isSeekable(v) {
    if (!isFinite(v.duration) || v.duration <= 0) return false;
    try {
      return !!(v.seekable && v.seekable.length > 0);
    } catch (err) {
      return false;
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

    // `canPlayType` is advisory, and browsers do get it wrong — it answers for
    // the container and codec string, not for this particular file. If the one
    // we picked turns out to be undecodable, switch containers once, globally,
    // and let every chapter retry with the other one. The URL will differ from
    // the one recorded below, so the retry is allowed exactly once per element
    // and the whole thing still terminates.
    var err = st.el.error;
    if (err && err.code === 4 && videoFormat === 'mp4') {
      videoFormat = 'webm';
    }

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

    // 1b. Not at all if the source cannot be seeked. Better to find this out
    //     before issuing anything than to discover it three dropped seeks
    //     later. `seekable` can legitimately be empty for a moment right after
    //     metadata arrives, so this only bites once buffering has started.
    if (v.readyState >= 2 && !isSeekable(v)) {
      markUnscrubbable(st, 'the source reports no seekable range');
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
    // Where it was and where it was sent, for the "did it move" test in
    // onVideoSeeked(). Recorded here because by the time `seeked` fires,
    // `st.target` may already belong to a newer request.
    st.seekFrom = v.currentTime;
    st.seekTo = t;
    try {
      v.currentTime = t;
    } catch (err) {
      st.seeking = false;
    }
  }

  /**
   * Work out the window of `--p` a chapter can actually be observed across,
   * and store it on its video state. Called from measure(), where the geometry
   * is already being read.
   *
   * WHY THIS EXISTS. `--p` runs 0 -> 1 over a chapter's full travel, but a
   * chapter cannot always travel its full range: you cannot scroll above the
   * top of the document or below the bottom. The first chapter is the obvious
   * case — at scroll 0 its top edge is already level with the top of the
   * screen, so its `--p` starts at 0.5 and never goes lower. Map its clip
   * across the nominal 0.1 -> 0.9 and the entire first half of the footage is
   * unreachable: the hero opens on frame 60 of 121 and the shot is half over
   * before the visitor has done anything.
   *
   * So the window is clamped to what is reachable. A chapter in the middle of
   * the page is unaffected (it reaches 0 and 1, so the nominal edges win); the
   * first and last chapters get a window that starts and ends where their
   * travel really does.
   */
  function reachableScrubWindow(rec) {
    var st = rec.vid;
    if (!st) return;

    var vh = viewportH;
    var span = vh + rec.height;

    // p at scroll 0, and p at the furthest the document can be scrolled.
    var pAtTop = clamp01((vh - rec.top) / span);
    var pAtEnd = clamp01((vh - (rec.top - maxScroll)) / span);

    var lo = pAtTop > VIDEO_SCRUB_IN ? pAtTop : VIDEO_SCRUB_IN;
    var hi = pAtEnd < VIDEO_SCRUB_OUT ? pAtEnd : VIDEO_SCRUB_OUT;

    // A degenerate window would make the clip fly past in a few pixels of
    // scrolling, which looks broken. Fall back to the nominal edges instead.
    if (hi - lo < VIDEO_SCRUB_MIN_SPAN) {
      lo = VIDEO_SCRUB_IN;
      hi = VIDEO_SCRUB_OUT;
    }

    st.scrubIn = lo;
    st.scrubOut = hi;
  }

  /**
   * Map this chapter's `--p` onto the clip. Strictly increasing in `p`, so
   * scrolling up runs the footage exactly backwards, and stopping stops it.
   */
  function scrubVideo(st) {
    if (!st.duration) return;
    var span = st.scrubOut - st.scrubIn;
    if (span <= 0) return;
    var q = clamp01((st.p - st.scrubIn) / span);
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

    // `.at-quote` is functionality too, for the same reason `.is-scrolled` is:
    // it retracts the sticky CTA once it would otherwise sit on top of the
    // quote form's own fields. A reduced-motion visitor must not be left
    // fighting a button covering an input.
    var quoteEl = document.getElementById('quote');
    if (quoteEl) {
      var qr = quoteEl.getBoundingClientRect();
      var atQuote = qr.top < vh && qr.bottom > 0;
      if (atQuote !== lastAtQuoteState) {
        body.classList.toggle('at-quote', atQuote);
        lastAtQuoteState = atQuote;
      }
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
          stalls: st.stalls,
          seekable: st.el.seekable ? st.el.seekable.length : 0,
          scrubIn: st.scrubIn,
          scrubOut: st.scrubOut,
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

   ---------------------------------------------------------------------------
   ROUND 2 ADDITIONS
   ---------------------------------------------------------------------------

   6. THE `<video>` MUST SHIP WITHOUT A `src` (index.html — Structure). This is
      not a style preference, it is the mechanism. Because only this file ever
      assigns one, three things are true at once: four clips never download on
      page load, a visitor with JavaScript off downloads no video at all and
      sees the `poster`, and a visitor who has asked for reduced motion is in
      exactly the same position. Adding a `src` attribute or a `<source>`
      child breaks all three simultaneously. index.html currently has this
      right; this note exists so it stays that way.

      Two attributes this file writes back onto the DOM, for chapters.css:

        `--chapter-poster` — an inline custom property on `.chapter__media`,
            holding the video's own `poster` URL, ABSOLUTISED. The absolute
            form matters: a relative URL inside a custom property resolves
            against the stylesheet the `var()` is used in, not the document,
            so `assets/video/x.jpg` would be fetched from `css/` and 404.
            (Thank you to Structure for catching that; it is fixed here now.)
        `data-video-state` — on the `.chapter`: idle / loading / ready / error.
            chapters.css hides the `<video>` outright on `error` so the poster
            is what remains.

   7. THE POSTER IS DELIBERATELY PAINTED TWICE. layout.css paints the four
      poster stills on `.chapter[data-art=…]` from the stylesheet, which needs
      no JavaScript and is therefore there before this file runs and if it
      never runs. This file publishes the same URL to `--chapter-poster` for
      chapters.css to paint on `.chapter__media`. Same image, same URL, one
      download, two independent floors under "never a black box". Keep both.

   8. IF THE FOOTAGE IS EVER RE-ENCODED, check two constants at the top of this
      file: `VIDEO_FPS` (24) sizes the seek deadband, and the clips are assumed
      to be a few seconds long and keyframed often — GOP 12 here, i.e. every
      half second. A long clip with sparse keyframes will still work but will
      feel rubbery, because every seek has to decode forward from further
      away. Shorter and more keyframes is the direction to go, not fewer.

  10. DEPLOYMENT CONSTRAINT — THE HOST MUST SERVE HTTP BYTE RANGES. This one
      belongs to whoever puts the site online, and it is the only genuinely
      external requirement the scrub has.

      Seeking a `<video>` needs random access to the file, which over HTTP
      means the server has to answer a `Range` request with `206 Partial
      Content`. A host that ignores `Range` and returns `200` with the whole
      file leaves the element with an empty `seekable` range — and then, quite
      politely, accepts every `currentTime` assignment, fires `seeked`, and
      does not move. Nothing errors. It just silently does not work.

        - Netlify, Vercel, Cloudflare Pages, GitHub Pages, S3 + CloudFront,
          nginx and Apache all serve ranges out of the box. Nothing to do.
        - Python's `http.server` does NOT. Neither does opening index.html
          from the file system on some browsers. Both are fine for checking
          layout and copy; neither can be used to judge whether the scrub
          works, and the same is true of any "quick local preview" tool.

      This file detects the condition rather than assuming it: section 4
      declines to scrub a source whose `seekable` list is empty, and treats
      three seeks that complete without moving the playhead as the same thing.
      In both cases the clip is dropped, the poster takes over, and one line is
      logged to the console explaining why. So a range-less host degrades to a
      clean still image rather than to a frozen frame — but it is a degraded
      page, and the fix is on the server, not here.

  11. `SiteMotion.videos()` returns a plain snapshot of the scrub engine — one
      row per clip with its src, readyState, currentTime, target, seek queue
      and distance from the viewport. It is there for debugging and for the
      automated checks; it copies values out rather than exposing the live
      state, so nothing outside this file can steer the engine through it.
   ========================================================================== */
