/* Vantage Workbench — delivery run (plan → approve → package → verify → receipt) and the Oracle Assistant */
(function () {
"use strict";
const VW = window.VW, $ = VW.$, $$ = VW.$$, esc = VW.esc;
const STEPS = [
  ["understand", "Understand", "Reads the requirement"], ["context", "Gather context", "Matches verified catalog entries and recipes"], ["plan", "Plan", "Steps, risks, tests, rollback"],
  ["draft", "Draft", "Artefacts prepared, nothing sent"], ["approve", "Approve", "Waits for you"], ["package", "Package", "Builds the files"], ["verify", "Verify", "Checks every artefact"], ["receipt", "Receipt", "Written to your history"]
];
const RULES = "You work inside Vantage Workbench, a toolkit for Oracle Cloud consultants (Fusion HCM, ERP/SCM, OIC Gen 3, OCI, Visual Builder Studio / Redwood). " +
  "Rules: use the CATALOG entries provided as your source of truth for resource paths, HDL attributes, job names and actions; never invent table names, REST resources, attributes, DBIs, job names or UI navigation paths — if something is not in the catalog and you are not sure, say so and name what to check (the /describe endpoint, View Business Objects, the WSDL, the FBDI template). " +
  "Use placeholders for hosts ({pod}, {region}, <oic-host>), credentials ($TOKEN) and client names. Never include passwords, tokens or keys. Distinguish HCM, ERP, OIC, OCI, VBS precisely. Recommend one primary approach with short trade-offs. Simple professional English.";
const ERR = { not_granted: "The assistant is not allowed for this page. Allow it from the artifact's Permissions menu.", sampling_disabled: "Claude is not available for this account.", rate_limited: "Too many requests just now. Wait a minute and try again.", refused: "The assistant declined that request. Rephrase it.", session_expired: "Your session expired. Sign in again and reload.", prompt_too_large: "The request is too long. Shorten it.", invalid_json: "The answer came back in the wrong shape. Try again." };
VW.errText = e => ERR[e && e.code] || "The request did not complete. Try again.";

/* ---------- AI wrapper ---------- */
async function askJson(prompt, opts) {
  const s = VW.caps.sample; if (!s) return null;
  try { return await s.json(prompt, Object.assign({ cache: false }, opts || {})); }
  catch (e) { if (e && (e.code === "not_granted" || e.code === "sampling_disabled" || e.code === "capability_disabled")) { VW.caps.sample = null; markAi(); } throw e; }
}
function markAi() { const on = !!VW.caps.sample; const s = $("#aiState"); if (s) { s.textContent = on ? "Assistant: connected" : "Assistant: offline"; s.classList.toggle("live", on); } }

/* ---------- offline heuristics ---------- */
const AREA_WORDS = { HCM: /worker|employee|hire|hdl|absence|payroll|salary|element|assignment|person|fast formula|extract|atom|grade|job|position|talent|recruit/i, ERP: /invoice|supplier|payables|receivables|journal|ledger|fbdi|purchase|requisition|po\b|ess|bip|report|expense|asset|ap\b|ar\b|gl\b/i, OIC: /oic|integration|adapter|mapper|lookup|sftp|schedule|orchestrat|fault|callback/i, OCI: /oci|object storage|bucket|function|vault|api gateway|atp|autonomous/i, VBS: /vbs|vbcs|redwood|visual builder|page|app ui|groovy|jet|approval|worklist/i };
const KIND_WORDS = [["hdl", /hdl|data loader|\.dat|bulk.*(hcm|worker)|worker.*load/i], ["fbdi", /fbdi|import.*invoice|journal import|bulk.*(erp|invoice|supplier)/i], ["rest", /rest|api|endpoint|sync|read|create|update/i], ["soap", /soap|runreport|bip report|erpintegrationservice/i], ["xslt", /xslt|transform|map(ping)?|xpath/i], ["formula", /fast formula|formula|eligib|accrual/i], ["oic", /oic|integration|schedule|sftp|callback/i], ["vbs", /vbs|redwood|page|visual builder/i]];
function guessUnderstand(run) {
  const t = run.request; const area = run.area || Object.keys(AREA_WORDS).find(a => AREA_WORDS[a].test(t)) || "HCM";
  const kinds = KIND_WORDS.filter(k => k[1].test(t)).map(k => k[0]);
  return { title: t.length > 64 ? t.slice(0, 61).trim() + "…" : t, summary: t, module: area, objects: [], deliverables: kinds.length ? kinds : ["rest"], assumptions: ["Planned offline from the cookbook; the assistant was not available."], questions: [] };
}

/* ---------- run store ---------- */
let run = null;
const saveRun = () => {
  if (!run) return; const list = VW.store.get("runs", []).filter(r => r.id !== run.id);
  const slim = JSON.parse(JSON.stringify(run)); (slim.artefacts || []).forEach(a => { if (a.content && a.content.length > 60000) a.content = a.content.slice(0, 60000) + "\n…(truncated in history)"; });
  list.unshift(slim); VW.store.set("runs", list.slice(0, 12));
};
VW.startRun = (request, area, recipeId) => {
  run = { id: VW.uid("RUN"), request, area: area || "", recipeId: recipeId || "", at: Date.now(), title: request.slice(0, 64), status: "Planning", steps: {}, artefacts: [], checks: [], feedback: [] };
  STEPS.forEach(s => run.steps[s[0]] = { state: "idle" });
  VW.go("run"); setTimeout(() => { renderRun(); pipeline(); }, 0);
};
VW.openRun = id => { const r = VW.store.get("runs", []).find(x => x.id === id); if (!r) { VW.toast("That run is no longer in this browser's history."); return; } run = r; VW.go("run"); setTimeout(renderRun, 0); };

/* ---------- pipeline ---------- */
const setStep = (k, state, data) => { run.steps[k].state = state; if (data !== undefined) run.steps[k].data = data; renderRun(); };
async function pipeline(fromPlan) {
  try {
    if (!fromPlan) {
      setStep("understand", "work");
      let u = null;
      try { u = await askJson(RULES + "\n\nTASK: Read the consultant's requirement and reply with only JSON: {\"title\": short name under 60 characters, \"summary\": 1-2 sentences, \"module\": one of HCM|ERP|OIC|OCI|VBS, \"objects\": [Oracle objects involved, e.g. Worker, Invoice], \"deliverables\": [from rest|hdl|fbdi|soap|xslt|formula|oic|vbs|sql|doc], \"assumptions\": [short], \"questions\": [at most 2 open questions]}.\n\nREQUIREMENT:\n" + run.request + (run.area ? "\nPreferred module: " + run.area : ""), { modelTier: "quick" }); }
      catch (e) { run.aiError = VW.errText(e); }
      u = u && u.summary ? u : guessUnderstand(run); u.ai = !!(u && !u.assumptions?.[0]?.startsWith("Planned offline"));
      run.title = u.title || run.title; run.area = run.area || u.module; setStep("understand", "done", u);

      setStep("context", "work");
      const q = [run.request, (u.objects || []).join(" "), (u.deliverables || []).map(k => VW.KIND_LABEL[k] || k).join(" ")].join(" ");
      const r = VW.retrieve(q, { n: 8, nr: 3, boost: run.area }); let recipes = r.recipes;
      if (run.recipeId && VW.recipeById[run.recipeId]) recipes = [VW.recipeById[run.recipeId]].concat(recipes.filter(x => x.id !== run.recipeId)).slice(0, 3);
      setStep("context", "done", { items: r.items.map(i => i.id), recipes: recipes.map(x => x.id) });
    }
    const ctx = run.steps.context.data; const items = ctx.items.map(id => VW.byId[id]).filter(Boolean), recipes = ctx.recipes.map(id => VW.recipeById[id]).filter(Boolean);
    const CTX = "CATALOG (verified Oracle entries):\n" + JSON.stringify(items.map(VW.itemContext)) + "\n\nRECIPES:\n" + JSON.stringify(recipes.map(x => ({ id: x.id, title: x.title, problem: x.problem, steps: x.steps, testing: x.testing, rollback: x.rollback }))) + (run.feedback.length ? "\n\nCHANGES REQUESTED BY THE CONSULTANT (apply them):\n- " + run.feedback.join("\n- ") : "");

    setStep("plan", "work"); let plan = null;
    try { plan = await askJson(RULES + "\n\nTASK: Plan the delivery. Reply with only JSON: {\"steps\": [{\"title\": short, \"detail\": 1-2 sentences naming the exact Oracle objects/resources used}], \"risks\": [short], \"tests\": [short], \"rollback\": [short], \"sources\": [catalog ids you relied on]}. 4 to 8 steps.\n\nREQUIREMENT:\n" + run.request + "\n\nUNDERSTANDING:\n" + JSON.stringify(run.steps.understand.data) + "\n\n" + CTX); }
    catch (e) { run.aiError = VW.errText(e); }
    if (!plan || !Array.isArray(plan.steps)) { const rc = recipes[0];
      plan = rc ? { steps: rc.steps.map(s => ({ title: s.split(/[.:]/)[0].slice(0, 70), detail: s })), risks: ["Recipe-based plan: review it against the requirement before approving."], tests: rc.testing || [], rollback: rc.rollback || [], sources: [rc.id], offline: true }
        : { steps: [{ title: "Confirm the objects and interface", detail: "No recipe matched. Pick the resources from the catalog and agree the interface with the client." }], risks: [], tests: [], rollback: [], sources: [], offline: true }; }
    setStep("plan", "done", plan);

    setStep("draft", "work"); let draft = null;
    try { draft = await askJson(RULES + "\n\nTASK: Draft the deployable artefacts for this plan. Reply with only JSON: {\"artefacts\": [{\"name\": file name with extension, \"kind\": one of rest|hdl|fbdi|soap|xslt|formula|oic|vbs|sql|doc|json, \"lang\": http|json|hdl|xml|xsl|sql|js|groovy|text|md, \"purpose\": one sentence, \"content\": the full file text}]}. 2 to 4 artefacts, each complete and minimal, using placeholders and sample data marked as sample. HDL files: METADATA line then MERGE lines, dates YYYY/MM/DD, attribute names only from the catalog examples. REST: an http request block with method, path and headers, then the JSON body.\n\nREQUIREMENT:\n" + run.request + "\n\nPLAN:\n" + JSON.stringify(plan.steps) + "\n\n" + CTX, { onText: ({ text }) => { const o = $("#run-progress"); if (o) o.textContent = "Writing drafts… " + text.length.toLocaleString() + " characters"; } }); }
    catch (e) { run.aiError = VW.errText(e); }
    let arts = draft && Array.isArray(draft.artefacts) ? draft.artefacts.filter(a => a && a.content) : [];
    if (!arts.length) { const rc = recipes[0]; arts = (rc ? rc.examples || [] : []).concat(items.slice(0, 2).flatMap(i => (i.examples || []).slice(0, 1))).slice(0, 4).map((x, n) => ({ name: (x.title || "artefact").replace(/[^\w.-]+/g, "_").slice(0, 48) + "." + ({ json: "json", xml: "xml", http: "http.txt", bash: "sh", sql: "sql", hdl: "dat", groovy: "groovy", js: "js" }[x.lang] || "txt"), kind: x.lang === "hdl" ? "hdl" : x.lang === "xml" ? "soap" : x.lang === "json" ? "json" : "doc", lang: x.lang, purpose: x.title, content: x.code, offline: true })); }
    run.artefacts = arts.slice(0, 5); setStep("draft", "done", { count: run.artefacts.length });
    run.status = "Waiting for you"; setStep("approve", "wait"); saveRun();
  } catch (e) { run.status = "Stopped"; run.aiError = VW.errText(e); renderRun(); saveRun(); }
}
function approve() {
  run.approvedAt = Date.now(); setStep("approve", "done", { at: run.approvedAt });
  setStep("package", "work");
  const sdd = "# " + run.title + "\n\nRun " + run.id + " · approved " + new Date(run.approvedAt).toISOString() + "\n\n## Requirement\n" + run.request + "\n\n## Design\n" + (run.steps.plan.data.steps || []).map((s, i) => (i + 1) + ". **" + s.title + "** — " + s.detail).join("\n") +
    "\n\n## Risks\n" + (run.steps.plan.data.risks || []).map(x => "- " + x).join("\n") + "\n\n## Test approach\n" + (run.steps.plan.data.tests || []).map(x => "- " + x).join("\n") + "\n\n## Rollback\n" + (run.steps.plan.data.rollback || []).map(x => "- " + x).join("\n") + "\n";
  if (!run.artefacts.find(a => a.name === "design-notes.md")) run.artefacts.push({ name: "design-notes.md", kind: "doc", lang: "md", purpose: "Design, risks, tests and rollback for the SDD/CAB pack", content: sdd });
  setStep("package", "done", { files: run.artefacts.map(a => a.name) });
  setStep("verify", "work"); run.checks = run.artefacts.map(verifyArtefact); setStep("verify", "done", { checks: run.checks.length });
  run.receipt = receiptMd(); run.status = "Receipt written"; setStep("receipt", "done", { at: Date.now() }); saveRun();
}
function verifyArtefact(a) {
  const out = []; const c = String(a.content || "");
  if (/-----BEGIN [A-Z ]*PRIVATE KEY|Bearer\s+eyJ[\w-]{20,}|password\s*[:=]\s*["']?(?!\$|\{|<|\*|x+\b)[^\s"'<]{6,}/i.test(c)) out.push(["bad", "Looks like it contains a real secret. Replace it with a placeholder."]);
  const lang = (a.lang || "") + " " + a.name;
  if (/json/.test(lang) && !/http/.test(lang)) { try { JSON.parse(c); out.push(["ok", "Valid JSON."]); } catch (e) { out.push(["bad", "Invalid JSON: " + esc(e.message)]); } }
  if (/hdl|\.dat/.test(lang)) VW.validateHdl(c).forEach(x => out.push(x));
  if (/xml|xsl|soap/.test(lang)) { const d = new DOMParser().parseFromString(c.replace(/\$\{[A-Z_]+\}/g, "x"), "application/xml"); out.push(d.querySelector("parsererror") ? ["bad", "Not well-formed XML."] : ["ok", "Well-formed XML."]); }
  if (/http/.test(lang) || a.kind === "rest") { const m = c.match(/^(GET|POST|PATCH|DELETE)\s+(\S+)/m);
    if (m) { const p = m[2].replace(/^https?:\/\/[^/]+/, "").split("?")[0]; const base = p.replace(/\/[^/]*\d[^/]*$/, ""); const known = VW.items.some(i => i.kind === "rest" && [p, base].includes(String(i.path || "").split("?")[0]));
      out.push(known ? ["ok", "Resource path is in the verified catalog."] : ["warn", "Path " + esc(p) + " is not in the catalog. Confirm it with /describe."]);
      const body = c.slice(c.indexOf("{")); if ((m[1] === "POST" || m[1] === "PATCH") && c.includes("{")) { try { JSON.parse(body.slice(0, body.lastIndexOf("}") + 1)); out.push(["ok", "Request body is valid JSON."]); } catch (_) { out.push(["warn", "Could not parse the request body as JSON."]); } } } }
  if (a.kind === "formula") { const o = (c.match(/\(/g) || []).length, cl = (c.match(/\)/g) || []).length; out.push(o === cl ? ["ok", "Parentheses balance."] : ["bad", "Unbalanced parentheses."]); if (!/\bRETURN\b/.test(c)) out.push(["bad", "No RETURN statement."]); }
  if (/\{pod\}|<oic-host>|\$TOKEN|\$\{/.test(c)) out.push(["warn", "Contains placeholders to fill per environment."]);
  if (!out.length) out.push(c.trim() ? ["ok", "Present and non-empty; no automatic check for this file type."] : ["bad", "Empty file."]);
  return { name: a.name, results: out };
}
function receiptMd() {
  const ctx = run.steps.context.data || { items: [], recipes: [] };
  const srcs = [...new Set(ctx.items.map(id => VW.byId[id] && VW.byId[id].docUrl).concat(ctx.recipes.flatMap(id => (VW.recipeById[id] || {}).docUrls || [])).filter(Boolean))];
  const worst = r => r.results.some(x => x[0] === "bad") ? "FAIL" : r.results.some(x => x[0] === "warn") ? "CHECK" : "PASS";
  return "# Receipt — " + run.title + "\n\n| | |\n|---|---|\n| Run | " + run.id + " |\n| Started | " + new Date(run.at).toISOString() + " |\n| Approved | " + new Date(run.approvedAt).toISOString() + " |\n| Module | " + run.area + " |\n| Planned by | " + (run.steps.plan.data.offline ? "Cookbook (offline)" : "Oracle Assistant (Claude), grounded in the Vantage catalog") + " |\n\n## Requirement\n" + run.request +
    "\n\n## Plan\n" + run.steps.plan.data.steps.map((s, i) => (i + 1) + ". " + s.title + " — " + s.detail).join("\n") + (run.feedback.length ? "\n\n## Changes requested before approval\n" + run.feedback.map(f => "- " + f).join("\n") : "") +
    "\n\n## Artefacts and checks\n| File | Result | Notes |\n|---|---|---|\n" + run.checks.map(r => "| " + r.name + " | " + worst(r) + " | " + r.results.map(x => x[1].replace(/<[^>]+>/g, "")).join("; ") + " |").join("\n") +
    "\n\n## Next steps\n- Deploy to a TEST pod first; nothing in this run was sent to Oracle.\n- Fill every placeholder from the environment registry; keep secrets in the vault.\n- Attach this receipt and design-notes.md to the change request.\n\n## Sources\n" + (srcs.map(u => "- " + u).join("\n") || "- None") + "\n";
}

/* ---------- run screen ---------- */
VW.view("run", { title: "Delivery run", needsData: true, render(el) { el.id = "run-view"; renderRun(); }, onShow() { renderRun(); } });
function renderRun() {
  const el = $("#run-view"); if (!el) return;
  if (!run) {
    const past = VW.store.get("runs", []);
    el.innerHTML = '<div class="titlerow"><div><h1>Delivery run</h1><p>One requirement carried from plan to receipt. Nothing is packaged until you approve the plan and drafts.</p></div></div><div class="cols"><section class="panel"><header><h2>New run</h2></header><div class="body composer"><div class="field"><label for="n-req">Requirement</label><textarea id="n-req" rows="4" placeholder="e.g. Nightly import of supplier invoices from SFTP into Payables"></textarea></div><div class="toolbar"><div class="field" style="width:200px"><label for="n-area">Main module</label><select id="n-area"><option value="">Let the assistant decide</option>' + VW.AREAS.map(a => '<option value="' + a.id + '">' + a.name + "</option>").join("") + '</select></div><span class="grow"></span><button class="btn primary" id="n-go">Plan it</button></div></div></section>' +
      '<section class="panel"><header><h2>History</h2><span class="meta">Kept in this browser</span></header><div class="body">' + (past.length ? '<div class="list">' + past.map(r => '<button data-run="' + esc(r.id) + '"><span class="t">' + esc(r.title) + '</span><span class="s"><span class="mono">' + esc(r.id) + "</span> · " + VW.fmtDate(r.at) + '</span><span class="r"><span class="pill ' + (r.status === "Receipt written" ? "ok" : "warn") + '">' + esc(r.status) + "</span></span></button>").join("") + "</div>" : '<div class="empty">No runs yet.</div>') + "</div></section></div>";
    $("#n-go").onclick = () => { const t = $("#n-req").value.trim(); if (!t) { $("#n-req").focus(); return; } VW.startRun(t, $("#n-area").value); };
    $$("[data-run]", el).forEach(b => b.onclick = () => VW.openRun(b.dataset.run));
    return;
  }
  const st = run.steps, u = st.understand.data, ctx = st.context.data, plan = st.plan.data;
  const pill = s => ({ idle: '<span class="pill">Not started</span>', work: '<span class="pill acc">Working</span>', done: '<span class="pill ok">Done</span>', wait: '<span class="pill warn">Waiting for you</span>' }[s]);
  const out = k => {
    if (k === "understand" && u) return "<p>" + esc(u.summary) + '</p><div class="chips">' + [u.module].concat(u.objects || []).map(x => '<span class="chip">' + esc(x) + "</span>").join("") + "</div>" + ((u.assumptions || []).length ? '<p class="note">Assumptions: ' + esc(u.assumptions.join("; ")) + "</p>" : "") + ((u.questions || []).length ? '<p class="note">Open questions: ' + esc(u.questions.join(" ")) + "</p>" : "");
    if (k === "context" && ctx) return '<div class="chips">' + ctx.items.map(id => VW.byId[id]).filter(Boolean).map(i => '<button class="chip" data-item="' + i.id + '" style="cursor:pointer">' + esc(i.area + " · " + i.name) + "</button>").join("") + "</div>" + (ctx.recipes.length ? '<p class="note">Recipes: ' + ctx.recipes.map(id => '<a href="#cookbook" data-recipe="' + id + '">' + esc((VW.recipeById[id] || {}).title) + "</a>").join(" · ") + "</p>" : "");
    if (k === "plan" && plan) return '<div class="plan"><ol>' + plan.steps.map(s => "<li><b>" + esc(s.title) + "</b> — " + esc(s.detail) + "</li>").join("") + "</ol></div>" + (plan.risks && plan.risks.length ? '<p class="note">Risks: ' + esc(plan.risks.join("; ")) + "</p>" : "") + (plan.offline ? '<p class="note">Taken from the closest cookbook recipe because the assistant was not available.</p>' : "");
    if (k === "draft" && st.draft.state === "work") return '<p class="note" id="run-progress">Writing drafts…</p>';
    if (k === "draft" && run.artefacts.length && st.draft.state === "done") return run.artefacts.filter(a => a.name !== "design-notes.md").map(a => VW.codeBlock(a.content, a.lang || "", a.name + (a.purpose ? " — " + a.purpose : ""), { ask: true })).join("");
    if (k === "verify" && run.checks.length) return run.checks.map(r => '<div><div class="label mono">' + esc(r.name) + '</div><ul class="issues">' + r.results.map(([l, t]) => '<li><span class="dot ' + l + '"></span><span>' + t + "</span></li>").join("") + "</ul></div>").join("");
    if (k === "receipt" && run.receipt) return VW.codeBlock(run.receipt, "md", "receipt.md") + '<div class="toolbar"><button class="btn primary" id="rc-zip">Save package (.zip)</button><button class="btn" id="rc-md">Save receipt (.md)</button><button class="btn" id="rc-copy">Copy receipt</button></div>';
    if (k === "package" && st.package.data) return '<div class="chips">' + st.package.data.files.map(f => '<span class="chip">' + esc(f) + "</span>").join("") + "</div>";
    return "";
  };
  const verdict = run.checks.length ? (run.checks.some(r => r.results.some(x => x[0] === "bad")) ? '<span class="pill bad">Checks failed</span>' : run.checks.some(r => r.results.some(x => x[0] === "warn")) ? '<span class="pill warn">Checks need review</span>' : '<span class="pill ok">All checks passed</span>') : "";
  el.innerHTML = '<div class="titlerow"><div><div class="crumb"><a href="#run" id="run-back">Delivery runs</a> · <span class="mono">' + esc(run.id) + "</span></div><h1>" + esc(run.title) + "</h1><p>" + esc(run.area || "") + " · started " + VW.fmtDate(run.at) + (run.aiError ? ' · <span style="color:var(--warning)">' + esc(run.aiError) + "</span>" : "") + '</p></div><div class="actions">' + verdict + '<button class="btn" id="run-new">New run</button></div></div>' +
    '<div class="run"><section class="panel"><div class="body"><div class="ledger">' + STEPS.map(([k, t, s], i) => '<div class="step ' + (st[k].state || "idle") + '"><span class="n num">' + (i + 1) + '</span><span class="t">' + t + '</span><span class="st">' + pill(st[k].state || "idle") + '</span><span class="s">' + s + '</span><div class="out">' + out(k) + "</div></div>").join("") + "</div></div></section>" +
    '<aside class="stack">' + (st.approve.state === "wait" ? '<div class="approve"><h3>Package these files?</h3><p class="note">' + run.artefacts.length + " draft artefact" + (run.artefacts.length === 1 ? "" : "s") + " · " + (plan ? plan.steps.length : 0) + ' plan steps · nothing is sent to Oracle</p><div class="toolbar"><button class="btn primary" id="ap-yes">Approve and package</button></div><div class="field"><label for="ap-fb">Or ask for changes</label><textarea id="ap-fb" rows="3" placeholder="e.g. Use user keys instead of source keys; add a rollback file"></textarea></div><div><button class="btn" id="ap-no">Revise plan and drafts</button></div></div>' : "") +
    '<section class="panel"><header><h2>Request</h2></header><div class="body"><p>' + esc(run.request) + "</p>" + (run.feedback.length ? '<p class="note">Changes asked: ' + esc(run.feedback.join("; ")) + "</p>" : "") + "</div></section>" +
    '<section class="panel"><header><h2>Context used</h2><span class="meta">' + (ctx ? ctx.items.length + " entries" : "") + '</span></header><div class="body">' + (ctx ? '<div class="list">' + ctx.items.map(id => VW.byId[id]).filter(Boolean).map(i => '<button data-item="' + i.id + '"><span class="t">' + esc(i.name) + '</span><span class="s mono">' + esc(i.path || i.kind) + '</span><span class="r">' + (i.verified ? "Verified" : '<span class="pill warn">Check</span>') + "</span></button>").join("") + "</div>" : '<span class="skel" style="width:60%"></span>') + "</div></section></aside></div>";
  $("#run-new").onclick = () => { run = null; renderRun(); };
  $("#run-back").onclick = e => { e.preventDefault(); run = null; renderRun(); };
  $$("[data-item]", el).forEach(b => b.onclick = () => VW.openItem(b.dataset.item));
  $$("[data-recipe]", el).forEach(b => b.onclick = e => { e.preventDefault(); VW.openRecipe(b.dataset.recipe); });
  const y = $("#ap-yes"); if (y) y.onclick = approve;
  const n = $("#ap-no"); if (n) n.onclick = () => { const f = $("#ap-fb").value.trim(); if (!f) { $("#ap-fb").focus(); VW.toast("Say what should change."); return; } run.feedback.push(f); run.status = "Revising"; ["plan", "draft", "approve"].forEach(k => run.steps[k] = { state: "idle" }); renderRun(); pipeline(true); };
  const z = $("#rc-zip"); if (z) z.onclick = async () => { try { const u8 = await VW.zip(run.artefacts.map(a => ({ name: a.name, content: a.content })).concat([{ name: "receipt.md", content: run.receipt }])); VW.save(run.id + ".zip", u8); } catch (e) { VW.toast(e.message); } };
  const m = $("#rc-md"); if (m) m.onclick = () => VW.save(run.id + "-receipt.md", run.receipt);
  const c = $("#rc-copy"); if (c) c.onclick = () => VW.copy(run.receipt);
}

/* ---------- ORACLE ASSISTANT ---------- */
const DOMAINS = [["", "Any module"], ["HCM", "Fusion HCM"], ["ERP", "ERP / SCM"], ["OIC", "OIC"], ["OCI", "OCI"], ["VBS", "VBS / Redwood"]];
const MODES = ["Explain", "Generate", "Debug", "Review", "Document (BRD, SDD, test cases)"];
const STARTERS = ["How do I choose between REST, HDL and HSDL for loading 5,000 workers?", "My importBulkData call returns a ReqstId but no invoices appear. Where do I look?", "Write test cases for an OIC integration that loads Worker.dat from Object Storage", "What does the Effective-Of header do on a PATCH to workers?", "Draft an SDD section for an FBDI journal import with a callback"];
let turns = [], ctl = null, busy = false;
VW.view("assistant", { title: "Oracle Assistant", needsData: true, render(el) {
  el.innerHTML = '<div class="titlerow"><div><h1>Oracle Assistant</h1><p>Each question is matched against the verified catalog first; the answer cites the entries it used. Leave out passwords, tokens and client names.</p></div><div class="actions"><button class="btn" id="a-new">New chat</button></div></div>' +
    '<section class="panel chat"><div class="log" id="a-log" aria-live="polite"></div><div class="compose"><div class="toolbar"><div class="field" style="width:170px"><label for="a-dom">Module</label><select id="a-dom">' + DOMAINS.map(d => '<option value="' + d[0] + '">' + d[1] + "</option>").join("") + '</select></div><div class="field" style="width:220px"><label for="a-mode">Task</label><select id="a-mode">' + MODES.map(m => "<option>" + m + "</option>").join("") + '</select></div><label class="check" style="align-self:flex-end;padding-bottom:6px"><input type="checkbox" id="a-ta"> Add a short Tamil summary</label></div>' +
    '<div class="prompts" id="a-st">' + STARTERS.map(s => "<button>" + esc(s) + "</button>").join("") + '</div><textarea id="a-in" rows="3" placeholder="Describe the requirement, paste the error or the code to review"></textarea><div class="toolbar"><button class="btn primary" id="a-send">Send</button><button class="btn" id="a-stop" hidden>Stop</button><span class="note" id="a-status"></span><span class="grow"></span><span class="note">Ctrl+Enter sends</span></div></div></section>';
  welcome();
  $$("#a-st button").forEach(b => b.onclick = () => { $("#a-in").value = b.textContent; $("#a-in").focus(); });
  $("#a-new").onclick = () => { if (ctl) ctl.abort(); turns = []; welcome(); };
  $("#a-send").onclick = send; $("#a-in").addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); });
  $("#a-stop").onclick = () => ctl && ctl.abort();
  if (VW._pendingAsk) { $("#a-in").value = VW._pendingAsk.text; if (VW._pendingAsk.area) $("#a-dom").value = VW._pendingAsk.area; VW._pendingAsk = null; }
}, onShow() { if (VW._pendingAsk && $("#a-in")) { $("#a-in").value = VW._pendingAsk.text; if (VW._pendingAsk.area) $("#a-dom").value = VW._pendingAsk.area; $("#a-mode").value = /^Review/.test(VW._pendingAsk.text) ? "Review" : "Explain"; VW._pendingAsk = null; $("#a-in").focus(); } } });
VW.askAssistant = (text, area) => { VW._pendingAsk = { text, area: area || "" }; VW.go("assistant"); };
function add(role, html) { const d = document.createElement("div"); d.className = "msg " + (role === "user" ? "me" : "ai"); d.innerHTML = (role === "user" ? "" : '<div class="who">Assistant</div>') + '<div class="b">' + html + "</div>"; $("#a-log").append(d); $("#a-log").scrollTop = 1e9; return d; }
function welcome() { $("#a-log").innerHTML = ""; add("ai", VW.md(VW.caps.sample ? "Ask about HCM, ERP, OIC, OCI or VBS work. I answer from the verified catalog where it covers the question and say plainly when something needs checking in your pod." : "The live assistant runs when this page is opened in Claude. You can still search the catalog and cookbook, or copy a grounded prompt to paste into a chat.")); }
async function send() {
  const text = $("#a-in").value.trim(); if (!text || busy) return;
  const area = $("#a-dom").value; const r = VW.retrieve(text, { n: 6, nr: 2, area: area || undefined });
  const ctxTxt = "CATALOG entries matched to this question:\n" + JSON.stringify(r.items.map(VW.itemContext)) + "\n\nRECIPES:\n" + JSON.stringify(r.recipes.map(x => ({ id: x.id, title: x.title, steps: x.steps, docUrls: x.docUrls })));
  const rules = RULES + "\nModule focus: " + (area || "any") + ". Task: " + $("#a-mode").value + ". Structure: purpose first, then how it works, then numbered steps to implement and test. Label statements Verified (from the catalog), Assumption, or Version-dependent where it matters. End with a 'Sources' line listing the catalog ids or doc URLs you used." + ($("#a-ta").checked ? " Finish with a two- or three-line summary in simple Tamil." : "") + " Reply in Markdown.";
  if (!VW.caps.sample) { VW.copy(rules + "\n\n" + ctxTxt + "\n\nQUESTION:\n" + text); $("#a-status").textContent = "Assistant offline: a grounded prompt was copied for you to paste into Claude."; return; }
  busy = true; $("#a-send").disabled = true; $("#a-stop").hidden = false; $("#a-status").textContent = "";
  add("user", esc(text).replace(/\n/g, "<br>")); $("#a-in").value = "";
  turns.push({ role: "user", content: text }); if (turns.length > 10) turns = turns.slice(-10); if (turns[0].role !== "user") turns.shift();
  const m = add("ai", '<p class="note">Thinking…</p>'); const b = $(".b", m); ctl = new AbortController();
  const last = turns.length - 1; const msgs = [{ role: "user", content: rules }].concat(turns.map((t, i) => i === last ? { role: "user", content: ctxTxt + "\n\nQUESTION:\n" + t.content } : t));
  const srcHtml = r.items.length ? '<p class="src">Catalog entries used: ' + r.items.map(i => '<a href="#catalog" data-item="' + i.id + '">' + esc(i.name) + "</a>").join(" · ") + "</p>" : "";
  try {
    const res = await VW.caps.sample(msgs, { cache: false, signal: ctl.signal, onText: ({ text }) => { b.innerHTML = VW.md(text); $("#a-log").scrollTop = 1e9; } });
    b.innerHTML = VW.md(res.text) + (res.truncated ? '<p class="note">The answer was cut short. Ask for the rest.</p>' : "") + srcHtml; turns.push({ role: "assistant", content: res.text });
  } catch (e) {
    if (e && e.code === "cancelled") { b.innerHTML = e.text ? VW.md(e.text) : '<p class="note">Stopped.</p>'; if (e.text) turns.push({ role: "assistant", content: e.text }); }
    else { b.innerHTML = (e && e.text && e.code !== "refused" ? VW.md(e.text) : "") + '<p class="note">' + esc(VW.errText(e)) + "</p>"; if (e && e.code === "refused") turns.pop(); if (e && (e.code === "not_granted" || e.code === "sampling_disabled")) { VW.caps.sample = null; markAi(); } }
  } finally { busy = false; $("#a-send").disabled = false; $("#a-stop").hidden = true; ctl = null; $$("[data-item]", m).forEach(a => a.onclick = ev => { ev.preventDefault(); VW.openItem(a.dataset.item); }); }
}
document.addEventListener("vw:caps", () => { if ($("#a-log") && !turns.length) welcome(); });
})();
