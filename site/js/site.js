/* ==========================================================================
   site.js — data renderer
   ==========================================================================
   Reads window.PROPERTY (set by data/property.js) and fills the page:

     1. Every [data-bind="dotted.path"] element gets its textContent.
     2. Floor plan tabs + panels are built into [data-plan-tabs] /
        [data-plan-panels] (accessible tabs, keyboard operable). Each panel
        is a comparison card: name, availability, rent, size, beds/baths,
        and a "Check availability" action that pre-selects that layout on
        the tour form below.
     3. The tour form fields are built into [data-tour-form], validated on
        blur AND on submit (never before a field has been touched), with a
        clearly-marked, screen-reader-announced "not connected" confirmation
        (no backend is wired — see INTEGRATION NOTE below).
     4. [data-tour-details], [data-sticky-cta], and [data-footer] are filled,
        including the two honesty disclosures (drawings + AI video footage).

   This file only ever touches its own hooks — [data-bind], [data-plan-*],
   [data-tour-*], [data-sticky-cta], [data-footer]. It does not read, write
   or care about .chapter__media, <img> or <video> markup, so Structure and
   Motion can restructure the chapters freely without breaking rendering.

   No dependencies. Vanilla ES2020+. Loaded at end of <body>, after
   data/property.js and before js/scroll.js (see CONTRACT.md).
   ========================================================================== */

(() => {
  "use strict";

  /* ----------------------------------------------------------------------
     Data access + sanity checks
     ---------------------------------------------------------------------- */

  /** Safe dotted-path lookup: getPath(obj, "chapters.arrival.headline"). */
  const getPath = (obj, path) =>
    path.split(".").reduce(
      (node, key) => (node != null && typeof node === "object" ? node[key] : undefined),
      obj
    );

  /**
   * Verify PROPERTY exists and carries every key this renderer needs.
   * Returns true when safe to render; logs loudly and returns false if not.
   */
  const validateProperty = (P) => {
    if (!P || typeof P !== "object") {
      console.error(
        "[site.js] window.PROPERTY is missing. data/property.js must be loaded " +
          "BEFORE js/site.js (check the <script> order at the end of <body>). " +
          "Rendering aborted — the page will show its empty skeleton."
      );
      return false;
    }

    const requiredPaths = [
      "name", "tagline", "phone", "email", "hours",
      "address.line1", "address.city", "address.state", "address.zip",
      "cta.header", "cta.sticky", "cta.form",
      "chapters", "plans",
      // Honesty lines are load-bearing (see CONTRACT.md): the site must not
      // render without disclosing that the stills are drawings and the video
      // is AI-generated. Missing one is a build error, not a cosmetic nit.
      "legal.enhancedImagery", "legal.illustrativeFootage", "legal.disclaimer",
    ];
    const missing = requiredPaths.filter((p) => getPath(P, p) == null);

    // Every chapter the scroll journey expects must exist with all 3 lines.
    const chapterIds = [
      "arrival", "approach", "entrance", "living",
      "kitchen", "rest", "amenities", "neighborhood",
    ];
    if (P.chapters && typeof P.chapters === "object") {
      for (const id of chapterIds) {
        for (const field of ["eyebrow", "headline", "body"]) {
          if (getPath(P, `chapters.${id}.${field}`) == null) {
            missing.push(`chapters.${id}.${field}`);
          }
        }
      }
    }

    if (!Array.isArray(P.plans) || P.plans.length === 0) {
      missing.push("plans (must be a non-empty array)");
    } else {
      // NOTE: `note` is deliberately optional — a plan may omit it.
      P.plans.forEach((plan, i) => {
        for (const field of ["id", "label", "art", "sqft", "rent", "beds", "baths", "available"]) {
          if (plan == null || plan[field] == null) missing.push(`plans[${i}].${field}`);
        }
      });
    }

    if (missing.length) {
      console.error(
        "[site.js] window.PROPERTY is missing required keys — rendering aborted " +
          "so the page fails visibly-empty instead of half-broken. Fix these in " +
          "data/property.js:\n  - " + missing.join("\n  - ")
      );
      return false;
    }
    return true;
  };

  /* ----------------------------------------------------------------------
     Small DOM helpers
     ---------------------------------------------------------------------- */

  /** Create an element with attributes and (safe, text-only) children. */
  const el = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "text") node.textContent = String(v);
      else node.setAttribute(k, v === true ? "" : String(v));
    }
    for (const child of children) node.append(child);
    return node;
  };

  /** "[( 555) 555-0100]" -> "5555550100", for tel: hrefs. */
  const telDigits = (phone) => String(phone).replace(/[^\d+]/g, "");

  /** "[leasing@example.com]" -> "leasing@example.com", for mailto: hrefs. */
  const mailAddress = (email) => String(email).replace(/^\[|\]$/g, "").trim();

  /** "0 bed" -> "Studio"; 1 -> "1 bedroom"; 2 -> "2 bedrooms". */
  const bedsLabel = (beds) =>
    Number(beds) === 0 ? "Studio" : `${beds} bedroom${Number(beds) === 1 ? "" : "s"}`;

  const bathsLabel = (baths) =>
    `${baths} bathroom${Number(baths) === 1 ? "" : "s"}`;

  /* Cross-section hook: the floor-plan "Check availability" buttons hand the
     chosen layout to the tour form's unit <select>. renderPlans() runs before
     renderTourForm(), so the callback is registered late into this holder. */
  const tourForm = { setPreferredUnit: null };

  /* ----------------------------------------------------------------------
     1. data-bind — fill every bound element from PROPERTY
     ---------------------------------------------------------------------- */

  const renderBinds = (P) => {
    for (const node of document.querySelectorAll("[data-bind]")) {
      const path = node.getAttribute("data-bind");
      const value = getPath(P, path);
      if (value == null) {
        console.error(
          `[site.js] data-bind="${path}" has no value in window.PROPERTY. ` +
            "Either add that key to data/property.js or remove the data-bind " +
            "attribute from index.html — the element keeps its fallback text."
        );
        continue;
      }
      // textContent only — bound values are data, never markup.
      node.textContent = String(value);
    }
  };

  /* ----------------------------------------------------------------------
     2. Floor plan tabs + panels

     Panel shape (one per plan) — designed for at-a-glance comparison. The
     eye should land on rent, then size, then availability, then the action:

       figure.plans__figure
         img.plans__art
         figcaption.plans__caption          "illustrative, dimensions approx."
       div.plans__facts
         div.plans__facts-head
           h3.plans__name                   "One Bedroom"
           p.plans__badge[data-availability] "[5 available]"
         p.plans__note                      optional one-liner
         dl.plans__keyfigures               RENT and SIZE — the scan targets
         dl.plans__specs                    layout / bathrooms
         a.plans__cta                       "Check availability"
     ---------------------------------------------------------------------- */

  /** Coarse state for styling hooks: "waitlist" | "none" | "available". */
  const availabilityState = (text) => {
    const t = String(text).toLowerCase();
    if (t.includes("waitlist") || t.includes("wait list")) return "waitlist";
    if (t.includes("none") || /\b0\b/.test(t)) return "none";
    return "available";
  };

  /** One <dt>/<dd> pair wrapped in a div, as HTML permits inside a <dl>. */
  const specRow = (label, value) =>
    el("div", { class: "plans__specrow" }, [
      el("dt", { class: "plans__specrow-label", text: label }),
      el("dd", { class: "plans__specrow-value", text: value }),
    ]);

  /** A headline figure — big value + unit, e.g. Rent / [$1,550–$1,750] / per month. */
  const keyFigure = (modifier, label, valueClass, value, unit) =>
    el("div", { class: `plans__keyfigure plans__keyfigure--${modifier}` }, [
      el("dt", { class: "plans__keyfigure-label", text: label }),
      el("dd", { class: "plans__keyfigure-value" }, [
        el("span", { class: valueClass, text: value }),
        // Real whitespace between value and unit: until CSS puts the unit on
        // its own line, "[480]sq ft" would otherwise run together.
        document.createTextNode(" "),
        el("span", { class: "plans__keyfigure-unit", text: unit }),
      ]),
    ]);

  const buildPanel = (plan, panelId, tabId, selected) => {
    const beds = bedsLabel(plan.beds);
    const baths = bathsLabel(plan.baths);

    const facts = el("div", { class: "plans__facts" }, [
      el("div", { class: "plans__facts-head" }, [
        el("h3", { class: "plans__name", text: plan.label }),
        el("p", {
          class: "plans__badge",
          "data-availability": availabilityState(plan.available),
          text: plan.available,
        }),
      ]),
    ]);

    // Optional one-line differentiator, e.g. "[Corner homes, windows on two sides]".
    if (plan.note != null && String(plan.note).trim() !== "") {
      facts.append(el("p", { class: "plans__note", text: plan.note }));
    }

    facts.append(
      el("dl", { class: "plans__keyfigures" }, [
        keyFigure("rent", "Rent", "plans__rent", plan.rent, "per month"),
        keyFigure("size", "Size", "plans__size", plan.sqft, "sq ft"),
      ]),
      el("dl", { class: "plans__specs" }, [
        specRow("Layout", beds),
        specRow("Bathrooms", String(plan.baths)),
      ])
    );

    const cta = el("a", {
      class: "plans__cta",
      href: "#tour",
      "data-plan-cta": plan.id,
      "aria-label": `Check availability for the ${plan.label} layout`,
      text: "Check availability",
    });
    // Clicking a plan's CTA carries that choice down to the tour form.
    cta.addEventListener("click", () => {
      if (typeof tourForm.setPreferredUnit === "function") {
        tourForm.setPreferredUnit(plan.id);
      }
    });
    facts.append(cta);

    return el("div", {
      class: "plans__panel",
      role: "tabpanel",
      id: panelId,
      "data-plan": plan.id,
      "aria-labelledby": tabId,
      tabindex: "0",
      hidden: !selected,
    }, [
      el("figure", { class: "plans__figure" }, [
        el("img", {
          class: "plans__art",
          src: `assets/${plan.art}.svg`,
          alt: `${plan.label} floor plan — ${beds}, ${baths}, ${plan.sqft} square feet.`,
          loading: "lazy",
          decoding: "async",
          width: "800",
          height: "800",
        }),
        // <small> is the right element for a side note, and it also keeps the
        // caption visually quiet until layout.css gives .plans__caption a size.
        el("figcaption", { class: "plans__caption" }, [
          el("small", {
            class: "plans__caption-text",
            text: "Illustrative drawing — not to scale.",
          }),
        ]),
      ]),
      facts,
    ]);
  };

  const renderPlans = (P) => {
    const tablist = document.querySelector("[data-plan-tabs]");
    const panelHost = document.querySelector("[data-plan-panels]");
    if (!tablist || !panelHost) {
      console.error("[site.js] [data-plan-tabs] / [data-plan-panels] not found; skipping floor plans.");
      return;
    }

    tablist.setAttribute("role", "tablist");
    tablist.setAttribute("aria-label", "Floor plans");

    const tabs = [];
    const panels = [];

    P.plans.forEach((plan, i) => {
      const tabId = `plan-tab-${plan.id}`;
      const panelId = `plan-panel-${plan.id}`;
      const selected = i === 0; // first plan shown by default

      /* -- tab button ---------------------------------------------------- */
      const tab = el("button", {
        class: "plans__tab",
        type: "button",
        role: "tab",
        id: tabId,
        "aria-selected": selected ? "true" : "false",
        "aria-controls": panelId,
        tabindex: selected ? "0" : "-1",
        text: plan.label,
      });
      tabs.push(tab);
      tablist.append(tab);

      /* -- panel --------------------------------------------------------- */
      const panel = buildPanel(plan, panelId, tabId, selected);
      panels.push(panel);
      panelHost.append(panel);
    });

    /* -- selection + keyboard support ------------------------------------ */
    const select = (index, focus = false) => {
      tabs.forEach((tab, i) => {
        const on = i === index;
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.tabIndex = on ? 0 : -1;
        panels[i].hidden = !on;
      });
      if (focus) tabs[index].focus();
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => select(i));
      // Roving tabindex: Left/Right cycle, Home/End jump. Selection follows focus.
      tab.addEventListener("keydown", (e) => {
        const last = tabs.length - 1;
        let to = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") to = i === last ? 0 : i + 1;
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") to = i === 0 ? last : i - 1;
        else if (e.key === "Home") to = 0;
        else if (e.key === "End") to = last;
        if (to !== null) {
          e.preventDefault();
          select(to, true);
        }
      });
    });
  };

  /* ----------------------------------------------------------------------
     3. Tour form
     ---------------------------------------------------------------------- */

  /* INTEGRATION NOTE: connecting this form to a real backend.
     The form currently goes nowhere on purpose (static site, no server).
     Three easy ways to wire it up, simplest first:

     1. Formspree (free tier, no server): create a form at formspree.io,
        then in renderTourForm() below set
           form.action = "https://formspree.io/f/YOUR_FORM_ID";
           form.method = "POST";
        and in the submit handler REPLACE the showConfirmation()/console.log
        block (marked "PASTE ENDPOINT SUBMIT HERE") with a
        fetch(form.action, { method: "POST", body: new FormData(form),
        headers: { Accept: "application/json" } }) call.

     2. Netlify Forms (if hosting on Netlify): add the attributes
           form.setAttribute("data-netlify", "true");
           form.setAttribute("name", "tour-request");
        where the form element is configured in renderTourForm(), plus a
        hidden input named "form-name" with value "tour-request". Netlify
        intercepts the POST automatically — no endpoint URL needed.

     3. Plain mailto: fallback (zero services): in the submit handler, at
        the "PASTE ENDPOINT SUBMIT HERE" marker, build
           location.href = `mailto:${P.email}?subject=Tour request&body=` +
             encodeURIComponent(JSON.stringify(payload, null, 2));
        Crude but functional — opens the visitor's mail app pre-filled.

     WHICHEVER you pick: delete the "not connected" wording from
     showConfirmation() at the same time. Leaving it in place after the form
     really does send is worse than having no confirmation at all.
  */

  const renderTourForm = (P) => {
    const form = document.querySelector("[data-tour-form]");
    if (!form) {
      console.error("[site.js] [data-tour-form] not found; skipping tour form.");
      return;
    }
    form.setAttribute("novalidate", ""); // we run our own inline validation

    /* -- field factory ---------------------------------------------------
       DOM order is label → hint → input → error. layout.css relies on that
       order (it re-orders visually with grid-row); do not shuffle it.       */
    const fields = [];

    const field = (id, labelText, input, hint, validate) => {
      const errorId = `${id}-error`;
      input.id = id;
      input.setAttribute("name", id);

      const errorNode = el("p", {
        class: "tour__error",
        id: errorId,
        hidden: true,
      });

      const wrap = el("div", { class: "tour__field" }, [
        el("label", { class: "tour__label", for: id, text: labelText }),
      ]);
      if (hint) wrap.append(el("p", { class: "tour__hint", id: `${id}-hint`, text: hint }));
      wrap.append(input, errorNode);

      const f = {
        id,
        input,
        errorNode,
        errorId,
        hintId: hint ? `${id}-hint` : null,
        wrap,
        validate: validate || (() => null),
        touched: false,
        message: null,
      };
      // Link the hint immediately so it is announced from the first focus,
      // not only once an error has forced aria-describedby into existence.
      describedBy(f);
      fields.push(f);
      return f;
    };

    /** Point aria-describedby at the hint and/or the error, whichever exist. */
    const describedBy = (f) => {
      const ids = [];
      if (f.message) ids.push(f.errorId);
      if (f.hintId) ids.push(f.hintId);
      if (ids.length) f.input.setAttribute("aria-describedby", ids.join(" "));
      else f.input.removeAttribute("aria-describedby");
    };

    const setError = (f, message) => {
      f.message = message || null;
      if (f.message) {
        f.errorNode.textContent = f.message;
        f.errorNode.hidden = false;
        f.input.setAttribute("aria-invalid", "true");
      } else {
        f.errorNode.textContent = "";
        f.errorNode.hidden = true;
        f.input.removeAttribute("aria-invalid");
      }
      describedBy(f);
    };

    /** Run a field's validator and paint the result. Returns true if valid. */
    const check = (f) => {
      const message = f.validate(f.input.value);
      setError(f, message);
      return !message;
    };

    /* -- name (required) ------------------------------------------------- */
    const name = field(
      "tour-name",
      "Your name",
      el("input", { class: "tour__input", type: "text", required: true, autocomplete: "name" }),
      null,
      (raw) => (raw.trim() ? null : "Please add your name so we know who to expect.")
    );

    /* -- contact: phone OR email (required) ------------------------------
       One field on purpose — asking for both is friction. The error message
       has to say precisely what is wrong with what they typed, because "one
       field, two formats" is exactly where vague errors leave people stuck. */
    const contact = field(
      "tour-contact",
      "Phone or email",
      el("input", { class: "tour__input", type: "text", required: true, autocomplete: "email" }),
      "Either is fine — whichever is easier to reach you on.",
      (raw) => {
        const value = raw.trim();
        if (!value) {
          return "Please add a phone number or an email address so we can confirm a time.";
        }
        const digits = value.replace(/\D/g, "").length;
        const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
        if (looksLikeEmail) return null;
        if (digits >= 7 && !value.includes("@")) return null;

        if (value.includes("@")) {
          return "That email address looks incomplete — it needs a name before the @ " +
            "and a domain after it, like you@example.com.";
        }
        if (digits > 0) {
          return `That phone number looks too short — we counted ${digits} digit${digits === 1 ? "" : "s"} ` +
            "and need at least 7, like (555) 555-0100.";
        }
        return "This doesn't look like a phone number or an email address. Enter a " +
          "phone number like (555) 555-0100, or an email like you@example.com.";
      }
    );

    /* -- move-in month, with graceful fallback --------------------------- */
    // <input type="month"> is not supported everywhere (notably desktop
    // Safari/Firefox degrade it to a plain text box). Probe for support and
    // fall back to a text input with an explicit format hint.
    const monthProbe = document.createElement("input");
    monthProbe.setAttribute("type", "month");
    const monthSupported = monthProbe.type === "month";
    const moveinInput = monthSupported
      ? el("input", { class: "tour__input", type: "month" })
      : el("input", { class: "tour__input", type: "text", placeholder: "e.g. 2026-10", pattern: "\\d{4}-\\d{2}" });
    const movein = field(
      "tour-movein",
      "Target move-in month",
      moveinInput,
      monthSupported ? "Optional." : "Optional. Format: YYYY-MM, e.g. 2026-10.",
      (raw) => {
        const value = raw.trim();
        if (!value) return null; // optional
        return /^\d{4}-\d{2}$/.test(value)
          ? null
          : "Please use the format YYYY-MM, e.g. 2026-10.";
      }
    );

    /* -- unit type select, options from plans[] -------------------------- */
    const unitSelect = el("select", { class: "tour__input" });
    unitSelect.append(el("option", { value: "", text: "No preference" }));
    for (const plan of P.plans) {
      unitSelect.append(el("option", { value: plan.id, text: plan.label }));
    }
    const unit = field("tour-unit", "Unit type", unitSelect, null, () => null);

    // Floor-plan "Check availability" buttons land here.
    tourForm.setPreferredUnit = (planId) => {
      if (!unitSelect.isConnected) return; // form already replaced by the confirmation
      const match = Array.from(unitSelect.options).some((o) => o.value === planId);
      if (match) unitSelect.value = planId;
    };

    const submit = el("button", { class: "tour__submit", type: "submit", text: P.cta.form });

    form.append(name.wrap, contact.wrap, movein.wrap, unit.wrap, submit);

    /* Clicking "Request a Tour" straight out of a field fires that field's
       blur FIRST. If we painted its error there and then, the error line
       would appear, push the submit button down, and the mouseup would land
       on empty space — the click is swallowed and the visitor's press does
       nothing. So while a press on the submit button is in flight we skip
       blur-time painting and let the submit handler do all of it at once.
       `relatedTarget` covers keyboard/Chromium; the pointer flag covers
       Safari, which does not focus buttons on click. */
    let submitPressActive = false;
    submit.addEventListener("pointerdown", () => { submitPressActive = true; });
    const clearSubmitPress = () => { window.setTimeout(() => { submitPressActive = false; }, 0); };
    submit.addEventListener("pointerup", clearSubmitPress);
    submit.addEventListener("pointercancel", clearSubmitPress);
    window.addEventListener("pointerup", clearSubmitPress);

    /* -- when validation runs --------------------------------------------
       - on blur, once a field has been touched (never while it is empty and
         untouched — nobody wants to be told off for a field they haven't
         reached yet);
       - on input, ONLY to clear an error the visitor has now fixed. Typing
         never raises a new error mid-word;
       - on submit, for everything.                                          */
    for (const f of fields) {
      f.input.addEventListener("blur", (e) => {
        f.touched = true; // touched even if we defer the message
        if (submitPressActive || e.relatedTarget === submit) return;
        check(f);
      });
      f.input.addEventListener("input", () => {
        if (f.touched && f.message && !f.validate(f.input.value)) setError(f, null);
      });
      // <select> fires change rather than input for keyboard/mouse choices.
      f.input.addEventListener("change", () => {
        if (f.touched) check(f);
      });
    }

    /* -- the honest, announced confirmation ------------------------------- */
    const showConfirmation = (payload) => {
      const tel = telDigits(P.phone);
      const mail = mailAddress(P.email);
      const mailtoHref =
        `mailto:${mail}` +
        `?subject=${encodeURIComponent(`Tour request — ${payload.name}`)}` +
        `&body=${encodeURIComponent(
          [
            `Name: ${payload.name}`,
            `Phone or email: ${payload.contact}`,
            `Target move-in: ${payload.movein || "flexible"}`,
            `Layout of interest: ${payload.unitLabel}`,
            "",
            "Preferred tour times:",
          ].join("\n")
        )}`;

      /* Insert the live region FIRST and empty, then fill it a beat later.
         Screen readers announce changes *inside* an existing live region;
         a region that arrives pre-populated is often missed entirely. */
      const live = el("div", {
        class: "tour__confirmation",
        role: "status",
        "aria-live": "polite",
        "aria-atomic": "true",
        tabindex: "-1",
      });
      form.replaceChildren(live);

      window.setTimeout(() => {
        live.append(
          el("p", {
            class: "tour__confirmation-title",
            text: `Thanks, ${payload.name} — but your request was not sent.`,
          }),
          el("p", {
            class: "tour__confirmation-note",
            text:
              "This tour form is not connected to anything yet: there is no inbox, " +
              "no booking system and no server behind it, so nothing was delivered " +
              "and nobody was notified. To actually reach the leasing office, call " +
              "or email — both go to a real person.",
          }),
          el("p", { class: "tour__confirmation-contact" }, [
            el("a", { class: "tour__confirmation-tel", href: `tel:${tel}`, text: P.phone }),
            document.createTextNode("  ·  "),
            el("a", { class: "tour__confirmation-mail", href: mailtoHref, text: P.email }),
          ]),
          el("p", {
            class: "tour__confirmation-hours",
            text: `Leasing office hours: ${P.hours}. The email link above is already ` +
              "filled in with everything you just typed.",
          })
        );
        live.focus();
      }, 60);
    };

    /* -- submit ------------------------------------------------------------ */
    form.addEventListener("submit", (e) => {
      e.preventDefault(); // static site: nothing to submit to (yet)

      // Submitting counts as touching every field.
      const invalid = [];
      for (const f of fields) {
        f.touched = true;
        if (!check(f)) invalid.push(f);
      }
      if (invalid.length) {
        invalid[0].input.focus();
        return;
      }

      const selectedOption = unitSelect.options[unitSelect.selectedIndex];
      const payload = {
        name: name.input.value.trim(),
        contact: contact.input.value.trim(),
        movein: movein.input.value.trim() || null,
        unit: unitSelect.value || "no-preference",
        unitLabel: selectedOption ? selectedOption.textContent : "No preference",
      };

      // >>> PASTE ENDPOINT SUBMIT HERE <<<
      // (See INTEGRATION NOTE above renderTourForm for Formspree /
      //  Netlify Forms / mailto: instructions. Until then we only log.)
      console.log("[site.js] Tour request (not sent — form not connected):", payload);

      showConfirmation(payload);
    });
  };

  /* ----------------------------------------------------------------------
     4. Tour details, sticky CTA, footer
     ---------------------------------------------------------------------- */

  const renderTourDetails = (P) => {
    const host = document.querySelector("[data-tour-details]");
    if (!host) {
      console.error("[site.js] [data-tour-details] not found; skipping.");
      return;
    }
    const addressLine = `${P.address.line1}, ${P.address.city}, ${P.address.state} ${P.address.zip}`;
    host.append(
      el("p", { class: "tour__detail tour__detail--phone" }, [
        el("a", { href: `tel:${telDigits(P.phone)}`, text: P.phone }),
      ]),
      el("p", { class: "tour__detail tour__detail--email" }, [
        el("a", { href: `mailto:${mailAddress(P.email)}`, text: P.email }),
      ]),
      el("p", { class: "tour__detail tour__detail--address", text: addressLine }),
      el("p", { class: "tour__detail tour__detail--hours", text: P.hours })
    );
  };

  const renderStickyCta = (P) => {
    const cta = document.querySelector("[data-sticky-cta]");
    if (!cta) {
      console.error("[site.js] [data-sticky-cta] not found; skipping.");
      return;
    }
    cta.textContent = P.cta.sticky;
  };

  const renderFooter = (P) => {
    const footer = document.querySelector("[data-footer]");
    if (!footer) {
      console.error("[site.js] [data-footer] not found; skipping.");
      return;
    }
    const addressLine = `${P.address.line1}, ${P.address.city}, ${P.address.state} ${P.address.zip}`;
    footer.append(
      el("p", { class: "site-footer__name", text: P.name }),
      el("p", { class: "site-footer__address", text: addressLine })
    );

    /* -- imagery disclosure ------------------------------------------------
       Deliberately its own headed block at body size, ABOVE the fine print,
       rather than a grey line lost among the legal boilerplate. A visitor
       has just watched four video chapters; they are owed a plain statement
       that none of it is this building. */
    const honestyTitleId = "footer-imagery-disclosure";
    footer.append(
      el("section", {
        class: "site-footer__honesty",
        "aria-labelledby": honestyTitleId,
      }, [
        el("p", {
          class: "site-footer__honesty-title",
          id: honestyTitleId,
          text: "About the imagery on this page",
        }),
        el("ul", { class: "site-footer__honesty-list" }, [
          el("li", {
            class: "site-footer__honesty-item site-footer__honesty-item--footage",
            text: P.legal.illustrativeFootage,
          }),
          el("li", {
            class: "site-footer__honesty-item site-footer__honesty-item--stills",
            text: P.legal.enhancedImagery,
          }),
        ]),
      ])
    );

    if (P.legal.equalHousing) {
      footer.append(el("p", {
        class: "site-footer__equal-housing",
        text: "Equal Housing Opportunity. We are pledged to the letter and spirit of U.S. policy for the achievement of equal housing opportunity throughout the nation.",
      }));
    }
    footer.append(
      el("p", { class: "site-footer__disclaimer", text: P.legal.disclaimer })
    );
  };

  /* ----------------------------------------------------------------------
     Boot — run once the DOM is parsed (script sits at end of <body>, but
     guard anyway so load order changes can't break rendering).
     ---------------------------------------------------------------------- */

  const boot = () => {
    const P = window.PROPERTY;
    if (!validateProperty(P)) return; // fail loud, render nothing broken

    renderBinds(P);
    renderPlans(P);
    renderTourForm(P);
    renderTourDetails(P);
    renderStickyCta(P);
    renderFooter(P);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

/* ============================================================================
   INTEGRATION NOTE: for the Structure / Motion / CSS owners
   ============================================================================

   A. CLASS NAMES site.js EMITS. All of this markup is injected — none of it
      appears in index.html. Round 2 restructured the floor-plan panel and the
      footer; NEW names are marked (new), removed ones are listed at the end.

      Floor plans — one panel per plan, inside [data-plan-panels]:
        .plans__tab                       tab <button>
        .plans__panel                     role=tabpanel, carries data-plan="<id>"
          figure.plans__figure            (new) wraps the drawing + its caption
            img.plans__art
            figcaption.plans__caption     (new) "Illustrative drawing — not to scale."
              small.plans__caption-text   (new)
          div.plans__facts                the detail column
            div.plans__facts-head         (new) plan name + availability badge
              h3.plans__name              (new) e.g. "One Bedroom"
              p.plans__badge              carries data-availability=
                                          "available" | "waitlist" | "none" (new attr)
            p.plans__note                 (new) OPTIONAL — absent when plans[].note is
            dl.plans__keyfigures          (new) the two scan targets
              div.plans__keyfigure                 (new)
                  .plans__keyfigure--rent          (new)
                  .plans__keyfigure--size          (new)
                dt.plans__keyfigure-label          (new) "Rent" / "Size"
                dd.plans__keyfigure-value          (new)
                  span.plans__rent                 e.g. "[$1,550–$1,750]"
                  span.plans__size                 (new) e.g. "[680]"
                  span.plans__keyfigure-unit       (new) "per month" / "sq ft"
            dl.plans__specs               (new) layout / bathrooms
              div.plans__specrow          (new)
                dt.plans__specrow-label   (new)
                dd.plans__specrow-value   (new)
            a.plans__cta                  carries data-plan-cta="<id>"

      REMOVED in round 2: `.plans__spec` (the old single "STUDIO · 1 BATH ·
      [480] SQ FT" line). Its rule in layout.css is now dead — note that
      `.plans__specrow*` is a DIFFERENT element and must not inherit the old
      uppercase/muted treatment wholesale, or the dd values will shout.

      Tour form (unchanged names, same DOM order label → hint → input → error):
        .tour__field .tour__label .tour__hint .tour__input .tour__error
        .tour__submit
        .tour__confirmation  (role=status, aria-live=polite, tabindex=-1)
          .tour__confirmation-title
          .tour__confirmation-note
          .tour__confirmation-contact  > a.tour__confirmation-tel (new)
                                       > a.tour__confirmation-mail (new)
          .tour__confirmation-hours    (new)

      Leasing details / footer:
        .tour__detail (--phone / --email / --address / --hours)
        .site-footer__name .site-footer__address
        section.site-footer__honesty           (new)
          p.site-footer__honesty-title         (new)
          ul.site-footer__honesty-list         (new)
            li.site-footer__honesty-item       (new)
               .site-footer__honesty-item--footage  (new)
               .site-footer__honesty-item--stills   (new)
        .site-footer__equal-housing .site-footer__disclaimer

      REMOVED in round 2: `.site-footer__imagery`. The imagery disclosure now
      lives in the .site-footer__honesty block above, deliberately at body
      size rather than the --step--2 secondary treatment the old class had.
      Per CONTRACT.md the AI-footage disclosure is load-bearing; please do not
      restyle it back down into the fine print.

   B. STYLING ASKS (small, all in layout.css):
      1. `.plans__facts-head` — put `.plans__name` and `.plans__badge` on one
         baseline (flex, gap, align-items: baseline, flex-wrap: wrap). They
         currently stack.
      2. `.plans__badge` — its `color` currently loses to `.plans__panels p`
         (0,1,1 beats 0,1,0), so the badge renders muted grey rather than
         brass. Bump it to `.plans__panels .plans__badge` or move it after.
      3. `.plans__keyfigures` — two columns from ~34rem so rent and size sit
         side by side; `.plans__rent` stays the largest thing in the column
         and `.plans__size` wants roughly --step-2.
      4. `.plans__keyfigure-unit` — small, muted, and set on its own line (or
         inline with a small gap) under the value.
      5. `.plans__panel` at ≥48rem is `minmax(0,5fr) minmax(0,4fr)` with
         `align-items: center`; with the denser detail column, `align-items:
         start` now reads better and stops the art floating.
      6. `.plans__art` is clipped at the bottom on some viewports (round 2
         defect #5) — it is `aspect-ratio: 1/1; object-fit: contain`, so the
         clipping is coming from the panel row height, not from site.js.
      7. `.plans__caption` — quiet muted caption tucked under the drawing
         (--step--2 / --c-muted). It ships inside a <small> so it is already
         subdued if you do nothing.
      8. `.site-footer__honesty-item` HAS NO MEASURE LIMIT and currently runs
         the full 1440px width — the one thing still hurting these two lines.
         Please give the block `max-inline-size: 68ch` (matching
         `.site-footer__equal-housing`) and keep it at footer body size, not
         --step--2.
      9. `.site-footer__honesty-title` and `.tour__confirmation-title` both
         want a little weight (--fw-medium, or letterspaced caps for the
         footer one) — right now each is visually identical to the body text
         beneath it.

   C. PER-CHAPTER HONESTY LABELS. data/property.js now carries two ready-made
      strings so the wording stays in one place. Bind them like any other copy
      and site.js fills them for free:
        legal.footageLabel  -> the 4 VIDEO chapters (arrival, approach,
                               living, kitchen)
        legal.artLabel      -> the 4 SVG chapters (entrance, rest, amenities,
                               neighborhood)
      e.g. <p class="chapter__disclosure" data-bind="legal.footageLabel">
             Illustrative footage — not the actual property</p>
      Keep the fallback text inside the element so it survives JS being off.

   D. STATE TOGGLING. Plan panels and field errors are hidden with the
      [hidden] attribute. Do not set `display` on them without keeping them
      hidden. `.tour__form [role="status"]:empty { display: none }` is load-
      bearing: the confirmation is inserted empty and populated ~60ms later
      so screen readers announce it.

   E. site.js READS NO CHAPTER MARKUP. It never queries .chapter__media,
      <img> or <video>. Adding the four <video> elements, full-bleed media or
      overlaid copy cannot break this renderer.
   ============================================================================ */
