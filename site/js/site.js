/* ==========================================================================
   site.js — data renderer
   ==========================================================================
   Reads window.PROPERTY (set by data/property.js) and fills the page:

     1. Every [data-bind="dotted.path"] element gets its textContent.
     2. Floor plan tabs + panels are built into [data-plan-tabs] /
        [data-plan-panels] (accessible tabs, keyboard operable).
     3. The tour form fields are built into [data-tour-form], with
        client-side validation and a clearly-marked "not connected"
        confirmation (no backend is wired — see INTEGRATION NOTE below).
     4. [data-tour-details], [data-sticky-cta], and [data-footer] are filled.

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
      "chapters", "plans", "legal.enhancedImagery", "legal.disclaimer",
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

  /* ----------------------------------------------------------------------
     1. data-bind — fill every bound element from PROPERTY
     ---------------------------------------------------------------------- */

  const renderBinds = (P) => {
    for (const node of document.querySelectorAll("[data-bind]")) {
      const path = node.getAttribute("data-bind");
      const value = getPath(P, path);
      if (value == null) {
        console.error(`[site.js] data-bind="${path}" has no value in window.PROPERTY.`);
        continue;
      }
      // textContent only — bound values are data, never markup.
      node.textContent = String(value);
    }
  };

  /* ----------------------------------------------------------------------
     2. Floor plan tabs + panels
     ---------------------------------------------------------------------- */

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
      const bedsLabel = plan.beds === 0 ? "Studio" : `${plan.beds} bed${plan.beds === 1 ? "" : "s"}`;
      const bathsLabel = `${plan.baths} bath${plan.baths === 1 ? "" : "s"}`;

      const panel = el("div", {
        class: "plans__panel",
        role: "tabpanel",
        id: panelId,
        "aria-labelledby": tabId,
        tabindex: "0",
        hidden: !selected,
      }, [
        el("img", {
          class: "plans__art",
          src: `assets/${plan.art}.svg`,
          alt: `${plan.label} floor plan — ${plan.sqft} square feet, ${bedsLabel}, ${bathsLabel}`,
          loading: "lazy",
          width: "800",
          height: "800",
        }),
        el("div", { class: "plans__facts" }, [
          el("p", { class: "plans__spec", text: `${bedsLabel} · ${bathsLabel} · ${plan.sqft} sq ft` }),
          el("p", { class: "plans__rent", text: plan.rent }),
          el("p", { class: "plans__badge", text: plan.available }),
          el("a", { class: "plans__cta", href: "#tour", text: "Check availability" }),
        ]),
      ]);
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
        then in buildTourForm() below set
           form.action = "https://formspree.io/f/YOUR_FORM_ID";
           form.method = "POST";
        and in the submit handler REPLACE the showConfirmation()/console.log
        block (marked "PASTE ENDPOINT SUBMIT HERE") with a
        fetch(form.action, { method: "POST", body: new FormData(form),
        headers: { Accept: "application/json" } }) call.

     2. Netlify Forms (if hosting on Netlify): add the attributes
           form.setAttribute("data-netlify", "true");
           form.setAttribute("name", "tour-request");
        where the form element is configured in buildTourForm(), plus a
        hidden input named "form-name" with value "tour-request". Netlify
        intercepts the POST automatically — no endpoint URL needed.

     3. Plain mailto: fallback (zero services): in the submit handler, at
        the "PASTE ENDPOINT SUBMIT HERE" marker, build
           location.href = `mailto:${P.email}?subject=Tour request&body=` +
             encodeURIComponent(JSON.stringify(payload, null, 2));
        Crude but functional — opens the visitor's mail app pre-filled.
  */

  const renderTourForm = (P) => {
    const form = document.querySelector("[data-tour-form]");
    if (!form) {
      console.error("[site.js] [data-tour-form] not found; skipping tour form.");
      return;
    }
    form.setAttribute("novalidate", ""); // we run our own inline validation

    /** Build one labelled field row; returns { wrap, input, errorId }. */
    const field = (id, labelText, input, hint) => {
      const errorId = `${id}-error`;
      input.id = id;
      input.setAttribute("name", id);
      const wrap = el("div", { class: "tour__field" }, [
        el("label", { class: "tour__label", for: id, text: labelText }),
        input,
        el("p", { class: "tour__error", id: errorId, hidden: true, "aria-live": "polite" }),
      ]);
      if (hint) wrap.insertBefore(el("p", { class: "tour__hint", text: hint }), input);
      return { wrap, input, errorId };
    };

    /* -- name (required) ------------------------------------------------- */
    const name = field("tour-name", "Your name",
      el("input", { class: "tour__input", type: "text", required: true, autocomplete: "name" }));

    /* -- contact: phone OR email (required) ------------------------------ */
    const contact = field("tour-contact", "Phone or email",
      el("input", { class: "tour__input", type: "text", required: true, autocomplete: "email" }),
      "So we can confirm your tour time.");

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
    const movein = field("tour-movein", "Target move-in month", moveinInput,
      monthSupported ? null : "Format: YYYY-MM");

    /* -- unit type select, options from plans[] -------------------------- */
    const unitSelect = el("select", { class: "tour__input" });
    unitSelect.append(el("option", { value: "", text: "No preference" }));
    for (const plan of P.plans) {
      unitSelect.append(el("option", { value: plan.id, text: plan.label }));
    }
    const unit = field("tour-unit", "Unit type", unitSelect);

    const submit = el("button", { class: "tour__submit", type: "submit", text: P.cta.form });

    form.append(name.wrap, contact.wrap, movein.wrap, unit.wrap, submit);

    /* -- inline validation ----------------------------------------------- */
    const setError = (f, message) => {
      const errNode = document.getElementById(f.errorId);
      if (message) {
        errNode.textContent = message;
        errNode.hidden = false;
        f.input.setAttribute("aria-invalid", "true");
        f.input.setAttribute("aria-describedby", f.errorId);
      } else {
        errNode.textContent = "";
        errNode.hidden = true;
        f.input.removeAttribute("aria-invalid");
        f.input.removeAttribute("aria-describedby");
      }
    };

    form.addEventListener("submit", (e) => {
      e.preventDefault(); // static site: nothing to submit to (yet)

      const invalid = [];

      if (!name.input.value.trim()) {
        setError(name, "Please tell us your name.");
        invalid.push(name);
      } else setError(name, null);

      // Contact accepts a phone number or an email — loose sanity check only.
      const contactVal = contact.input.value.trim();
      const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactVal);
      const looksLikePhone = contactVal.replace(/[^\d]/g, "").length >= 7;
      if (!contactVal) {
        setError(contact, "Please add a phone number or email so we can reach you.");
        invalid.push(contact);
      } else if (!looksLikeEmail && !looksLikePhone) {
        setError(contact, "That doesn't look like a phone number or email — mind checking it?");
        invalid.push(contact);
      } else setError(contact, null);

      // Move-in is optional, but if filled it must be a plausible YYYY-MM.
      const moveinVal = movein.input.value.trim();
      if (moveinVal && !/^\d{4}-\d{2}$/.test(moveinVal)) {
        setError(movein, "Please use the format YYYY-MM, e.g. 2026-10.");
        invalid.push(movein);
      } else setError(movein, null);

      if (invalid.length) {
        invalid[0].input.focus();
        return;
      }

      /* -- valid: log payload + show honest confirmation ----------------- */
      const payload = {
        name: name.input.value.trim(),
        contact: contactVal,
        movein: moveinVal || null,
        unit: unit.input.value || "no-preference",
      };

      // >>> PASTE ENDPOINT SUBMIT HERE <<<
      // (See INTEGRATION NOTE above renderTourForm for Formspree /
      //  Netlify Forms / mailto: instructions. Until then we only log.)
      console.log("[site.js] Tour request (not sent — form not connected):", payload);

      const confirmation = el("div", {
        class: "tour__confirmation",
        role: "status",
        tabindex: "-1",
      }, [
        el("p", { class: "tour__confirmation-title", text: `Thanks, ${payload.name}!` }),
        el("p", {
          class: "tour__confirmation-note",
          text: "Heads up: this form is not yet connected, so your request was NOT sent. Please call or email instead:",
        }),
        el("p", { class: "tour__confirmation-contact" }, [
          el("a", { href: `tel:${telDigits(P.phone)}`, text: P.phone }),
          document.createTextNode("  ·  "),
          el("a", { href: `mailto:${P.email}`, text: P.email }),
        ]),
      ]);
      form.replaceChildren(confirmation);
      confirmation.focus();
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
        el("a", { href: `mailto:${P.email}`, text: P.email }),
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
    if (P.legal.equalHousing) {
      footer.append(el("p", {
        class: "site-footer__equal-housing",
        text: "Equal Housing Opportunity. We are pledged to the letter and spirit of U.S. policy for the achievement of equal housing opportunity throughout the nation.",
      }));
    }
    footer.append(
      el("p", { class: "site-footer__imagery", text: P.legal.enhancedImagery }),
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

/* INTEGRATION NOTE: for the Structure/Motion/CSS owners —
   site.js generates elements with these class names, in case you want to
   style them (all content is injected, none appear in index.html):
     .plans__tab .plans__panel .plans__art .plans__facts .plans__spec
     .plans__rent .plans__badge .plans__cta
     .tour__field .tour__label .tour__hint .tour__input .tour__error
     .tour__submit .tour__confirmation .tour__confirmation-title
     .tour__confirmation-note .tour__confirmation-contact
     .tour__detail (--phone/--email/--address/--hours modifiers)
     .site-footer__name .site-footer__address .site-footer__equal-housing
     .site-footer__imagery .site-footer__disclaimer
   Panels are toggled via the [hidden] attribute; error <p>s likewise.
   Please do not set `display` on [hidden] elements without keeping them hidden. */
