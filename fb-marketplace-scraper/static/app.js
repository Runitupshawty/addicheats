"use strict";

const $ = (id) => document.getElementById(id);
const form = $("search-form");
const statusEl = $("status");
const resultsEl = $("results");
const goBtn = $("go");
const fields = {
  query: $("query"),
  location: $("location"),
  min_price: $("min-price"),
  max_price: $("max-price"),
  days: $("days"),
  sort: $("sort"),
};
const PLACEHOLDERS = ["🛋️", "🔧", "📱", "🚲", "🪑", "💻", "🎸", "🍳"];
let tickTimer = null;

restore();
checkMode();
form.addEventListener("submit", onSearch);

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem("fbmp") || "{}");
    for (const k in fields) if (saved[k]) fields[k].value = saved[k];
  } catch (e) { /* stale storage — ignore */ }
  setIdle();
}

function persist() {
  const saved = {};
  for (const k in fields) saved[k] = fields[k].value;
  localStorage.setItem("fbmp", JSON.stringify(saved));
}

async function checkMode() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    if (data.demo) $("mode-badge").textContent = "· demo mode (sample data)";
  } catch (e) { /* badge is cosmetic */ }
}

function setIdle() {
  statusEl.className = "status";
  statusEl.replaceChildren(
    el("span", null, "Type what you're looking for and press Search.")
  );
}

function startLoading() {
  statusEl.className = "status";
  const line = el("span", "headline");
  line.append(el("span", "spinner"), el("span", null, "Searching Facebook Marketplace…"));
  const note = el("span", "hint", "Usually takes 15–40 seconds. The first search after starting the app is the slowest.");
  statusEl.replaceChildren(line, note);
  const started = Date.now();
  tickTimer = setInterval(() => {
    const secs = Math.round((Date.now() - started) / 1000);
    line.lastChild.textContent = `Searching Facebook Marketplace… (${secs}s)`;
  }, 1000);
}

function stopLoading() {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = null;
}

function showError(data) {
  const box = el("div", "box");
  if (data.error === "login_wall") {
    statusEl.className = "status warn";
    box.append(el("strong", null, "Facebook is asking for a login. "));
    box.append(el("span", null, "That happens in some regions or after lots of searches. Wait a bit and try again — or (for the technically inclined) save exported Facebook cookies as cookies.json in the app folder; the app will use them automatically. See README.md."));
  } else {
    statusEl.className = "status error";
    box.append(el("strong", null, "Couldn't finish that search. "));
    box.append(el("span", null, data.message || "Unknown error."));
  }
  statusEl.replaceChildren(box);
}

function render(data) {
  const listings = data.listings || [];
  if (!listings.length) {
    statusEl.className = "status";
    statusEl.replaceChildren(el("span", null,
      "Nothing found for that search. Try fewer or different words, another city spelling, or a higher max price."));
    return;
  }
  statusEl.className = "status";
  statusEl.replaceChildren(el("span", null,
    `${listings.length} listing${listings.length === 1 ? "" : "s"} — click one to open it on Facebook.`));
  resultsEl.replaceChildren(...listings.map(card));
}

function card(listing, i) {
  const a = el("a", "card");
  a.href = listing.url;
  a.target = "_blank";
  a.rel = "noopener";

  const thumb = el("div", "thumb");
  if (listing.image) {
    const img = new Image();
    img.src = listing.image;
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => {
      img.remove();
      thumb.textContent = PLACEHOLDERS[i % PLACEHOLDERS.length];
    };
    thumb.append(img);
  } else {
    thumb.textContent = PLACEHOLDERS[i % PLACEHOLDERS.length];
  }

  a.append(
    thumb,
    el("div", "price", listing.price || "—"),
    el("div", "title", listing.title || "Untitled"),
    el("div", "loc", listing.location || ""),
  );
  return a;
}

async function onSearch(ev) {
  ev.preventDefault();
  const query = fields.query.value.trim();
  if (!query) return;
  persist();

  const params = new URLSearchParams({ query, sort: fields.sort.value });
  if (fields.location.value.trim()) params.set("location", fields.location.value.trim());
  for (const k of ["min_price", "max_price", "days"]) {
    if (fields[k].value) params.set(k, fields[k].value);
  }

  goBtn.disabled = true;
  resultsEl.replaceChildren();
  startLoading();

  const ctl = new AbortController();
  const killer = setTimeout(() => ctl.abort(), 120000);
  try {
    const res = await fetch("/api/search?" + params.toString(), { signal: ctl.signal });
    const data = await res.json();
    stopLoading();
    if (data.error) showError(data);
    else render(data);
  } catch (e) {
    stopLoading();
    showError({ message: "Could not reach the app. Is its window (the black one) still open? Start it again, then retry." });
  } finally {
    clearTimeout(killer);
    goBtn.disabled = false;
  }
}
