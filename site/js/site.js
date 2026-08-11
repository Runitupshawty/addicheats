/* ==========================================================================
   site.js — data renderer
   ==========================================================================
   Reads window.COMPANY (set by data/company.js) and fills the page:

     1. Every [data-bind="dotted.path"] element gets its textContent.
     2. services[] is rendered into [data-services] — one card per service,
        each with its concrete deliverables.
     3. why[] is rendered into [data-why] — the differentiators, with an
        optional bracketed stat pulled out large.
     4. pricing.model / pricing.tiers / pricing.notes are rendered into
        [data-pricing-model], [data-pricing-tiers] and [data-pricing-notes].
     5. The quote request form is built into [data-quote-form], validated on
        blur AND on submit (never before a field has been touched), with a
        clearly-marked, screen-reader-announced "not connected" confirmation
        (no backend is wired — see INTEGRATION NOTE below).
     6. [data-quote-details], [data-sticky-cta] and [data-footer] are filled,
        including the imagery honesty disclosure.

   THIS SITE SELLS MANAGEMENT SERVICES TO PROPERTY OWNERS. Nothing on it is
   for rent. If you are adding copy here rather than in data/company.js, you
   are almost certainly in the wrong file.

   This file only ever touches its own hooks — [data-bind], [data-services],
   [data-why], [data-pricing-*], [data-quote-*], [data-sticky-cta] and
   [data-footer]. It does not read, write or care about .chapter__media,
   <img> or <video> markup, so Structure and Motion can restructure the
   chapters freely without breaking rendering.

   No dependencies. Vanilla ES2020+. Loaded at the end of <body>, after
   data/company.js and before js/scroll.js (see CONTRACT-v3.md).
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

  /** The eight chapters the scroll journey expects. Ids are fixed — Motion's
      engine and the video wiring key off them (CONTRACT-v3.md §walkthrough). */
  const CHAPTER_IDS = [
    "arrival", "approach", "entrance", "living",
    "kitchen", "rest", "amenities", "neighborhood",
  ];

  /** The seven quote-form fields whose copy lives in company.js. */
  const QUOTE_FIELD_KEYS = [
    "name", "contact", "propertyAddress", "units",
    "propertyType", "situation", "message",
  ];

  /**
   * Verify COMPANY exists and carries every key this renderer needs.
   * Returns true when safe to render; logs loudly and returns false if not.
   * Fails whole rather than half: a page that renders three of five sections
   * looks finished and is not, which is the worst of both outcomes.
   */
  const validateCompany = (C) => {
    if (!C || typeof C !== "object") {
      console.error(
        "[site.js] window.COMPANY is missing. data/company.js must be loaded " +
          "BEFORE js/site.js (check the <script> order at the end of <body>; " +
          "note that data/property.js was renamed to data/company.js and " +
          "window.PROPERTY became window.COMPANY in v3). " +
          "Rendering aborted — the page will show its empty skeleton."
      );
      return false;
    }

    const requiredPaths = [
      "name", "tagline", "serviceArea", "phone", "email", "hours",
      "address.line1", "address.city", "address.state", "address.zip",
      "cta.header", "cta.sticky", "cta.form",
      "chapters", "services", "why",
      "pricing.model", "pricing.tiers", "pricing.notes",
      "quote.intro", "quote.fields", "quote.situations", "quote.propertyTypes",
      // Honesty lines are load-bearing (CONTRACT-v3.md §Non-negotiables): the
      // site must not render without disclosing that the footage is AI-generated
      // and depicts no property under management. Implying a portfolio you do
      // not manage is a false claim about the business. Missing one of these is
      // a build error, not a cosmetic nit.
      "legal.footageLabel", "legal.artLabel", "legal.imagery", "legal.disclaimer",
    ];
    const missing = requiredPaths.filter((p) => getPath(C, p) == null);

    /* -- chapters: all eight, all three lines each ----------------------- */
    if (C.chapters && typeof C.chapters === "object") {
      for (const id of CHAPTER_IDS) {
        for (const field of ["eyebrow", "headline", "body"]) {
          if (getPath(C, `chapters.${id}.${field}`) == null) {
            missing.push(`chapters.${id}.${field}`);
          }
        }
      }
    }

    /* -- services -------------------------------------------------------- */
    if (!Array.isArray(C.services) || C.services.length === 0) {
      missing.push("services (must be a non-empty array)");
    } else {
      C.services.forEach((s, i) => {
        for (const field of ["id", "title", "body"]) {
          if (s == null || s[field] == null) missing.push(`services[${i}].${field}`);
        }
        if (s == null || !Array.isArray(s.items) || s.items.length === 0) {
          missing.push(`services[${i}].items (must be a non-empty array)`);
        }
      });
    }

    /* -- why: `stat` is deliberately optional ---------------------------- */
    if (!Array.isArray(C.why) || C.why.length === 0) {
      missing.push("why (must be a non-empty array)");
    } else {
      C.why.forEach((w, i) => {
        for (const field of ["id", "title", "body"]) {
          if (w == null || w[field] == null) missing.push(`why[${i}].${field}`);
        }
      });
    }

    /* -- pricing tiers: `badge` is deliberately optional ------------------ */
    if (!Array.isArray(C.pricing && C.pricing.tiers) || C.pricing.tiers.length === 0) {
      missing.push("pricing.tiers (must be a non-empty array)");
    } else {
      C.pricing.tiers.forEach((t, i) => {
        for (const field of ["id", "name", "rate", "rateNote", "summary"]) {
          if (t == null || t[field] == null) missing.push(`pricing.tiers[${i}].${field}`);
        }
        if (t == null || !Array.isArray(t.includes) || t.includes.length === 0) {
          missing.push(`pricing.tiers[${i}].includes (must be a non-empty array)`);
        }
      });
    }
    if (C.pricing && C.pricing.notes != null && !Array.isArray(C.pricing.notes)) {
      missing.push("pricing.notes (must be an array of strings)");
    }

    /* -- quote form copy -------------------------------------------------- */
    if (C.quote && C.quote.fields && typeof C.quote.fields === "object") {
      for (const key of QUOTE_FIELD_KEYS) {
        // `hint` is optional per field; `label` never is — an unlabelled
        // input is an accessibility failure, not a styling choice.
        if (getPath(C, `quote.fields.${key}.label`) == null) {
          missing.push(`quote.fields.${key}.label`);
        }
      }
    }
    for (const key of ["situations", "propertyTypes"]) {
      const list = getPath(C, `quote.${key}`);
      if (list != null && (!Array.isArray(list) || list.length === 0)) {
        missing.push(`quote.${key} (must be a non-empty array)`);
      }
    }

    if (missing.length) {
      console.error(
        "[site.js] window.COMPANY is missing required keys — rendering aborted " +
          "so the page fails visibly-empty instead of half-broken. Fix these in " +
          "data/company.js:\n  - " + missing.join("\n  - ")
      );
      return false;
    }

    /* -- soft check: exactly one featured tier ---------------------------
       Not fatal (the page still renders, just without a highlighted tier or
       with two), so this warns rather than aborting. */
    const featured = C.pricing.tiers.filter((t) => t.featured === true).length;
    if (featured !== 1) {
      console.warn(
        `[site.js] pricing.tiers has ${featured} tiers with featured:true — ` +
          "the design expects exactly one. Set featured:true on the plan you " +
          "want drawn largest and featured:false on the others (data/company.js)."
      );
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

  /** "[(555) 555-0100]" -> "5555550100", for tel: hrefs. */
  const telDigits = (phone) => String(phone).replace(/[^\d+]/g, "");

  /** "[owners@example.com]" -> "owners@example.com", for mailto: hrefs. */
  const mailAddress = (email) => String(email).replace(/^\[|\]$/g, "").trim();

  /** "[123 EXAMPLE ST], [CITY], [ST] [00000]" */
  const addressLine = (C) =>
    `${C.address.line1}, ${C.address.city}, ${C.address.state} ${C.address.zip}`;

  /**
   * Is this copy already claimed by markup? Structure may bind a value
   * directly in index.html with data-bind; when it has, site.js stands down
   * rather than printing the same sentence twice.
   */
  const boundInMarkup = (path, root = document) =>
    root.querySelector(`[data-bind="${path}"]`) != null;

  /** Find a hook, or log which one is missing and return null. */
  const hook = (selector, what) => {
    const node = document.querySelector(selector);
    if (!node) {
      console.error(`[site.js] ${selector} not found; skipping ${what}.`);
      return null;
    }
    return node;
  };

  /* ----------------------------------------------------------------------
     1. data-bind — fill every bound element from COMPANY
     ---------------------------------------------------------------------- */

  const renderBinds = (C) => {
    for (const node of document.querySelectorAll("[data-bind]")) {
      const path = node.getAttribute("data-bind");
      const value = getPath(C, path);
      if (value == null) {
        console.error(
          `[site.js] data-bind="${path}" has no value in window.COMPANY. ` +
            "Either add that key to data/company.js or remove the data-bind " +
            "attribute from index.html — the element keeps its fallback text."
        );
        continue;
      }
      // textContent only — bound values are data, never markup.
      node.textContent = String(value);
    }
  };

  /* ----------------------------------------------------------------------
     2. Services

     One card per service. The eye should land on the service name, then the
     one-line reason, then the deliverables — which are the part an owner
     comparing two managers actually reads.

       article.services__item[data-service="<id>"]
         h3.services__name
         p.services__body
         ul.services__list
           li.services__list-item                (one per deliverable)
     ---------------------------------------------------------------------- */

  const renderServices = (C) => {
    const host = hook("[data-services]", "services");
    if (!host) return;

    for (const service of C.services) {
      host.append(
        el("article", { class: "services__item", "data-service": service.id }, [
          el("h3", { class: "services__name", text: service.title }),
          el("p", { class: "services__body", text: service.body }),
          el(
            "ul",
            { class: "services__list" },
            service.items.map((item) =>
              el("li", { class: "services__list-item", text: item })
            )
          ),
        ])
      );
    }
  };

  /* ----------------------------------------------------------------------
     3. Why owners choose us

       article.why__item[data-why="<id>"]
         p.why__stat                             OPTIONAL — absent when the
                                                 entry has no `stat`
         h3.why__name
         p.why__body

     The stat is decorative emphasis on a number that is repeated in the
     body, so it is marked aria-hidden: a screen reader hearing "[24 hrs]"
     immediately followed by "…within [24 hours]…" is being read the same
     fact twice with no way to tell they are the same fact.
     ---------------------------------------------------------------------- */

  const renderWhy = (C) => {
    const host = hook("[data-why]", "why-owners-choose-us");
    if (!host) return;

    for (const reason of C.why) {
      const item = el("article", { class: "why__item", "data-why": reason.id });

      if (reason.stat != null && String(reason.stat).trim() !== "") {
        item.append(
          el("p", { class: "why__stat", "aria-hidden": "true", text: reason.stat })
        );
      }
      item.append(
        el("h3", { class: "why__name", text: reason.title }),
        el("p", { class: "why__body", text: reason.body })
      );
      host.append(item);
    }
  };

  /* ----------------------------------------------------------------------
     4. Pricing — model paragraph, three tiers, fine print

       [data-pricing-model]  > p.pricing__model-text
       [data-pricing-tiers]  > article.pricing__tier[data-tier="<id>"]
                                 (data-featured on the highlighted one)
                                 p.pricing__badge          featured only
                                 h3.pricing__tier-name
                                 p.pricing__rate
                                   span.pricing__rate-value
                                   span.pricing__rate-note
                                 p.pricing__summary
                                 ul.pricing__includes
                                   li.pricing__includes-item
       [data-pricing-notes]  > ul.pricing__notes-list
                                 li.pricing__notes-item
     ---------------------------------------------------------------------- */

  /** Default label on the highlighted tier when a tier sets no `badge`. */
  const FEATURED_BADGE_FALLBACK = "Recommended";

  const buildTier = (tier) => {
    const featured = tier.featured === true;

    const article = el("article", {
      class: featured ? "pricing__tier pricing__tier--featured" : "pricing__tier",
      "data-tier": tier.id,
      "data-featured": featured ? "true" : null,
    });

    if (featured) {
      article.append(
        el("p", {
          class: "pricing__badge",
          text: tier.badge != null && String(tier.badge).trim() !== ""
            ? tier.badge
            : FEATURED_BADGE_FALLBACK,
        })
      );
    }

    article.append(
      el("h3", { class: "pricing__tier-name", text: tier.name }),
      el("p", { class: "pricing__rate" }, [
        el("span", { class: "pricing__rate-value", text: tier.rate }),
        // Real whitespace between the rate and its note: until CSS puts the
        // note on its own line, "[8%]of monthly rent" would run together.
        document.createTextNode(" "),
        el("span", { class: "pricing__rate-note", text: tier.rateNote }),
      ]),
      el("p", { class: "pricing__summary", text: tier.summary }),
      el(
        "ul",
        { class: "pricing__includes" },
        tier.includes.map((line) =>
          el("li", { class: "pricing__includes-item", text: line })
        )
      )
    );

    return article;
  };

  const renderPricing = (C) => {
    const modelHost = hook("[data-pricing-model]", "the pricing model paragraph");
    if (modelHost) {
      modelHost.append(
        el("p", { class: "pricing__model-text", text: C.pricing.model })
      );
    }

    const tierHost = hook("[data-pricing-tiers]", "pricing tiers");
    if (tierHost) {
      for (const tier of C.pricing.tiers) tierHost.append(buildTier(tier));
    }

    const notesHost = hook("[data-pricing-notes]", "pricing notes");
    if (notesHost && Array.isArray(C.pricing.notes) && C.pricing.notes.length) {
      notesHost.append(
        el(
          "ul",
          { class: "pricing__notes-list" },
          C.pricing.notes.map((note) =>
            el("li", { class: "pricing__notes-item", text: note })
          )
        )
      );
    }
  };

  /* ----------------------------------------------------------------------
     5. Quote request form
     ---------------------------------------------------------------------- */

  /* INTEGRATION NOTE: connecting this form to a real backend.
     The form currently goes nowhere on purpose (static site, no server).
     Three easy ways to wire it up, simplest first:

     1. Formspree (free tier, no server): create a form at formspree.io,
        then in renderQuoteForm() below set
           form.action = "https://formspree.io/f/YOUR_FORM_ID";
           form.method = "POST";
        and in the submit handler REPLACE the showConfirmation()/console.log
        block (marked "PASTE ENDPOINT SUBMIT HERE") with a
        fetch(form.action, { method: "POST", body: new FormData(form),
        headers: { Accept: "application/json" } }) call.

     2. Netlify Forms (if hosting on Netlify): add the attributes
           form.setAttribute("data-netlify", "true");
           form.setAttribute("name", "quote-request");
        where the form element is configured in renderQuoteForm(), plus a
        hidden input named "form-name" with value "quote-request". Netlify
        intercepts the POST automatically — no endpoint URL needed.

     3. Plain mailto: fallback (zero services): in the submit handler, at
        the "PASTE ENDPOINT SUBMIT HERE" marker, build
           location.href = `mailto:${C.email}?subject=Quote request&body=` +
             encodeURIComponent(JSON.stringify(payload, null, 2));
        Crude but functional — opens the visitor's mail app pre-filled.
        (showConfirmation() already builds exactly this href for its link,
        so you can lift `mailtoHref` straight out of it.)

     WHICHEVER you pick: delete the "not connected" wording from
     showConfirmation() at the same time. Leaving it in place after the form
     really does send is worse than having no confirmation at all.
  */

  /* A form-ergonomics ceiling, not a business limit — above this a unit
     count is far more likely to be a typo than a portfolio, and either way
     the answer is "talk to a person". */
  const MAX_UNITS = 5000;

  const renderQuoteForm = (C) => {
    const form = hook("[data-quote-form]", "the quote form");
    if (!form) return;

    form.setAttribute("novalidate", ""); // we run our own inline validation

    /* Expectation-setting copy above the fields — but only as a fallback.
       index.html normally carries quote.intro in the section header with
       data-bind, and when it does, renderBinds has already filled it and we
       must not print the sentence twice. NOTE the class is
       `quote__intro-text`, not `quote__intro`: index.html uses `.quote__intro`
       for the section-header wrapper, and reusing it here would silently
       inherit that block's layout. */
    if (!boundInMarkup("quote.intro")) {
      form.append(el("p", { class: "quote__intro-text", text: C.quote.intro }));
    }

    /* -- field factory ---------------------------------------------------
       DOM order is label → hint → input → error. layout.css relies on that
       order (it may re-order visually with grid-row); do not shuffle it.   */
    const fields = [];
    const copy = C.quote.fields;

    const field = (id, key, input, validate, { required = false } = {}) => {
      const errorId = `${id}-error`;
      const labelText = copy[key].label;
      const hint = copy[key].hint;

      input.id = id;
      input.setAttribute("name", id);
      if (required) input.setAttribute("required", "");

      const errorNode = el("p", { class: "quote__error", id: errorId, hidden: true });

      const wrap = el("div", { class: "quote__field", "data-field": key }, [
        el("label", { class: "quote__label", for: id, text: labelText }),
      ]);
      if (hint) {
        wrap.append(el("p", { class: "quote__hint", id: `${id}-hint`, text: hint }));
      }
      wrap.append(input, errorNode);

      const f = {
        id,
        key,
        label: labelText,
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

    /** Point aria-describedby at the error and/or the hint, whichever exist. */
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
      const message = f.validate(f.input.value, f.input);
      setError(f, message);
      return !message;
    };

    /* -- name (required) -------------------------------------------------- */
    const name = field(
      "quote-name",
      "name",
      el("input", { class: "quote__input", type: "text", autocomplete: "name" }),
      (raw) => (raw.trim() ? null : "Please add your name so we know who the quote is for."),
      { required: true }
    );

    /* -- contact: phone OR email (required) -------------------------------
       One field on purpose — asking for both is friction. The error message
       has to say precisely what is wrong with what they typed, because "one
       field, two formats" is exactly where vague errors leave people stuck. */
    const contact = field(
      "quote-contact",
      "contact",
      el("input", { class: "quote__input", type: "text", autocomplete: "email" }),
      (raw) => {
        const value = raw.trim();
        if (!value) {
          return "Please add a phone number or an email address so we can send the quote back.";
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
      },
      { required: true }
    );

    /* -- property address (required) --------------------------------------
       Deliberately NOT autocomplete="street-address": this is the building's
       address, not the visitor's, and browsers would happily fill in their
       home. A wrong address quietly is worse than an empty one loudly. */
    const propertyAddress = field(
      "quote-address",
      "propertyAddress",
      el("input", { class: "quote__input", type: "text", autocomplete: "off" }),
      (raw) => {
        const value = raw.trim();
        if (!value) {
          return "Please add the property address so we know which building we are quoting.";
        }
        if (value.length < 6) {
          return "That looks too short for an address — the street and the city is " +
            "enough, like 120 Example St, Springfield.";
        }
        return null;
      },
      { required: true }
    );

    /* -- number of units (required) ---------------------------------------
       type="number" empties its own value when the content is not numeric,
       so "abc" and "" are indistinguishable from .value alone. validity
       .badInput is what tells them apart, and it is the difference between
       "please enter a number" and "please fill this in". */
    const units = field(
      "quote-units",
      "units",
      el("input", {
        class: "quote__input quote__input--number",
        type: "number",
        min: "1",
        step: "1",
        inputmode: "numeric",
      }),
      (raw, input) => {
        if (input.validity && input.validity.badInput) {
          return "Please enter the unit count as a number, like 12.";
        }
        const value = raw.trim();
        if (!value) {
          return "Please tell us how many units the property has. Enter 1 for a single house.";
        }
        const n = Number(value);
        if (!Number.isFinite(n)) {
          return "Please enter the unit count as a number, like 12.";
        }
        if (!Number.isInteger(n)) {
          return "Please enter a whole number of units — 12 rather than 12.5.";
        }
        if (n < 1) {
          return "A property has at least one unit — please enter 1 or more.";
        }
        if (n > MAX_UNITS) {
          return `That is a larger portfolio than this form handles well. Call ${C.phone} ` +
            "and we will scope it properly.";
        }
        return null;
      },
      { required: true }
    );

    /* -- property type (optional select) ---------------------------------- */
    const typeSelect = el("select", { class: "quote__input quote__input--select" });
    typeSelect.append(el("option", { value: "", text: "Choose one" }));
    for (const type of C.quote.propertyTypes) {
      typeSelect.append(el("option", { value: type, text: type }));
    }
    const propertyType = field("quote-type", "propertyType", typeSelect, () => null);

    /* -- current situation (optional select) ------------------------------ */
    const situationSelect = el("select", { class: "quote__input quote__input--select" });
    situationSelect.append(el("option", { value: "", text: "Choose one" }));
    for (const situation of C.quote.situations) {
      situationSelect.append(el("option", { value: situation, text: situation }));
    }
    const situation = field("quote-situation", "situation", situationSelect, () => null);

    /* -- message (optional) ------------------------------------------------ */
    const message = field(
      "quote-message",
      "message",
      el("textarea", { class: "quote__input quote__input--textarea", rows: "4" }),
      () => null
    );

    const submit = el("button", { class: "quote__submit", type: "submit", text: C.cta.form });

    form.append(
      name.wrap,
      contact.wrap,
      propertyAddress.wrap,
      units.wrap,
      propertyType.wrap,
      situation.wrap,
      message.wrap,
      submit
    );

    /* Clicking "Request My Quote" straight out of a field fires that field's
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
        if (f.touched && f.message && !f.validate(f.input.value, f.input)) setError(f, null);
      });
      // <select> fires change rather than input for keyboard/mouse choices.
      f.input.addEventListener("change", () => {
        if (f.touched) check(f);
      });
    }

    /* -- the honest, announced confirmation ------------------------------- */
    const showConfirmation = (payload) => {
      const tel = telDigits(C.phone);
      const mail = mailAddress(C.email);
      const mailtoHref =
        `mailto:${mail}` +
        `?subject=${encodeURIComponent(`Management quote request — ${payload.propertyAddress}`)}` +
        `&body=${encodeURIComponent(
          [
            `Name: ${payload.name}`,
            `Phone or email: ${payload.contact}`,
            `Property address: ${payload.propertyAddress}`,
            `Number of units: ${payload.units}`,
            `Property type: ${payload.propertyType}`,
            `Where they are today: ${payload.situation}`,
            "",
            "Notes:",
            payload.message || "(none)",
          ].join("\n")
        )}`;

      /* Insert the live region FIRST and empty, then fill it a beat later.
         Screen readers announce changes *inside* an existing live region;
         a region that arrives pre-populated is often missed entirely. */
      const live = el("div", {
        class: "quote__confirmation",
        role: "status",
        "aria-live": "polite",
        "aria-atomic": "true",
        tabindex: "-1",
      });
      form.replaceChildren(live);

      window.setTimeout(() => {
        live.append(
          el("p", {
            class: "quote__confirmation-title",
            text: `Thanks, ${payload.name} — but your request was not sent.`,
          }),
          el("p", {
            class: "quote__confirmation-note",
            text:
              "This quote form is not connected to anything yet: there is no inbox, " +
              "no CRM and no server behind it, so nothing was delivered and nobody " +
              "was notified. To actually reach us, call or email — both go to a " +
              "real person.",
          }),
          el("p", { class: "quote__confirmation-contact" }, [
            el("a", { class: "quote__confirmation-tel", href: `tel:${tel}`, text: C.phone }),
            document.createTextNode("  ·  "),
            el("a", { class: "quote__confirmation-mail", href: mailtoHref, text: C.email }),
          ]),
          el("p", {
            class: "quote__confirmation-hours",
            text: `Office hours: ${C.hours}. The email link above is already filled in ` +
              "with everything you just typed.",
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

      const payload = {
        name: name.input.value.trim(),
        contact: contact.input.value.trim(),
        propertyAddress: propertyAddress.input.value.trim(),
        units: units.input.value.trim(),
        propertyType: propertyType.input.value || "Not specified",
        situation: situation.input.value || "Not specified",
        message: message.input.value.trim() || null,
      };

      // >>> PASTE ENDPOINT SUBMIT HERE <<<
      // (See INTEGRATION NOTE above renderQuoteForm for Formspree /
      //  Netlify Forms / mailto: instructions. Until then we only log.)
      console.log("[site.js] Quote request (not sent — form not connected):", payload);

      showConfirmation(payload);
    });
  };

  /* ----------------------------------------------------------------------
     6. Quote details, sticky CTA, footer
     ---------------------------------------------------------------------- */

  const renderQuoteDetails = (C) => {
    const host = hook("[data-quote-details]", "the quote contact details");
    if (!host) return;

    host.append(
      el("p", { class: "quote__detail quote__detail--phone" }, [
        el("a", { href: `tel:${telDigits(C.phone)}`, text: C.phone }),
      ]),
      el("p", { class: "quote__detail quote__detail--email" }, [
        el("a", { href: `mailto:${mailAddress(C.email)}`, text: C.email }),
      ]),
      el("p", { class: "quote__detail quote__detail--hours", text: C.hours }),
      el("p", {
        class: "quote__detail quote__detail--area",
        text: `Managing property across ${C.serviceArea}.`,
      }),
      el("p", { class: "quote__detail quote__detail--address", text: addressLine(C) })
    );
  };

  const renderStickyCta = (C) => {
    const cta = hook("[data-sticky-cta]", "the sticky call to action");
    if (!cta) return;
    // If Structure bound it in markup, renderBinds already filled it.
    if (cta.hasAttribute("data-bind")) return;
    cta.textContent = C.cta.sticky;
  };

  const renderFooter = (C) => {
    const footer = hook("[data-footer]", "the footer");
    if (!footer) return;

    if (!boundInMarkup("name", footer)) {
      footer.append(el("p", { class: "site-footer__name", text: C.name }));
    }
    footer.append(el("p", { class: "site-footer__address", text: addressLine(C) }));

    /* -- imagery disclosure ------------------------------------------------
       Deliberately its own headed block at body size, ABOVE the fine print,
       rather than a grey line lost among the legal boilerplate. An owner has
       just scrolled eight chapters of a building; they are owed a plain
       statement that none of it is a property this company manages. On a
       leasing site that would be a disclosure about a photograph. Here it is
       a disclosure about the business — a portfolio implied is a portfolio
       claimed. Skipped only if index.html already binds legal.imagery
       itself, so the explanation can never be printed twice or omitted. */
    if (!boundInMarkup("legal.imagery")) {
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
          el("p", {
            class: "site-footer__honesty-body",
            text: C.legal.imagery,
          }),
        ])
      );
    }

    if (C.legal.equalHousing) {
      footer.append(el("p", {
        class: "site-footer__equal-housing",
        text: "Equal Housing Opportunity. We are pledged to the letter and spirit of " +
          "U.S. policy for the achievement of equal housing opportunity throughout the nation.",
      }));
    }

    footer.append(
      el("p", { class: "site-footer__disclaimer", text: C.legal.disclaimer })
    );
  };

  /* ----------------------------------------------------------------------
     Boot — run once the DOM is parsed (script sits at end of <body>, but
     guard anyway so load order changes can't break rendering).
     ---------------------------------------------------------------------- */

  const boot = () => {
    const C = window.COMPANY;
    if (!validateCompany(C)) return; // fail loud, render nothing broken

    renderBinds(C);
    renderServices(C);
    renderWhy(C);
    renderPricing(C);
    renderQuoteForm(C);
    renderQuoteDetails(C);
    renderStickyCta(C);
    renderFooter(C);
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

   A. WHAT CHANGED IN v3. data/property.js is gone; data/company.js replaces
      it and sets window.COMPANY. index.html must load
        <script src="data/company.js"></script>
      before js/site.js. The old floor-plan and tour renderers are deleted —
      [data-plan-tabs], [data-plan-panels], [data-tour-form] and
      [data-tour-details] are no longer read by anything, and every
      .plans__* / .tour__* rule in layout.css is now dead.

   B. HOOKS site.js READS. All of these come from index.html; site.js creates
      none of them and errors clearly (naming the selector) if one is absent.
        [data-bind="dotted.path"]   any element, filled with textContent
        [data-services]             services cards land here
        [data-why]                  differentiator cards land here
        [data-pricing-model]        one paragraph
        [data-pricing-tiers]        three tier cards
        [data-pricing-notes]        the fine-print list
        [data-quote-form]           <form>, fields are built into it
        [data-quote-details]        phone / email / hours / area / address
        [data-sticky-cta]           text only (skipped if it has data-bind)
        [data-footer]               name, address, honesty block, fine print

   C. CLASS NAMES site.js EMITS. None of this markup is in index.html — it is
      all injected, so these are the selectors layout.css needs.

      Services — inside [data-services]:
        article.services__item        carries data-service="<id>"
          h3.services__name
          p.services__body
          ul.services__list
            li.services__list-item

      Why — inside [data-why]:
        article.why__item             carries data-why="<id>"
          p.why__stat                 OPTIONAL (absent when why[].stat is);
                                      aria-hidden, because the same number is
                                      spelled out in the body beneath it
          h3.why__name
          p.why__body

      Pricing:
        [data-pricing-model] > p.pricing__model-text
        [data-pricing-tiers] > article.pricing__tier
                                 .pricing__tier--featured  on the one tier
                                 data-tier="<id>"
                                 data-featured="true"      featured only
              p.pricing__badge          featured only, e.g. "[Most owners start here]"
              h3.pricing__tier-name
              p.pricing__rate
                span.pricing__rate-value   the big number, e.g. "[10%]"
                span.pricing__rate-note    "of monthly rent collected"
              p.pricing__summary
              ul.pricing__includes
                li.pricing__includes-item
        [data-pricing-notes] > ul.pricing__notes-list
                                 li.pricing__notes-item

      Quote form (DOM order per field is label → hint → input → error):
        p.quote__intro-text           fallback only — emitted ONLY when
                                      index.html does not bind quote.intro
                                      itself. Deliberately NOT `.quote__intro`,
                                      which index.html already uses for the
                                      section-header wrapper.
        div.quote__field              carries data-field="name" | "contact" |
                                      "propertyAddress" | "units" |
                                      "propertyType" | "situation" | "message"
          label.quote__label
          p.quote__hint               OPTIONAL (absent when the field has no hint)
          input.quote__input          + .quote__input--number on units
          select.quote__input.quote__input--select
          textarea.quote__input.quote__input--textarea
          p.quote__error              [hidden] until it has something to say
        button.quote__submit
        div.quote__confirmation       role=status, aria-live=polite, tabindex=-1
          p.quote__confirmation-title
          p.quote__confirmation-note
          p.quote__confirmation-contact > a.quote__confirmation-tel
                                        > a.quote__confirmation-mail
          p.quote__confirmation-hours

      Quote details / footer:
        p.quote__detail (--phone / --email / --hours / --area / --address)
        p.site-footer__name           skipped if the footer already binds `name`
        p.site-footer__address
        section.site-footer__honesty  skipped if index.html binds legal.imagery
          p.site-footer__honesty-title
          p.site-footer__honesty-body
        p.site-footer__equal-housing
        p.site-footer__disclaimer

   D. STYLING ASKS — measured against layout.css as it stood at 05:47, after
      Structure had already landed the .services__/.why__/.pricing__/.quote__
      rules. Everything else in this file rendered correctly and legibly at
      1440x900 and 390x844, and every element site.js emits was measured at
      ≥5.0:1 contrast in both. Only these two are outstanding:

      1. `.site-footer__honesty-body` has NO measure limit and currently runs
         the full 1440px — three very long lines. Please give it
         `max-inline-size: 68ch`, matching `.site-footer__equal-housing`.
      2. `.site-footer__honesty-body` renders at --step--1 (13.7px desktop /
         13.0px mobile) against a 17.5px/16.0px page body. It is correctly
         lifted above the --step--2 fine print (11.7px) and its contrast is
         16.6:1, so this is a nudge rather than a defect — but CONTRACT-v3.md
         asks for this disclosure "at readable body size", and one step up
         would settle it.
      3. Cosmetic: `.quote__confirmation-title` is visually identical to the
         paragraph beneath it. A little weight (--fw-medium) would let
         "your request was not sent" land as the headline it is.

      Already handled by layout.css, listed only so they are not lost in a
      later refactor: `.pricing__badge` is absolutely positioned as a tab over
      the featured card (looks right — note it overflows the tier's box, so
      `overflow: hidden` on `.pricing__tiers` would clip it); the units field
      is correctly narrowed; `.quote__input--textarea` resizes; error borders
      key off `[aria-invalid]` on all four required fields.

   E. STATE TOGGLING. Field errors are hidden with the [hidden] attribute. Do
      not set `display` on `.quote__error` without keeping [hidden] winning.
      `.quote__form [role="status"]:empty { display: none }` is load-bearing:
      the confirmation is inserted EMPTY and populated ~60ms later so screen
      readers announce it, and an empty box would flash first otherwise.

   F. site.js READS NO CHAPTER MARKUP. It never queries .chapter__media,
      <img> or <video>. Adding the four <video> elements, full-bleed media or
      overlaid copy cannot break this renderer.

   G. JS-OFF FALLBACK IS index.html's JOB, and index.html already does it —
      verified with JavaScript disabled: all 8 chapters visible, 3 tel: links
      and 3 mailto: links reachable, the #quote noscript block prefilling the
      same fields this form collects. Recorded here only so the dependency is
      not accidentally deleted: site.js BUILDS the quote form, so without
      JavaScript there is no form at all and that noscript block is the only
      route to a quote request.
   ============================================================================ */
