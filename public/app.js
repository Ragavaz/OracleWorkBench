/* Vantage Workbench — core: data, router, search, home, catalog, cookbook, roadmap */
(function () {
"use strict";
const VW = window.VW = { data: {}, items: [], recipes: [], views: {}, cache: {}, caps: {} };
const $ = VW.$ = (s, r) => (r || document).querySelector(s);
const $$ = VW.$$ = (s, r) => [...(r || document).querySelectorAll(s)];
const esc = VW.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
VW.AREAS = [
  { id: "HCM", file: "data/hcm.json", name: "HCM", long: "Fusion Cloud HCM" },
  { id: "ERP", file: "data/erp.json", name: "ERP / SCM", long: "Financials, Procurement, SCM" },
  { id: "OIC", file: "data/oic.json", name: "OIC", long: "Oracle Integration 3" },
  { id: "OCI", file: "data/oci.json", name: "OCI", long: "Oracle Cloud Infrastructure" },
  { id: "VBS", file: "data/vbs.json", name: "VBS / Redwood", long: "Visual Builder Studio, Redwood, Groovy" }
];
const KIND_LABEL = VW.KIND_LABEL = { rest: "REST", soap: "SOAP", hdl: "HDL", fbdi: "FBDI", formula: "Fast Formula", sql: "SQL", extract: "Extract", atom: "Atom feed", oic: "OIC", oci: "OCI", vbs: "VBS", groovy: "Groovy", xslt: "XPath/XSLT", concept: "Concept", ess: "ESS job", bip: "BI Publisher" };

/* ---------- small helpers ---------- */
const ICON = VW.ICON = {
  home: '<path d="M2.5 7.5L8 3l5.5 4.5V13a.5.5 0 0 1-.5.5H9.5v-4h-3v4H3a.5.5 0 0 1-.5-.5z"/>',
  run: '<path d="M3 3h10M3 8h6M3 13h10"/><circle cx="12" cy="8" r="1.5"/>',
  catalog: '<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M2.5 6h11M6 6v7.5"/>',
  cookbook: '<path d="M3 2.5h8.5a1 1 0 0 1 1 1v10H4a1 1 0 0 1-1-1z"/><path d="M5.5 5.5h4.5M5.5 8h4.5"/>',
  rest: '<path d="M5 4L1.5 8 5 12M11 4l3.5 4-3.5 4M9.5 3l-3 10"/>',
  soap: '<path d="M2.5 4.5h11v7h-11z"/><path d="M2.5 4.5L8 9l5.5-4.5"/>',
  hdl: '<path d="M4 2.5h5.5L12 5v8.5H4z"/><path d="M6 8h4M6 10.5h4M9.5 2.5V5H12"/>',
  fbdi: '<path d="M2.5 3.5h11v9h-11z"/><path d="M2.5 7h11M6 3.5v9M10 3.5v9"/>',
  formula: '<path d="M10.5 2.5c-1.5 0-2 1-2.3 2.5L7 12c-.3 1.4-.8 1.5-2 1.5M5 6.5h5"/>',
  xslt: '<path d="M3 3l4 5-4 5M8.5 13h5"/>',
  redwood: '<path d="M8 2l5 9H3z"/><path d="M8 11v3"/>',
  utils: '<circle cx="8" cy="8" r="2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>',
  assistant: '<path d="M2.5 3.5h11v7H7l-3 2.5v-2.5H2.5z"/>',
  roadmap: '<path d="M2.5 13.5V2.5M2.5 3h9l-1.5 2.5L11.5 8h-9"/>',
  copy: '<rect x="5.5" y="5.5" width="8" height="8" rx="1"/><path d="M10.5 5.5v-3h-8v8h3"/>',
  down: '<path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10"/>',
  envs: '<rect x="2.5" y="3" width="11" height="4" rx="1"/><rect x="2.5" y="9" width="11" height="4" rx="1"/><path d="M5 5h.01M5 11h.01"/>',
  runs: '<path d="M3 4h10M3 8h10M3 12h6"/><path d="M11.5 10.5l1.5 1.5 2-3"/>',
  loads: '<path d="M8 2.5v8M4.5 7L8 10.5 11.5 7"/><path d="M2.5 13.5h11"/>',
  erpjobs: '<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M5 10.5V8M8 10.5V5.5M11 10.5V7"/>',
  oic: '<circle cx="4" cy="8" r="1.8"/><circle cx="12" cy="4.5" r="1.8"/><circle cx="12" cy="11.5" r="1.8"/><path d="M5.7 7.2l4.6-2M5.7 8.8l4.6 2"/>',
  worklist: '<path d="M4 3.5h8M4 8h8M4 12.5h5"/><path d="M2 3.5h.01M2 8h.01M2 12.5h.01"/>',
  theme: '<path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z"/>',
  check: '<path d="M3.5 8.5l3 3 6-7"/>',
  ext: '<path d="M9 2.5h4.5V7M13.5 2.5L7.5 8.5M11.5 9.5v4h-9v-9h4"/>'
};
VW.icon = (n, cls) => '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (cls ? ' class="' + cls + '"' : "") + ">" + (ICON[n] || "") + "</svg>";

let toastT;
VW.toast = msg => { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2400); };
VW.copy = (text, btn) => {
  const done = ok => { VW.toast(ok ? "Copied" : "Copy was blocked. Select the text and press Ctrl+C."); };
  try { navigator.clipboard.writeText(text).then(() => done(true), () => done(false)); } catch (_) { done(false); }
};
VW.store = {
  get(k, d) { try { const v = localStorage.getItem("vw2." + k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem("vw2." + k, JSON.stringify(v)); return true; } catch (_) { return false; } }
};
VW.uid = (p) => (p || "RUN") + "-" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
VW.fmtDate = d => new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/* syntax tint: strings, keywords, comments — deliberately light */
VW.hl = (code, lang) => {
  let h = esc(code);
  if (/json/.test(lang)) return h.replace(/(&quot;[^&]*?&quot;)(\s*:)/g, '<span class="k">$1</span>$2').replace(/:\s*(&quot;[^&]*?&quot;)/g, ': <span class="s">$1</span>');
  if (/xml|xsl|soap|html/.test(lang)) return h.replace(/(&lt;\/?)([\w:.-]+)/g, '$1<span class="k">$2</span>').replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="d">$1</span>');
  if (/hdl|dat/.test(lang)) return h.replace(/^(METADATA|MERGE|DELETE|SET|COMMENT)\b/gm, '<span class="k">$1</span>');
  h = h.replace(/^(\s*(#|\/\/|--).*)$/gm, '<span class="d">$1</span>');
  if (/http/.test(lang)) h = h.replace(/^(GET|POST|PATCH|PUT|DELETE)\b/gm, '<span class="k">$1</span>');
  return h;
};
VW.codeBlock = (code, lang, title, opts) => {
  opts = opts || {};
  const id = "cb" + Math.random().toString(36).slice(2, 8);
  VW.cache[id] = { code, lang, title, file: opts.file };
  return '<div class="code"><div class="bar2"><span>' + esc(title || lang || "code") + '</span><span class="acts">' +
    '<button class="btn ghost sm" data-copy="' + id + '">' + VW.icon("copy") + "Copy</button>" +
    (opts.file ? '<button class="btn ghost sm" data-save="' + id + '">' + VW.icon("down") + "Save</button>" : "") +
    (opts.ask ? '<button class="btn ghost sm" data-askcode="' + id + '">Review with assistant</button>' : "") +
    '</span></div><pre id="' + id + '">' + VW.hl(code, lang || "") + "</pre></div>";
};
document.addEventListener("click", e => {
  const c = e.target.closest("[data-copy]"); if (c) { const b = VW.cache[c.dataset.copy]; if (b) VW.copy(b.code); return; }
  const s = e.target.closest("[data-save]"); if (s) { const b = VW.cache[s.dataset.save]; if (b) VW.save(b.file, b.code); return; }
  const a = e.target.closest("[data-askcode]"); if (a) { const b = VW.cache[a.dataset.askcode]; if (b) VW.askAssistant("Review this " + (b.title || b.lang) + ". Check syntax, Oracle-specific mistakes and anything likely to fail, then suggest fixes.\n\n```\n" + b.code + "\n```"); }
});

/* downloads capability, with a visible fallback */
VW.save = async (filename, data) => {
  const dl = VW.caps.downloads;
  if (!dl) { VW.toast("Saving files works when this page is opened in Claude. Use Copy instead."); return false; }
  try { await dl.save({ filename, data }); VW.toast("Saved " + filename); return true; }
  catch (e) {
    const m = { declined: "Save cancelled.", rejected_extension: "This file type cannot be saved here. Use Copy.", rate_limited: "A save is already open. Try again in a moment." };
    VW.toast(m[e && e.code] || "The file could not be saved. Use Copy instead."); return false;
  }
};
VW.zip = async (files) => {
  if (!window.JSZip) throw new Error("Zip library did not load");
  const z = new JSZip();
  files.forEach(f => z.file(f.name, f.content, f.base64 ? { base64: true } : undefined));
  return z.generateAsync({ type: "uint8array", compression: "DEFLATE" });
};
VW.b64 = (u8) => { let s = ""; const ch = 0x8000; for (let i = 0; i < u8.length; i += ch) s += String.fromCharCode.apply(null, u8.subarray(i, i + ch)); return btoa(s); };

/* tiny markdown for assistant answers */
VW.md = t => {
  const parts = String(t).split(/```/);
  return parts.map((p, i) => {
    if (i % 2) { const nl = p.indexOf("\n"); const lang = nl > 0 ? p.slice(0, nl).trim() : ""; return "<pre><code>" + VW.hl(nl >= 0 ? p.slice(nl + 1) : p, lang) + "</code></pre>"; }
    const lines = esc(p).split("\n"); let html = "", list = null;
    const inl = s => s.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    const close = () => { if (list) { html += "</" + list + ">"; list = null; } };
    lines.forEach(l => { let m;
      if ((m = l.match(/^\s*[-*] (.*)/))) { if (list !== "ul") { close(); html += "<ul>"; list = "ul"; } html += "<li>" + inl(m[1]) + "</li>"; }
      else if ((m = l.match(/^\s*\d+[.)] (.*)/))) { if (list !== "ol") { close(); html += "<ol>"; list = "ol"; } html += "<li>" + inl(m[1]) + "</li>"; }
      else if ((m = l.match(/^#{1,4} (.*)/))) { close(); html += "<p><b>" + inl(m[1]) + "</b></p>"; }
      else if (l.trim()) { close(); html += "<p>" + inl(l) + "</p>"; } else close();
    }); close(); return html;
  }).join("");
};

/* ---------- data ---------- */
VW.ready = (async () => {
  const res = await Promise.all(VW.AREAS.map(a => fetch(a.file).then(r => { if (!r.ok) throw new Error(a.file + " " + r.status); return r.json(); })));
  res.forEach((d, i) => {
    const a = VW.AREAS[i]; VW.data[a.id] = d;
    d.categories.forEach(c => c.items.forEach(it => VW.items.push(Object.assign({ area: a.id, catId: c.id, catName: c.name }, it))));
    (d.cookbook || []).forEach(r => VW.recipes.push(Object.assign({ area: a.id }, r)));
  });
  VW.byId = {}; VW.items.forEach(i => VW.byId[i.id] = i);
  VW.recipeById = {}; VW.recipes.forEach(r => VW.recipeById[r.id] = r);
  VW.sources = VW.AREAS.reduce((n, a) => n + (VW.data[a.id].sources || []).length, 0);
  return true;
})();

/* retrieval used by search, runs and the assistant */
const STOP = new Set("a an the and or for to of in on with from by is are be as at it this that via using use how what which into create get read build make my our new need".split(" "));
VW.tokens = s => String(s).toLowerCase().replace(/[^a-z0-9_./$ -]+/g, " ").split(/[\s/._-]+/).filter(w => w.length > 1 && !STOP.has(w)).map(w => w.length > 4 && /[^s]s$/.test(w) ? w.slice(0, -1) : w);
VW.retrieve = (query, opts) => {
  opts = opts || {}; const q = VW.tokens(query); if (!q.length) return { items: [], recipes: [] };
  const score = (fields) => { let s = 0; fields.forEach(([txt, w]) => { const t = String(txt || "").toLowerCase(); q.forEach(w2 => { if (t.includes(w2)) s += w; }); }); return s; };
  const items = VW.items.filter(i => !opts.area || i.area === opts.area).map(i => ({ i, s: score([[i.name, 4], [i.path, 3], [(i.children || []).join(" "), 1], [i.summary, 2], [i.catName, 1.5], [i.notes, 0.5], [KIND_LABEL[i.kind], 2], [i.area, 1]]) }))
    .map(x => (opts.boost && x.i.area === opts.boost ? { i: x.i, s: x.s * 1.4 } : x)).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, opts.n || 8).map(x => x.i);
  const recipes = VW.recipes.filter(r => !opts.area || r.area === opts.area).map(r => ({ r, s: score([[r.title, 4], [r.problem, 2], [(r.steps || []).join(" "), 0.6], [r.module, 1]]) }))
    .map(x => (opts.boost && x.r.area === opts.boost ? { r: x.r, s: x.s * 1.5 } : x)).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, opts.nr || 3).map(x => x.r);
  return { items, recipes };
};
VW.itemContext = it => ({ id: it.id, area: it.area, name: it.name, kind: it.kind, method: it.method, path: it.path, children: it.children, keyFields: it.keyFields, summary: it.summary, notes: (it.notes || "").slice(0, 600), verified: !!it.verified, docUrl: it.docUrl, example: it.examples && it.examples[0] ? { title: it.examples[0].title, code: String(it.examples[0].code).slice(0, 900) } : undefined });

/* ---------- views & router ---------- */
VW.NAV = [
  { g: "", items: [["home", "Overview"], ["run", "Delivery run"]] },
  { g: "Reference", items: [["catalog", "Catalog"], ["cookbook", "Cookbook"]] },
  { g: "Studios", items: [["rest", "REST Studio"], ["soap", "SOAP Studio"], ["hdl", "HDL Builder"], ["fbdi", "FBDI & ERP import"], ["formula", "Fast Formula"], ["xslt", "XSLT Mapper"], ["redwood", "Redwood review"], ["utils", "Utilities"]] },
  { g: "Execute in pod", items: [["envs", "Environments"], ["runs", "Runs"], ["loads", "HCM data loads"], ["erpjobs", "ERP jobs & reports"], ["oic", "OIC monitor"], ["worklist", "Worklist"]] },
  { g: "Assist", items: [["assistant", "Oracle Assistant"], ["roadmap", "Roadmap"]] }
];
VW.isLocal = document.body && document.body.dataset.local === "1";
VW.view = (name, def) => { VW.views[name] = def; };
function buildNav() {
  $("#nav").innerHTML = VW.NAV.map(g => (g.g ? "<h4>" + g.g + "</h4>" : "") + g.items.map(([id, label]) =>
    '<a href="#' + id + '" data-v="' + id + '">' + VW.icon(id) + "<span>" + label + '</span><span class="count" data-count="' + id + '"></span></a>').join("")).join("");
}
let current = null;
async function show() {
  let v = (location.hash || "#home").slice(1); if (!VW.views[v]) v = "home";
  $$(".nav a").forEach(a => a.setAttribute("aria-current", a.dataset.v === v ? "page" : "false"));
  $("#side").classList.remove("open"); $("#menuBtn").setAttribute("aria-expanded", "false");
  const sheet = $("#sheet");
  const swap = () => $$(".view", sheet).forEach(s => s.hidden = s.dataset.v !== v);
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (document.startViewTransition && current && current !== v && !calm && $('.view[data-v="' + v + '"]', sheet)) document.startViewTransition(swap); else swap();
  let el = $('.view[data-v="' + v + '"]', sheet);
  if (!el) {
    el = document.createElement("section"); el.className = "view"; el.dataset.v = v; sheet.append(el);
    const def = VW.views[v];
    if (def.needsData) {
      el.innerHTML = '<div class="titlerow"><div><h1>' + esc(def.title) + '</h1></div></div><div class="panel"><div class="body"><span class="skel" style="width:40%"></span><span class="skel" style="width:70%"></span><span class="skel" style="width:55%"></span></div></div>';
      try { await VW.ready; } catch (err) {
        el.innerHTML = '<div class="titlerow"><div><h1>' + esc(def.title) + '</h1></div></div><div class="panel"><div class="body"><p>Couldn\'t load the Oracle catalog files (' + esc(err.message) + ').</p><div><button class="btn" onclick="location.reload()">Retry</button></div></div></div>';
        return;
      }
    }
    def.render(el);
  }
  if (VW.views[v].onShow) VW.views[v].onShow(el);
  if (current !== v) { sheet.scrollTop = 0; current = v; }
  document.title = (VW.views[v].title || "Overview") + " · Vantage Workbench";
}
VW.go = (v) => { if (location.hash === "#" + v) show(); else location.hash = "#" + v; };
window.addEventListener("hashchange", show);
$("#menuBtn").addEventListener("click", () => { const o = $("#side").classList.toggle("open"); $("#menuBtn").setAttribute("aria-expanded", String(o)); });

/* ---------- command palette lives in ui.js ---------- */
const STUDIOS = [["rest", "REST Studio", "Build Fusion REST calls, CSV to payloads"], ["soap", "SOAP Studio", "ErpIntegrationService, BI Publisher runReport"], ["hdl", "HDL Builder", "Worker.dat and other HDL files, zipped"], ["fbdi", "FBDI & ERP import", "Zip CSVs, importBulkData payload, ESS polling"], ["formula", "Fast Formula", "Formula skeleton with checks"], ["xslt", "XSLT Mapper", "Field mapping to XSLT with a live test"], ["redwood", "Redwood review", "Score a Redwood or VBS page, export the report"], ["utils", "Utilities", "JSON, Base64, dates, q filters"], ["assistant", "Oracle Assistant", "Ask with catalog grounding"]];
VW.STUDIOS = STUDIOS;

/* ---------- HOME ---------- */
VW.view("home", { title: "Overview", needsData: true, render(el) {
  const ex = ["Load new hires from our ATS into Fusion HCM every night through OIC", "Import AP invoices from a supplier portal CSV with FBDI and a callback", "Build a Redwood VBS page that lists a manager's direct reports from Fusion REST", "Create an absence for a worker via REST and show it in a VBS page"];
  el.innerHTML = '<div class="titlerow"><div><h1>Workbench</h1><p>Describe the requirement. The assistant plans it against the verified Oracle catalog, drafts the artefacts, and waits for your approval before packaging anything.</p></div>' +
    '<div class="actions"><a class="btn" href="#cookbook">Browse cookbook</a><a class="btn primary" href="#run">New delivery run</a></div></div>' +
    '<div class="cols"><section class="panel"><header><h2>Start a delivery run</h2><span class="meta" id="h-ai"></span></header><div class="body composer">' +
    '<div class="field"><label for="h-req">Requirement</label><textarea id="h-req" rows="4" placeholder="e.g. Sync worker email changes from Fusion to our IAM tool every hour"></textarea></div>' +
    '<div class="toolbar"><div class="field" style="width:200px"><label for="h-area">Main module</label><select id="h-area"><option value="">Let the assistant decide</option>' + VW.AREAS.map(a => '<option value="' + a.id + '">' + a.name + "</option>").join("") + '</select></div><span class="grow"></span><button class="btn primary" id="h-start">Plan it</button></div>' +
    '<div class="prompts">' + ex.map(t => "<button>" + esc(t) + "</button>").join("") + "</div>" +
    '<div class="flow" aria-label="How a run works">' + [["Understand", "Reads the requirement"], ["Gather context", "Matches verified catalog entries"], ["Plan", "Steps, risks, tests"], ["Draft", "Files and payloads, unsent"], ["Approve", "Nothing moves until you agree"], ["Package", "Builds the deployable files"], ["Verify", "Checks each artefact"], ["Receipt", "CAB-ready record"]].map(s => "<div><b>" + s[0] + "</b><span>" + s[1] + "</span></div>").join("") + "</div>" +
    '</div></section><section class="panel"><header><h2>Recent runs</h2><a class="meta" href="#run">Open run</a></header><div class="body" id="h-runs"></div></section></div>' +
    '<div class="cols"><section class="panel"><header><h2>Catalog coverage</h2><span class="meta">' + VW.sources + " Oracle sources cited</span></header><div class=\"body\" id=\"h-cov\"></div></section>" +
    '<section class="panel"><header><h2>Studios</h2></header><div class="body"><div class="list">' + STUDIOS.slice(0, 8).map(s => '<a href="#' + s[0] + '"><span class="t">' + s[1] + '</span><span class="s">' + s[2] + "</span></a>").join("") + "</div></div></section></div>";
  $$(".prompts button", el).forEach(b => b.onclick = () => { $("#h-req").value = b.textContent; $("#h-req").focus(); });
  $("#h-start").onclick = () => { const t = $("#h-req").value.trim(); if (!t) { $("#h-req").focus(); VW.toast("Describe the requirement first."); return; } VW.startRun(t, $("#h-area").value); };
  // coverage computed from rows
  const rows = VW.AREAS.map(a => { const its = VW.items.filter(i => i.area === a.id); const v = its.filter(i => i.verified).length; return { a, n: its.length, v, r: VW.recipes.filter(r => r.area === a.id).length, ex: its.reduce((s, i) => s + (i.examples || []).length, 0) }; });
  const tot = rows.reduce((t, r) => ({ n: t.n + r.n, v: t.v + r.v, r: t.r + r.r, ex: t.ex + r.ex }), { n: 0, v: 0, r: 0, ex: 0 });
  console.assert(tot.n === VW.items.length && tot.r === VW.recipes.length, "coverage totals must match the catalog");
  $("#h-cov").innerHTML = '<table class="tbl resp"><thead><tr><th>Module</th><th class="num">Entries</th><th class="num">Verified</th><th style="width:22%">Verified share</th><th class="num">Examples</th><th class="num">Recipes</th></tr></thead><tbody>' +
    rows.map(r => '<tr class="click" data-area="' + r.a.id + '"><td><b>' + r.a.name + '</b><div class="note">' + r.a.long + '</div></td><td class="num">' + r.n + '</td><td class="num">' + r.v + '</td><td class="hide-sm"><div class="bar" title="' + Math.round(r.v / r.n * 100) + '%"><i style="width:' + (r.v / r.n * 100).toFixed(1) + '%"></i></div></td><td class="num hide-sm">' + r.ex + '</td><td class="num">' + r.r + "</td></tr>").join("") +
    '</tbody><tfoot><tr><td>All modules</td><td class="num">' + tot.n + '</td><td class="num">' + tot.v + '</td><td class="hide-sm note">' + Math.round(tot.v / tot.n * 100) + '% checked on docs.oracle.com</td><td class="num hide-sm">' + tot.ex + '</td><td class="num">' + tot.r + "</td></tr></tfoot></table>";
  $$("#h-cov tr[data-area]").forEach(tr => tr.onclick = () => { VW.catState.area = tr.dataset.area; VW.go("catalog"); VW.renderCatalog && VW.renderCatalog(); });
}, onShow(el) {
  const runs = VW.store.get("runs", []);
  $("#h-runs").innerHTML = runs.length ? '<div class="list">' + runs.slice(0, 5).map(r => '<button data-run="' + esc(r.id) + '"><span class="t">' + esc(r.title) + '</span><span class="s"><span class="mono">' + esc(r.id) + "</span> · " + VW.fmtDate(r.at) + '</span><span class="r"><span class="pill ' + (r.status === "Receipt written" ? "ok" : "warn") + '">' + esc(r.status) + "</span></span></button>").join("") + "</div>"
    : '<div class="empty">No runs yet. Each finished run leaves its receipt here.</div><div class="label">Popular recipes</div><div class="list">' + VW.recipes.slice(0, 4).map(r => '<button data-recipe="' + r.id + '"><span class="t">' + esc(r.title) + '</span><span class="s">' + r.area + " · " + (r.steps || []).length + " steps</span></button>").join("") + "</div>";
  $$("#h-runs [data-run]").forEach(b => b.onclick = () => VW.openRun(b.dataset.run));
  $$("#h-runs [data-recipe]").forEach(b => b.onclick = () => VW.openRecipe(b.dataset.recipe));
  $("#h-ai").textContent = VW.caps.sample ? "Assistant connected" : "Offline mode: plans come from the cookbook";
}});

/* ---------- CATALOG ---------- */
VW.catState = { area: "", kind: "", cat: "", q: "", verified: false, sel: null };
VW.view("catalog", { title: "Catalog", needsData: true, render(el) {
  el.innerHTML = '<div class="titlerow"><div><h1>Oracle technical catalog</h1><p>REST and SOAP resources, HDL objects, FBDI templates, OIC actions, OCI commands, VBS and Groovy patterns. Each entry links to the Oracle page it was checked against.</p></div></div>' +
    '<div class="tabs" role="tablist" id="c-tabs"></div>' +
    '<div class="toolbar"><input type="search" id="c-q" placeholder="Filter entries" style="max-width:300px" aria-label="Filter entries"><select id="c-kind" style="width:160px" aria-label="Kind"></select><select id="c-cat" style="width:240px" aria-label="Category"></select>' +
    '<label class="check"><input type="checkbox" id="c-ver"> Verified only</label><span class="grow"></span><span class="count num" id="c-count"></span></div>' +
    '<div class="catalog"><div class="panel"><div class="body" style="padding-top:12px"><table class="tbl resp" id="c-tbl"><thead><tr><th>Entry</th><th>Kind</th><th class="hide-sm">Path or file</th><th>Status</th></tr></thead><tbody></tbody></table></div></div>' +
    '<aside class="panel detail" id="c-detail" aria-live="polite"></aside></div>';
  const S = VW.catState;
  $("#c-q").oninput = e => { S.q = e.target.value; VW.renderCatalog(); };
  $("#c-kind").onchange = e => { S.kind = e.target.value; VW.renderCatalog(); };
  $("#c-cat").onchange = e => { S.cat = e.target.value; VW.renderCatalog(); };
  $("#c-ver").onchange = e => { S.verified = e.target.checked; VW.renderCatalog(); };
  VW.renderCatalog();
}, onShow() { VW.renderCatalog && VW.renderCatalog(); }});
VW.renderCatalog = () => {
  const S = VW.catState; if (!$("#c-tabs")) return;
  const inArea = VW.items.filter(i => !S.area || i.area === S.area);
  $("#c-tabs").innerHTML = [["", "All", VW.items.length]].concat(VW.AREAS.map(a => [a.id, a.name, VW.items.filter(i => i.area === a.id).length])).map(([id, n, c]) =>
    '<button class="tab" role="tab" aria-selected="' + (S.area === id) + '" data-a="' + id + '">' + n + '<span class="c num">' + c + "</span></button>").join("");
  $$("#c-tabs .tab").forEach(b => b.onclick = () => { S.area = b.dataset.a; S.cat = ""; S.kind = ""; VW.renderCatalog(); });
  const kinds = [...new Set(inArea.map(i => i.kind))];
  $("#c-kind").innerHTML = '<option value="">All kinds</option>' + kinds.map(k => '<option value="' + k + '"' + (S.kind === k ? " selected" : "") + ">" + (KIND_LABEL[k] || k) + "</option>").join("");
  const cats = [...new Map(inArea.map(i => [i.catId, i.catName])).entries()];
  $("#c-cat").innerHTML = '<option value="">All categories</option>' + cats.map(([id, n]) => '<option value="' + id + '"' + (S.cat === id ? " selected" : "") + ">" + esc(n) + "</option>").join("");
  const ql = S.q.toLowerCase();
  const rows = inArea.filter(i => (!S.kind || i.kind === S.kind) && (!S.cat || i.catId === S.cat) && (!S.verified || i.verified) &&
    (!ql || (i.name + " " + i.path + " " + i.summary + " " + (i.children || []).join(" ")).toLowerCase().includes(ql)));
  $("#c-count").textContent = rows.length + (rows.length === 1 ? " entry" : " entries");
  $("#c-tbl tbody").innerHTML = rows.length ? rows.map(i => '<tr class="click' + (S.sel === i.id ? " sel" : "") + '" data-id="' + i.id + '" tabindex="0"><td><b>' + esc(i.name) + '</b><div class="note">' + esc(i.area + " · " + i.catName) + '</div></td><td><span class="pill">' + esc(KIND_LABEL[i.kind] || i.kind) + '</span></td><td class="path hide-sm">' + esc(i.path || "—") + "</td><td>" + (i.verified ? '<span class="note">Verified</span>' : '<span class="pill warn">Check</span>') + "</td></tr>").join("")
    : '<tr><td colspan="4"><div class="empty">No entries match these filters. Clear the search or switch to All.</div></td></tr>';
  $$("#c-tbl tr[data-id]").forEach(tr => { tr.onclick = () => VW.selectItem(tr.dataset.id); tr.onkeydown = e => { if (e.key === "Enter") VW.selectItem(tr.dataset.id); }; });
  if (!S.sel || !rows.find(r => r.id === S.sel)) S.sel = rows[0] ? rows[0].id : null;
  renderDetail();
};
VW.selectItem = id => { VW.catState.sel = id; $$("#c-tbl tr[data-id]").forEach(tr => tr.classList.toggle("sel", tr.dataset.id === id)); renderDetail(); if (innerWidth < 1180) $("#c-detail").scrollIntoView({ block: "start" }); };
function renderDetail() {
  const box = $("#c-detail"); const i = VW.byId[VW.catState.sel];
  if (!i) { box.innerHTML = '<div class="body"><div class="empty">Select an entry to see its path, examples and Oracle source.</div></div>'; return; }
  const studio = { rest: "rest", soap: "soap", hdl: "hdl", fbdi: "fbdi", formula: "formula", xslt: "xslt" }[i.kind];
  box.innerHTML = '<div class="body"><div><div class="note">' + esc(i.area + " · " + i.catName) + '</div><h3>' + esc(i.name) + '</h3></div><p>' + esc(i.summary) + "</p>" +
    '<dl class="kv">' + (i.method ? "<dt>Method</dt><dd class=\"mono\">" + esc(i.method) + "</dd>" : "") + (i.path ? '<dt>Path</dt><dd class="mono">' + esc(i.path) + "</dd>" : "") +
    (i.children && i.children.length ? '<dt>Children</dt><dd><div class="chips">' + i.children.map(c => '<span class="chip">' + esc(c) + "</span>").join("") + "</div></dd>" : "") +
    (i.keyFields && i.keyFields.length ? '<dt>Key fields</dt><dd><div class="chips">' + i.keyFields.map(c => '<span class="chip">' + esc(c) + "</span>").join("") + "</div></dd>" : "") +
    "<dt>Status</dt><dd>" + (i.verified ? '<span class="pill ok">Verified on Oracle docs</span>' : '<span class="pill warn">Not confirmed — check before use</span>') + "</dd></dl>" +
    (i.notes ? '<div><div class="label">Notes</div><p class="note" style="color:var(--text)">' + esc(i.notes) + "</p></div>" : "") +
    (i.examples || []).map(x => VW.codeBlock(x.code, x.lang, x.title, { ask: true })).join("") +
    '<div class="toolbar">' + (i.docUrl ? '<a class="btn sm" href="' + esc(i.docUrl) + '" target="_blank" rel="noopener">' + VW.icon("ext") + "Oracle doc</a>" : "") +
    (studio ? '<button class="btn sm" id="d-open">Open in ' + ({ rest: "REST Studio", soap: "SOAP Studio", hdl: "HDL Builder", fbdi: "FBDI studio", formula: "Fast Formula", xslt: "XSLT Mapper" }[studio]) + "</button>" : "") +
    '<button class="btn ghost sm" id="d-ask">Ask about this</button></div></div>';
  const o = $("#d-open"); if (o) o.onclick = () => VW.openInStudio(i);
  $("#d-ask").onclick = () => VW.askAssistant("Explain how to use " + i.name + " (" + (i.path || i.kind) + ") in a real " + i.area + " project: purpose, how it works, steps to implement and test, and common errors.", i.area);
}
VW.openItem = id => { const i = VW.byId[id]; if (!i) return; Object.assign(VW.catState, { area: i.area, kind: "", cat: "", q: "", verified: false, sel: id }); if ($("#c-q")) $("#c-q").value = ""; VW.go("catalog"); setTimeout(() => VW.renderCatalog(), 0); };
VW.openInStudio = i => { VW.pendingStudio = i; VW.go({ rest: "rest", soap: "soap", hdl: "hdl", fbdi: "fbdi", formula: "formula", xslt: "xslt" }[i.kind]); };

/* ---------- COOKBOOK ---------- */
VW.cookState = { area: "", sel: null };
VW.view("cookbook", { title: "Cookbook", needsData: true, render(el) {
  el.innerHTML = '<div class="titlerow"><div><h1>Cookbook</h1><p>End-to-end recipes: prerequisites, steps, sample payloads, how to test and how to roll back. Start a delivery run from any recipe.</p></div></div>' +
    '<div class="tabs" role="tablist" id="k-tabs"></div><div class="catalog"><div class="panel"><div class="body" id="k-list"></div></div><aside class="panel detail" id="k-detail"></aside></div>';
  VW.renderCook();
}, onShow() { VW.renderCook && VW.renderCook(); }});
VW.renderCook = () => {
  const S = VW.cookState; if (!$("#k-tabs")) return;
  $("#k-tabs").innerHTML = [["", "All", VW.recipes.length]].concat(VW.AREAS.map(a => [a.id, a.name, VW.recipes.filter(r => r.area === a.id).length])).map(([id, n, c]) => '<button class="tab" role="tab" aria-selected="' + (S.area === id) + '" data-a="' + id + '">' + n + '<span class="c num">' + c + "</span></button>").join("");
  $$("#k-tabs .tab").forEach(b => b.onclick = () => { S.area = b.dataset.a; VW.renderCook(); });
  const rs = VW.recipes.filter(r => !S.area || r.area === S.area);
  if (!S.sel || !rs.find(r => r.id === S.sel)) S.sel = rs[0] && rs[0].id;
  $("#k-list").innerHTML = '<div class="list">' + rs.map(r => '<button data-r="' + r.id + '"' + (S.sel === r.id ? ' style="background:var(--accent-soft)"' : "") + '><span class="t">' + esc(r.title) + '</span><span class="s">' + esc(r.area + " · " + (r.level || "") + " · " + (r.steps || []).length + " steps") + '</span><span class="r">' + esc(r.problem ? "" : "") + "</span></button>").join("") + "</div>";
  $$("#k-list [data-r]").forEach(b => b.onclick = () => { S.sel = b.dataset.r; VW.renderCook(); if (innerWidth < 1180) $("#k-detail").scrollIntoView({ block: "start" }); });
  const r = VW.recipeById[S.sel]; const box = $("#k-detail");
  if (!r) { box.innerHTML = '<div class="body"><div class="empty">No recipes in this module yet.</div></div>'; return; }
  const ul = (h, a) => a && a.length ? '<div><div class="label">' + h + '</div><ul style="margin:6px 0 0;padding-left:18px;display:grid;gap:4px">' + a.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul></div>" : "";
  box.innerHTML = '<div class="body"><div><div class="note">' + esc(r.area + " · " + (r.level || "")) + "</div><h3>" + esc(r.title) + "</h3></div><p>" + esc(r.problem) + "</p>" + ul("Prerequisites", r.prerequisites) +
    '<div><div class="label">Steps</div><ol style="margin:6px 0 0;padding-left:20px;display:grid;gap:6px">' + (r.steps || []).map(s => "<li>" + esc(s) + "</li>").join("") + "</ol></div>" +
    (r.examples || []).map(x => VW.codeBlock(x.code, x.lang, x.title, { ask: true })).join("") + ul("How to test", r.testing) + ul("Rollback", r.rollback) +
    (r.docUrls && r.docUrls.length ? '<div><div class="label">Oracle sources</div><div style="display:grid;gap:4px;margin-top:6px">' + r.docUrls.map(u => '<a href="' + esc(u) + '" target="_blank" rel="noopener" class="note" style="color:var(--accent);word-break:break-all">' + esc(u.replace(/^https:\/\//, "")) + "</a>").join("") + "</div></div>" : "") +
    '<div class="toolbar"><button class="btn primary sm" id="k-run">Start a run from this recipe</button><button class="btn sm" id="k-copy">Copy as Markdown</button></div></div>';
  $("#k-run").onclick = () => VW.startRun(r.title + ". " + r.problem, r.area, r.id);
  $("#k-copy").onclick = () => VW.copy(VW.recipeMd(r));
};
VW.recipeMd = r => "# " + r.title + "\n\n" + r.problem + "\n\n## Prerequisites\n" + (r.prerequisites || []).map(x => "- " + x).join("\n") + "\n\n## Steps\n" + (r.steps || []).map((x, i) => (i + 1) + ". " + x).join("\n") +
  (r.examples || []).map(x => "\n\n### " + x.title + "\n```" + (x.lang || "") + "\n" + x.code + "\n```").join("") + "\n\n## Testing\n" + (r.testing || []).map(x => "- " + x).join("\n") + "\n\n## Rollback\n" + (r.rollback || []).map(x => "- " + x).join("\n") + "\n\n## Sources\n" + (r.docUrls || []).map(x => "- " + x).join("\n") + "\n";
VW.openRecipe = id => { const r = VW.recipeById[id]; if (!r) return; VW.cookState.area = r.area; VW.cookState.sel = id; VW.go("cookbook"); setTimeout(() => VW.renderCook(), 0); };

/* ---------- ROADMAP ---------- */
VW.view("roadmap", { title: "Roadmap", needsData: false, render(el) {
  const now = [["Catalog and cookbook", "Verified Oracle entries and recipes, searchable", "Available"], ["Delivery run", "Understand → plan → draft → approve → package → verify → receipt", "Available"], ["Studios", "REST, SOAP, HDL, FBDI, Fast Formula, XSLT, Redwood review", "Available"], ["Oracle Assistant", "Claude, grounded in the catalog", "Available in Claude"],
    ["Environments", "Fusion pods (Basic) and OIC 3 (OAuth), encrypted on your laptop", "Local app"], ["REST runner", "Send any Fusion REST call; writes wait for approval", "Local app"], ["HDL load and status", "uploadFile → createFileDataSet → status per business object", "Local app"], ["FBDI, ESS and BIP", "importBulkData, child jobs, logs, runReport preview", "Local app"], ["OIC monitor", "Integrations, failed instances, resubmit, activate, connection test", "Local app"], ["Worklist", "List and approve BPM tasks", "Local app"],
    ["OCI services", "Object Storage, Functions, Vault", "Later"], ["Team server", "Shared environments and audit trail for the team", "Later"]];
  el.innerHTML = '<div class="titlerow"><div><h1>Roadmap</h1><p>What runs in Claude, what runs in Vantage Workbench Local on your laptop, and what comes later.</p></div></div>' +
    '<section class="panel"><header><h2>Capabilities</h2><span class="meta">' + (VW.isLocal ? "You are in the local app" : "You are in Claude") + '</span></header><div class="body"><table class="tbl resp"><thead><tr><th>Capability</th><th class="hide-sm">What it does</th><th>Status</th></tr></thead><tbody>' +
    now.map(r => "<tr><td><b>" + r[0] + '</b></td><td class="hide-sm">' + r[1] + '</td><td><span class="pill ' + (r[2] === "Later" ? "" : r[2] === "Local app" ? "acc" : "ok") + '">' + r[2] + "</span></td></tr>").join("") + "</tbody></table></div></section>" +
    '<section class="panel"><header><h2>How the local app works</h2><span class="meta">Node.js 22 on your laptop, no other dependencies</span></header><div class="body"><div class="arch">' +
    [["1 · Workbench screen", "Plans, drafts and asks for approval. Talks only to the local server at localhost:4300."], ["2 · Local server", "Runs approved operations, refuses requests from other sites, and logs every request and response with its run ID."], ["3 · Encrypted environments", "Pods and secrets stored with AES-256-GCM in your data folder; passwords never reach the browser."], ["4 · Oracle Cloud", "Fusion REST, HDL, ERP integrations, BI Publisher, BPM tasks and the OIC 3 REST API."]].map(x => "<div><b>" + x[0] + "</b><span>" + x[1] + "</span></div>").join("") +
    '</div><p class="note">Reads run straight away. Anything that changes data waits for approval, and PROD changes need the environment name typed.</p></div></section>' +
    '<section class="panel"><header><h2>Market check</h2><span class="meta">From the REA analysis of oraclewings.ai and wingspi.ai, 29 Oct 2026</span></header><div class="body"><table class="tbl resp"><thead><tr><th>Seen in the market</th><th>Vantage Workbench</th></tr></thead><tbody>' +
    [["REST Studio with stored instances and server-side execute", "REST Studio + verified resources; Send to pod in the local app"], ["SOAP Studio (WSDL, SOAPAction, envelope preview)", "SOAP Studio with ErpIntegrationService and BIP runReport templates"], ["FBDI workspace with required fields and import job", "FBDI studio: zip, base64, importBulkData payload, ESS polling"], ["HCM Extracts and HDL designs", "HDL Builder with presets from Oracle examples; extract recipes"], ["Fast Formula manager with deploy", "Fast Formula scaffold with checks"], ["XSLT generator", "XSLT Mapper with an in-browser test run"], ["OTBI studio, Groovy studio", "SQL and Groovy entries in the catalog; BI Publisher runner in the local app"], ["Plan → approve → execute → receipt (assistant demo)", "Delivery run with the same safe order and a CAB-ready receipt"]].map(r => "<tr><td>" + r[0] + "</td><td>" + r[1] + "</td></tr>").join("") + "</tbody></table></div></section>";
}});

/* ---------- boot ---------- */
buildNav();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", show); else setTimeout(show, 0);
$("#sidefoot").innerHTML = '<div class="row"><span>Catalog</span><span class="num" id="sf-n">loading…</span></div><div class="row"><span>Assistant</span><span id="sf-ai">checking…</span></div>';
VW.ready.then(() => { $("#sf-n").textContent = VW.items.length + " entries · " + VW.recipes.length + " recipes"; }).catch(() => { $("#sf-n").textContent = "not loaded"; });
(async () => {
  const use = n => (window.claude && window.claude.use) ? window.claude.use(n).catch(() => null) : Promise.resolve(null);
  const [sample, downloads] = await Promise.all([use("sample"), use("downloads")]);
  VW.caps.sample = sample; VW.caps.downloads = downloads;
  const on = !!sample; const s = $("#aiState"); s.textContent = on ? "Assistant: connected" : "Assistant: offline"; s.classList.toggle("live", on);
  $("#sf-ai").textContent = on ? "connected" : "offline";
  document.dispatchEvent(new CustomEvent("vw:caps"));
  if ($("#h-ai")) $("#h-ai").textContent = on ? "Assistant connected" : "Offline mode: plans come from the cookbook";
})();
})();
