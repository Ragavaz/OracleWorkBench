/* Vantage Workbench — interface layer: theme, command palette, motion helpers */
(function () {
"use strict";
const VW = window.VW, $ = VW.$, $$ = VW.$$, esc = VW.esc;
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- theme: system by default, remembered per viewer ---------- */
const applyTheme = t => { if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; };
applyTheme(VW.store.get("theme", ""));
const isDark = () => (document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
const tbtn = $("#themeBtn");
if (tbtn) tbtn.onclick = () => { const next = isDark() ? "light" : "dark"; const go = () => { applyTheme(next); VW.store.set("theme", next); };
  if (document.startViewTransition && !calm()) document.startViewTransition(go); else go(); };

/* ---------- command palette (Ctrl K) ---------- */
const ACTIONS = [
  ["New delivery run", "Plan a requirement end to end", () => VW.go("run")],
  ["Environments", "Add or test a pod", () => VW.go("envs")],
  ["Runs and approvals", "Everything sent to a pod", () => VW.go("runs")],
  ["OIC monitor", "Errors, resubmit, activate", () => VW.go("oic")],
  ["Worklist", "Approve BPM tasks", () => VW.go("worklist")],
  ["Switch light or dark", "Change the theme", () => tbtn && tbtn.click()]
];
let pal = null, hits = [], sel = 0;
function openPalette(seed) {
  if (pal) return;
  pal = document.createElement("dialog"); pal.className = "palette";
  pal.innerHTML = '<div class="pin"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg><input id="palQ" type="search" placeholder="Search resources, recipes and studios, or type a command" aria-label="Search or run a command" autocomplete="off"><kbd>Esc</kbd></div><div class="plist" id="palList" role="listbox"></div>';
  document.body.append(pal); pal.showModal();
  const q = $("#palQ", pal); q.value = seed || ""; q.focus(); render();
  q.oninput = render;
  q.onkeydown = e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, Math.min(hits.length - 1, sel + (e.key === "ArrowDown" ? 1 : -1))); mark(); }
    if (e.key === "Enter") { e.preventDefault(); if (hits[sel]) pick(hits[sel]); }
    if (e.key === "Escape") { e.preventDefault(); pal.close(); }
  };
  pal.addEventListener("close", () => { pal.remove(); pal = null; });
  pal.addEventListener("click", e => { if (e.target === pal) pal.close(); });
}
function render() {
  const q = $("#palQ", pal).value.trim(); const ql = q.toLowerCase();
  const acts = ACTIONS.filter(a => !q || (a[0] + " " + a[1]).toLowerCase().includes(ql)).map(a => ({ type: "act", t: a[0], sub: a[1], fn: a[2] }));
  const st = (VW.STUDIOS || []).filter(s => !q || (s[1] + " " + s[2]).toLowerCase().includes(ql)).map(s => ({ type: "studio", id: s[0], t: s[1], sub: s[2] }));
  const r = q && VW.items.length ? VW.retrieve(q, { n: 8, nr: 3 }) : { items: [], recipes: [] };
  hits = (q ? [] : acts.slice(0, 4)).concat(q ? acts.slice(0, 2) : [], st.slice(0, q ? 3 : 5), r.items.map(i => ({ type: "item", id: i.id, t: i.name, sub: i.area + " · " + (VW.KIND_LABEL[i.kind] || i.kind), p: i.path })), r.recipes.map(x => ({ type: "recipe", id: x.id, t: x.title, sub: x.area + " · Cookbook" })));
  sel = 0;
  const groups = [["act", "Commands"], ["studio", "Studios"], ["item", "Catalog"], ["recipe", "Cookbook"]];
  let i = 0;
  $("#palList", pal).innerHTML = hits.length ? groups.map(([k, n]) => { const g = hits.filter(h => h.type === k); return g.length ? '<div class="pgrp">' + n + "</div>" + g.map(h => '<button role="option" data-i="' + (i = hits.indexOf(h)) + '"><span class="t">' + esc(h.t) + '</span><span class="s">' + esc(h.sub) + "</span>" + (h.p ? '<span class="p">' + esc(h.p) + "</span>" : "") + "</button>").join("") : ""; }).join("")
    : '<div class="empty">Nothing matches “' + esc(q) + '”. Try workers, invoices, erpintegrations or resubmit.</div>';
  $$("#palList button", pal).forEach(b => { b.onclick = () => pick(hits[+b.dataset.i]); b.onmousemove = () => { sel = +b.dataset.i; mark(); }; });
  mark();
}
function mark() { $$("#palList button", pal).forEach(b => b.setAttribute("aria-selected", String(+b.dataset.i === sel))); const s = $('#palList button[aria-selected="true"]', pal); if (s) s.scrollIntoView({ block: "nearest" }); }
function pick(h) { pal.close(); if (h.type === "act") h.fn(); if (h.type === "studio") VW.go(h.id); if (h.type === "item") VW.openItem(h.id); if (h.type === "recipe") VW.openRecipe(h.id); }
VW.openPalette = openPalette;
const sb = $("#searchBtn"); if (sb) sb.onclick = () => openPalette();
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); pal ? pal.close() : openPalette(); }
  if (e.key === "/" && !pal && !/input|textarea|select/i.test((document.activeElement || {}).tagName || "")) { e.preventDefault(); openPalette(); }
});

/* ---------- motion: the run ledger rail follows progress ---------- */
const obs = new MutationObserver(() => {
  const led = $(".ledger"); if (!led) return;
  const steps = $$(".step", led); const done = steps.filter(s => /\b(done|wait|work)\b/.test(s.className)).length;
  led.style.setProperty("--progress", steps.length ? Math.max(0, done - 0.5) / (steps.length - 1) : 0);
});
obs.observe(document.getElementById("sheet"), { childList: true, subtree: true });
})();
