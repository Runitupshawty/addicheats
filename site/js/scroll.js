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
   * Module state
   * ---------------------------------------------------------------------- */

  var root = document.documentElement;

  /** Cached geometry, one record per chapter: {el, top, height, seen, p}. */
  var records = [];

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
    for (var i = 0; i < found.length; i++) {
      out.push({
        el: found[i],
        top: 0,       // distance from the top of the document, in px
        height: 0,    // border-box height, in px
        seen: false,  // has `.is-seen` been applied yet?
        p: -1         // last `--p` written, so we can skip repeats
      });
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
    }

    /* ---- .is-active moves to whichever chapter fills most of the screen ---- */
    if (bestEl !== lastActiveEl) {
      if (lastActiveEl) lastActiveEl.classList.remove('is-active');
      if (bestEl) bestEl.classList.add('is-active');
      lastActiveEl = bestEl;
    }

    lastScrollY = y;
  }

  /* ---------------------------------------------------------------------- *
   * 4. The frame loop
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
   * 5. Resize handling (debounced — measuring is the expensive part)
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
   * 6. Mode: full motion
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

    mode = null;
  }

  /* ---------------------------------------------------------------------- *
   * 7. Mode: reduced motion
   * ---------------------------------------------------------------------- */

  /**
   * No rAF loop, no geometry cache, no `--p`. Every chapter is put straight
   * into its settled end state and left there; chapters.css then draws them as
   * plain static panels via its own `prefers-reduced-motion` block. Because we
   * never set `--p`, the CSS falls back to its settled default — which is
   * exactly the same state a visitor with JavaScript switched off gets.
   *
   * `.is-scrolled` still has to work, because the sticky CTA depends on it and
   * that is functionality, not decoration. We get it from an IntersectionObserver
   * watching a one-pixel sentinel parked one viewport down the page, so there is
   * no polling of any kind. If IntersectionObserver is missing we simply leave
   * the class on permanently — better a CTA that is always there than one that
   * never appears.
   */
  function startReduced() {
    mode = 'reduced';
    running = false;

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

    setupScrolledSentinel();
  }

  /** The sentinel element and its observer, so reduced mode can be torn down. */
  var sentinel = null;
  var sentinelObserver = null;

  function setupScrolledSentinel() {
    var body = document.body;
    if (!body) return;

    if (typeof window.IntersectionObserver !== 'function') {
      body.classList.add('is-scrolled');
      lastScrolledState = true;
      return;
    }

    sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.setAttribute('data-scroll-sentinel', '');
    // A one-pixel-wide strip covering exactly the first viewport, positioned
    // against the initial containing block. Absolutely positioned and hidden,
    // so it costs nothing and cannot affect layout.
    //
    // It is a full viewport tall on purpose. A single-pixel marker parked at
    // top:100vh would be wrong: an IntersectionObserver only reports when an
    // element *crosses* a threshold, and a one-pixel marker jumped clean over
    // — an anchor click, a restored scroll position — goes from "not
    // intersecting, below" to "not intersecting, above" without ever changing
    // its ratio, so no callback is delivered and the class never updates.
    // A strip that fills the first viewport is intersecting at the top of the
    // page, so any jump away from the top really is a change and really does
    // fire.
    sentinel.style.cssText =
      'position:absolute;top:0;left:0;width:1px;height:100vh;' +
      'pointer-events:none;visibility:hidden;';
    body.appendChild(sentinel);

    sentinelObserver = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        // The whole first viewport is above us => we are past it.
        var past = entries[i].boundingClientRect.bottom <= 0;
        if (past !== lastScrolledState) {
          document.body.classList.toggle('is-scrolled', past);
          lastScrolledState = past;
        }
      }
    });
    sentinelObserver.observe(sentinel);
  }

  function stopReduced() {
    if (sentinelObserver) {
      sentinelObserver.disconnect();
      sentinelObserver = null;
    }
    if (sentinel && sentinel.parentNode) {
      sentinel.parentNode.removeChild(sentinel);
    }
    sentinel = null;
    mode = null;
  }

  /* ---------------------------------------------------------------------- *
   * 8. Boot, and react to the preference changing at runtime
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

    if (wanted === 'reduced') {
      startReduced();
    } else {
      records = collect();
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
   * 9. The one global we expose
   * ---------------------------------------------------------------------- */

  /**
   * window.SiteMotion
   *   .refresh()   re-measure now (call after injecting or resizing content)
   *   .destroy()   remove every listener and stop entirely
   *   .isReduced() true when running in reduced-motion mode
   *   .mode        'motion' | 'reduced' | null
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
    },
    isReduced: prefersReduced,
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
