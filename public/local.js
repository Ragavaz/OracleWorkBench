/* Vantage Workbench — "Execute in pod": environments, approvals, runs, HCM loads, ERP jobs, OIC monitor, worklist.
   Works only when served by Vantage Workbench Local (node server/index.js). In Claude it explains how to get it. */
(function () {
"use strict";
const VW = window.VW, $ = VW.$, $$ = VW.$$, esc = VW.esc;
const L = VW.L = { envs: [], active: VW.store.get("activeEnv", {}), pending: 0 };
const issues = (list) => '<ul class="issues">' + list.map(([l, t]) => '<li><span class="dot ' + l + '"></span><span>' + t + "</span></li>").join("") + "</ul>";
const tierPill = t => '<span class="tier tier-' + esc(String(t).toLowerCase()) + '">' + esc(t) + "</span>";
const STATUS = { succeeded: ["ok", "Succeeded"], failed: ["bad", "Failed"], awaiting_approval: ["warn", "Waiting for you"], running: ["acc live", "Running"], cancelled: ["", "Cancelled"], warning: ["warn", "Warning"], planned: ["", "Planned"] };
const statusPill = s => { const x = STATUS[s] || ["", s]; return '<span class="pill ' + x[0] + '">' + x[1] + "</span>"; };
const title = (h, p, a) => '<div class="titlerow"><div><div class="crumb">Execute in pod</div><h1>' + h + "</h1><p>" + p + '</p></div><div class="actions">' + (a || "") + "</div></div>";
const notLocal = (h, p) => title(h, p) + '<section class="panel"><div class="body"><div class="empty">This screen runs in <b>Vantage Workbench Local</b>, the version that installs on your laptop and talks to your pods. In Claude you can still design and validate everything; then open the same screen in the local app to execute it.</div><p class="note">Start it with <span class="mono">npm start</span> in the vantage-workbench-local folder and open http://localhost:4300.</p></div></section>';

/* ---------- API ---------- */
VW.api = async (method, path, body) => {
  const r = await fetch(path, { method, headers: { "Content-Type": "application/json", "X-VW": "1" }, body: body ? JSON.stringify(body) : undefined });
  let j; try { j = await r.json(); } catch (_) { j = { error: "The local server sent an unreadable reply." }; }
  if (!r.ok) throw Object.assign(new Error(j.error || "HTTP " + r.status), { code: j.code, status: r.status });
  return j;
};
async function loadEnvs() { if (!VW.isLocal) return []; try { L.envs = await VW.api("GET", "/api/envs"); } catch (e) { L.envs = []; } renderSwitcher(); return L.envs; }
VW.envFor = kind => { const id = L.active[kind]; return L.envs.find(e => e.id === id && e.kind === kind) || L.envs.find(e => e.kind === kind) || null; };
async function refreshPending() { if (!VW.isLocal) return; try { const rs = await VW.api("GET", "/api/runs?limit=200"); L.pending = rs.filter(r => r.status === "awaiting_approval").length; const c = $('[data-count="runs"]'); if (c) { c.textContent = L.pending ? String(L.pending) : ""; c.title = L.pending ? L.pending + " waiting for approval" : ""; c.classList.toggle("due", !!L.pending); } } catch (_) {} }

/* ---------- environment switcher in the top bar ---------- */
function renderSwitcher() {
  const box = $("#envSwitch"); if (!box) return;
  if (!VW.isLocal) { box.hidden = true; return; }
  box.hidden = false;
  const sel = (kind, label) => { const list = L.envs.filter(e => e.kind === kind); const cur = VW.envFor(kind);
    return '<label class="envsel"><span>' + label + '</span><select data-kind="' + kind + '" aria-label="Active ' + label + ' environment">' + (list.length ? list.map(e => '<option value="' + e.id + '"' + (cur && cur.id === e.id ? " selected" : "") + ">" + esc(e.tier + " · " + e.name) + "</option>").join("") : '<option value="">Add one…</option>') + "</select></label>"; };
  const f = VW.envFor("fusion");
  box.innerHTML = (f ? tierPill(f.tier) : "") + sel("fusion", "Fusion") + sel("oic", "OIC");
  $$("select", box).forEach(s => s.onchange = () => { const e = L.envs.find(x => x.id === s.value); if (!e) { VW.go("envs"); return; } L.active[e.kind] = e.id; VW.store.set("activeEnv", L.active); renderSwitcher(); VW.toast("Active " + (e.kind === "oic" ? "OIC" : "Fusion") + " environment: " + e.name); document.dispatchEvent(new CustomEvent("vw:env")); });
}

/* ---------- approval dialog: nothing writes to a pod until a person says yes ---------- */
function approvalDialog(run, env) {
  return new Promise(resolve => {
    const d = document.createElement("dialog"); d.className = "approval";
    const prod = env.tier === "PROD";
    d.innerHTML = '<form method="dialog"><header><div><div class="note">Approval required · <span class="mono">' + esc(run.id) + "</span></div><h2>" + esc(run.title) + '</h2></div>' + tierPill(env.tier) + '</header><div class="dbody">' +
      '<p>This will change data in <b>' + esc(env.name) + '</b> (<span class="mono">' + esc(env.host.replace(/^https?:\/\//, "")) + "</span>). Review the exact request" + (run.plan.length > 1 ? "s" : "") + " below.</p>" +
      run.plan.map((s, i) => '<div class="planstep"><div class="label">' + (run.plan.length > 1 ? "Step " + (i + 1) + " · " : "") + esc(s.label) + "</div>" + VW.codeBlock(s.request.method + " " + s.request.url + "\n" + Object.entries(s.request.headers || {}).map(([k, v]) => k + ": " + v).join("\n") + (s.request.body ? "\n\n" + (typeof s.request.body === "string" ? s.request.body : JSON.stringify(s.request.body, null, 2)) : ""), "http", "Request · " + esc(s.request.auth)) + "</div>").join("") +
      (prod ? '<div class="field"><label for="apConfirm">Production change. Type <b>' + esc(env.name) + '</b> to approve.</label><input id="apConfirm" type="text" autocomplete="off"></div>' : "") +
      '<p class="note" id="apErr" role="alert"></p></div><footer><button class="btn" value="cancel" id="apCancel">Not yet</button><button class="btn primary" value="ok" id="apOk">Approve and run</button></footer></form>';
    document.body.append(d); d.showModal();
    const done = v => { d.close(); d.remove(); resolve(v); };
    $("#apCancel", d).onclick = e => { e.preventDefault(); done({ ok: false }); };
    d.addEventListener("cancel", e => { e.preventDefault(); done({ ok: false }); });
    $("#apOk", d).onclick = e => { e.preventDefault(); const c = $("#apConfirm", d); if (prod && c.value.trim() !== env.name) { $("#apErr", d).textContent = "The name does not match. Nothing was sent."; c.focus(); return; } done({ ok: true, confirm: c ? c.value.trim() : "" }); };
  });
}

/* ---------- VW.exec: plan → (approve) → run, returns the finished run ---------- */
VW.exec = async (op, params, opts) => {
  opts = opts || {};
  if (!VW.isLocal) { VW.toast("Running in a pod needs Vantage Workbench Local on your laptop."); return null; }
  const kind = op.startsWith("oic.") ? "oic" : "fusion";
  if (!L.envs.length) await loadEnvs();
  const env = VW.envFor(kind);
  if (!env) { VW.toast("Add " + (kind === "oic" ? "an OIC" : "a Fusion") + " environment first."); VW.go("envs"); return null; }
  let run;
  try { run = await VW.api("POST", "/api/runs", { envId: env.id, op, params, title: opts.title }); }
  catch (e) { VW.toast(e.message); return null; }
  if (run.status === "awaiting_approval") {
    refreshPending();
    const a = await approvalDialog(run, env);
    if (!a.ok) { VW.toast("Not sent. The run is waiting in Runs & approvals."); return run; }
    try { VW.toast("Approved. Sending to " + env.name + "…"); run = await VW.api("POST", "/api/runs/" + run.id + "/approve", { confirm: a.confirm }); }
    catch (e) { VW.toast(e.message); return null; }
    refreshPending();
  }
  if (!opts.quiet || run.status !== "succeeded") VW.toast(run.status === "succeeded" ? "Done in " + ((run.result && run.result.ms) || 0) + " ms" : "Failed: " + (run.error || "see the run"));
  return run;
};
VW.responseView = (run) => {
  if (!run) return "";
  const last = run.steps && run.steps[run.steps.length - 1]; const r = last && last.response;
  const body = r ? (r.json !== undefined ? JSON.stringify(r.json, null, 2) : r.text || "") : "";
  return '<div class="resp">' + '<div class="toolbar">' + statusPill(run.status) + (r ? '<span class="note mono">HTTP ' + r.status + " · " + r.ms + " ms</span>" : "") + '<span class="grow"></span><a class="btn ghost sm" href="#runs" data-openrun="' + esc(run.id) + '">Open run ' + esc(run.id) + "</a></div>" +
    (run.error ? issues([["bad", esc(run.error)]]) : "") + (body ? VW.codeBlock(body.length > 120000 ? body.slice(0, 120000) + "\n…(truncated on screen; full response in the run log)" : body, r && r.json !== undefined ? "json" : "text", "Response") : "") + "</div>";
};
document.addEventListener("click", e => { const a = e.target.closest("[data-openrun]"); if (a) { e.preventDefault(); L.openRun = a.dataset.openrun; VW.go("runs"); } });
VW.localButton = (label, cls) => VW.isLocal ? '<button class="btn ' + (cls || "") + '" data-local-act>' + label + "</button>" : '<span class="note">Run it in your pod from Vantage Workbench Local.</span>';

/* ======================= ENVIRONMENTS ======================= */
VW.view("envs", { title: "Environments", render(el) {
  if (!VW.isLocal) { el.innerHTML = notLocal("Environments", "Your Fusion and OIC pods, kept encrypted on your laptop."); return; }
  el.innerHTML = title("Environments", "Fusion pods use an integration user with Basic authentication. OIC 3 requires OAuth client credentials for its REST API, so OIC entries ask for a client ID and secret.") +
    '<div class="cols"><section class="panel"><header><h2>Saved environments</h2><span class="meta" id="e-dir"></span></header><div class="body" id="e-list"></div></section>' +
    '<section class="panel"><header><h2 id="e-ft">Add environment</h2></header><div class="body"><form id="e-form" class="stack" style="gap:12px" autocomplete="off">' +
    '<div class="seg" role="group" aria-label="Kind"><button type="button" data-k="fusion" aria-pressed="true">Fusion</button><button type="button" data-k="oic" aria-pressed="false">OIC 3</button></div>' +
    '<div class="fields"><div class="field"><label for="e-name">Name</label><input id="e-name" type="text" required placeholder="Client TEST"></div><div class="field"><label for="e-tier">Tier</label><select id="e-tier"><option>DEV</option><option selected>TEST</option><option>PROD</option></select></div></div>' +
    '<div class="field"><label for="e-host">Host</label><input id="e-host" type="text" class="code" required placeholder="https://{pod}.fa.{region}.oraclecloud.com"></div>' +
    '<div data-for="fusion" class="stack" style="gap:12px"><div class="fields"><div class="field"><label for="e-user">Integration user</label><input id="e-user" type="text" autocomplete="off"></div><div class="field"><label for="e-pass">Password</label><input id="e-pass" type="password" autocomplete="new-password" placeholder="leave blank to keep"></div></div><div class="field"><label for="e-sso">Source System Owner (HDL)</label><input id="e-sso" type="text" class="code" placeholder="VANTAGE"></div></div>' +
    '<div data-for="oic" class="stack" style="gap:12px" hidden><div class="field"><label for="e-inst">Service instance name (integrationInstance)</label><input id="e-inst" type="text" class="code"></div><div class="field"><label for="e-tok">Token URL</label><input id="e-tok" type="text" class="code" placeholder="https://idcs-xxxx.identity.oraclecloud.com/oauth2/v1/token"></div><div class="fields"><div class="field"><label for="e-cid">Client ID</label><input id="e-cid" type="text" class="code"></div><div class="field"><label for="e-cs">Client secret</label><input id="e-cs" type="password" autocomplete="new-password" placeholder="leave blank to keep"></div></div><div class="field"><label for="e-scope">Scope</label><input id="e-scope" type="text" class="code" placeholder="https://<audience>urn:opc:resource:consumer::all"></div></div>' +
    '<div class="toolbar"><button class="btn primary" type="submit">Save</button><button class="btn" type="button" id="e-reset">Clear</button><span class="note" id="e-msg" role="status"></span></div>' +
    '<p class="note">Secrets are encrypted with a key stored in your data folder and are never sent to the browser. Use a dedicated integration user with only the roles each task needs.</p></form></div></section></div>';
  let kind = "fusion", editing = null;
  const setKind = k => { kind = k; $$("#e-form .seg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.k === k))); $$("[data-for]", el).forEach(x => x.hidden = x.dataset.for !== k); $("#e-host").placeholder = k === "oic" ? "https://design.integration.{region}.ocp.oraclecloud.com" : "https://{pod}.fa.{region}.oraclecloud.com"; };
  $$("#e-form .seg button").forEach(b => b.onclick = () => setKind(b.dataset.k));
  const reset = () => { editing = null; $("#e-form").reset(); setKind("fusion"); $("#e-ft").textContent = "Add environment"; };
  $("#e-reset").onclick = reset;
  $("#e-form").onsubmit = async e => { e.preventDefault(); const body = { id: editing || undefined, name: $("#e-name").value, tier: $("#e-tier").value, kind, host: $("#e-host").value,
      sourceSystemOwner: $("#e-sso").value, oicInstance: $("#e-inst").value, auth: kind === "oic" ? { tokenUrl: $("#e-tok").value, clientId: $("#e-cid").value, clientSecret: $("#e-cs").value, scope: $("#e-scope").value } : { username: $("#e-user").value, password: $("#e-pass").value } };
    try { const s = await VW.api("POST", "/api/envs", body); $("#e-msg").textContent = "Saved " + s.name + "."; L.active[s.kind] = L.active[s.kind] || s.id; VW.store.set("activeEnv", L.active); reset(); await list(); } catch (err) { $("#e-msg").textContent = err.message; } };
  async function list() {
    await loadEnvs(); try { const h = await VW.api("GET", "/api/health"); $("#e-dir").textContent = "Data: " + h.dataDir; } catch (_) {}
    const box = $("#e-list");
    box.innerHTML = L.envs.length ? '<table class="tbl resp"><thead><tr><th>Environment</th><th>Kind</th><th class="hide-sm">Login</th><th>Check</th><th></th></tr></thead><tbody>' + L.envs.map(e => '<tr><td><div class="toolbar" style="gap:8px">' + tierPill(e.tier) + "<b>" + esc(e.name) + '</b></div><div class="path">' + esc(e.host) + "</div></td><td>" + (e.kind === "oic" ? "OIC 3" : "Fusion") + '</td><td class="hide-sm note">' + esc(e.kind === "oic" ? "OAuth " + (e.auth.clientId || "") : "Basic " + (e.auth.username || "")) + '</td><td id="chk-' + e.id + '"><span class="note">Not tested</span></td><td class="num"><button class="btn sm" data-test="' + e.id + '">Test</button> <button class="btn ghost sm" data-edit="' + e.id + '">Edit</button> <button class="btn ghost sm" data-del="' + e.id + '">Delete</button></td></tr>').join("") + "</tbody></table>"
      : '<div class="empty">No environments yet. Add your TEST pod first; keep PROD for later, and every PROD change will ask you to type its name.</div>';
    $$("[data-test]", box).forEach(b => b.onclick = async () => { const c = $("#chk-" + b.dataset.test); c.innerHTML = '<span class="pill acc live">Testing</span>'; try { const r = await VW.api("POST", "/api/envs/" + b.dataset.test + "/test"); c.innerHTML = r.status === "succeeded" ? '<span class="pill ok">Connected · ' + r.result.ms + " ms</span>" : '<span class="pill bad" title="' + esc(r.error) + '">' + esc((r.result && r.result.status ? "HTTP " + r.result.status : "Failed")) + "</span>"; } catch (err) { c.innerHTML = '<span class="pill bad">' + esc(err.message) + "</span>"; } });
    $$("[data-edit]", box).forEach(b => b.onclick = () => { const e = L.envs.find(x => x.id === b.dataset.edit); editing = e.id; setKind(e.kind); $("#e-ft").textContent = "Edit " + e.name; $("#e-name").value = e.name; $("#e-tier").value = e.tier; $("#e-host").value = e.host; $("#e-user").value = e.auth.username || ""; $("#e-sso").value = e.sourceSystemOwner || ""; $("#e-inst").value = e.oicInstance || ""; $("#e-tok").value = e.auth.tokenUrl || ""; $("#e-cid").value = e.auth.clientId || ""; $("#e-scope").value = e.auth.scope || ""; $("#e-name").focus(); });
    $$("[data-del]", box).forEach(b => b.onclick = async () => { if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Confirm delete"; setTimeout(() => { b.dataset.armed = ""; b.textContent = "Delete"; }, 4000); return; } await VW.api("DELETE", "/api/envs/" + b.dataset.del); list(); });
  }
  list();
}});

/* ======================= RUNS & APPROVALS ======================= */
VW.view("runs", { title: "Runs & approvals", render(el) {
  if (!VW.isLocal) { el.innerHTML = notLocal("Runs & approvals", "Every call to a pod, with its request, response and who approved it."); return; }
  el.innerHTML = title("Runs & approvals", "Reads run straight away; anything that changes data waits here for your approval. Every run keeps its exact request and response.", '<button class="btn" id="rn-ref">Refresh</button>') +
    '<div class="tabs" role="tablist" id="rn-tabs">' + [["", "All"], ["awaiting_approval", "Waiting for you"], ["failed", "Failed"], ["succeeded", "Succeeded"]].map((t, i) => '<button class="tab" role="tab" data-s="' + t[0] + '" aria-selected="' + (i === 0) + '">' + t[1] + "</button>").join("") + "</div>" +
    '<div class="catalog"><section class="panel"><div class="body" id="rn-list"></div></section><aside class="panel detail" id="rn-detail"><div class="body"><div class="empty">Pick a run to see its timeline and evidence.</div></div></aside></div>';
  let filter = "", rows = [];
  $$("#rn-tabs .tab").forEach(b => b.onclick = () => { $$("#rn-tabs .tab").forEach(x => x.setAttribute("aria-selected", String(x === b))); filter = b.dataset.s; draw(); });
  $("#rn-ref").onclick = () => VW.views.runs.onShow();
  function draw() {
    const rs = rows.filter(r => !filter || r.status === filter);
    $("#rn-list").innerHTML = rs.length ? '<table class="tbl resp"><thead><tr><th>Run</th><th class="hide-sm">Environment</th><th>Status</th><th class="num hide-sm">Time</th></tr></thead><tbody>' + rs.map(r => '<tr class="click" data-id="' + esc(r.id) + '" tabindex="0"><td><b>' + esc(r.title) + '</b><div class="note"><span class="mono">' + esc(r.id) + "</span> · " + VW.fmtDate(r.createdAt) + '</div></td><td class="hide-sm">' + tierPill(r.tier) + " " + esc(r.envName) + "</td><td>" + statusPill(r.status) + '</td><td class="num hide-sm">' + (r.ms != null ? r.ms + " ms" : "—") + "</td></tr>").join("") + "</tbody></table>" : '<div class="empty">' + (filter === "awaiting_approval" ? "Nothing is waiting for you." : "No runs yet. Send a request from REST Studio or test an environment.") + "</div>";
    $$("#rn-list tr[data-id]").forEach(tr => { tr.onclick = () => detail(tr.dataset.id); tr.onkeydown = e => { if (e.key === "Enter") detail(tr.dataset.id); }; });
  }
  async function detail(id) {
    $$("#rn-list tr[data-id]").forEach(tr => tr.classList.toggle("sel", tr.dataset.id === id));
    const box = $("#rn-detail"); let r; try { r = await VW.api("GET", "/api/runs/" + id); } catch (e) { box.innerHTML = '<div class="body"><div class="empty">' + esc(e.message) + "</div></div>"; return; }
    const env = L.envs.find(e => e.id === r.envId);
    const tl = [["Planned", r.createdAt, true], ["Approved", r.approvedAt, !r.write || !!r.approvedAt], ["Sent", r.startedAt, !!r.startedAt], [r.status === "failed" ? "Failed" : "Finished", r.finishedAt, !!r.finishedAt]];
    box.innerHTML = '<div class="body"><div><div class="note mono">' + esc(r.id) + "</div><h3>" + esc(r.title) + '</h3><div class="toolbar" style="margin-top:6px">' + statusPill(r.status) + tierPill(r.tier) + '<span class="note">' + esc(r.envName) + "</span></div></div>" +
      '<ol class="timeline">' + tl.map(t => '<li class="' + (t[2] ? "on" : "") + '"><b>' + t[0] + '</b><span class="note">' + (t[1] ? VW.fmtDate(t[1]) : r.write || t[0] !== "Approved" ? "—" : "Read-only, no approval needed") + "</span></li>").join("") + "</ol>" +
      (r.error ? issues([["bad", esc(r.error)]]) : "") +
      (r.status === "awaiting_approval" ? '<div class="toolbar"><button class="btn primary" id="rd-ok">Review and approve</button><button class="btn" id="rd-no">Cancel run</button></div>' : "") +
      (r.steps || r.plan || []).map(s => VW.codeBlock(s.request.method + " " + s.request.url + "\n" + Object.entries(s.request.headers || {}).map(([k, v]) => k + ": " + v).join("\n") + (s.request.body ? "\n\n" + (typeof s.request.body === "string" ? s.request.body : JSON.stringify(s.request.body, null, 2)) : ""), "http", s.label) +
        (s.response ? VW.codeBlock(s.response.json !== undefined ? JSON.stringify(s.response.json, null, 2).slice(0, 60000) : String(s.response.text || "").slice(0, 60000), s.response.json !== undefined ? "json" : "text", "Response · HTTP " + s.response.status + " · " + s.response.ms + " ms") : "")).join("") +
      (r.result && r.result.text ? VW.codeBlock(r.result.text.slice(0, 60000), "text", "Report output (" + (r.result.bytes || 0).toLocaleString() + " bytes)") : "") +
      '<div class="toolbar"><button class="btn sm" id="rd-md">Save evidence (.md)</button></div></div>';
    const ok = $("#rd-ok"); if (ok) ok.onclick = async () => { const a = await approvalDialog(r, env || { name: r.envName, tier: r.tier, host: "" }); if (!a.ok) return; try { await VW.api("POST", "/api/runs/" + r.id + "/approve", { confirm: a.confirm }); } catch (e) { VW.toast(e.message); } await VW.views.runs.onShow(); detail(r.id); };
    const no = $("#rd-no"); if (no) no.onclick = async () => { await VW.api("POST", "/api/runs/" + r.id + "/cancel", {}); await VW.views.runs.onShow(); detail(r.id); };
    $("#rd-md").onclick = () => { const md = "# Run evidence — " + r.title + "\n\n| | |\n|---|---|\n| Run | " + r.id + " |\n| Environment | " + r.envName + " (" + r.tier + ") |\n| Status | " + r.status + " |\n| Created | " + r.createdAt + " |\n| Approved | " + (r.approvedAt || (r.write ? "—" : "read-only")) + " |\n| Finished | " + (r.finishedAt || "—") + " |\n" + (r.error ? "\n**Error:** " + r.error + "\n" : "") +
      (r.steps || []).map(s => "\n## " + s.label + "\n\n```http\n" + s.request.method + " " + s.request.url + "\n" + Object.entries(s.request.headers || {}).map(([k, v]) => k + ": " + v).join("\n") + "\n```\n" + (s.response ? "\nHTTP " + s.response.status + " in " + s.response.ms + " ms\n\n```\n" + (s.response.json !== undefined ? JSON.stringify(s.response.json, null, 2) : s.response.text || "").slice(0, 20000) + "\n```\n" : "")).join("");
      VW.save(r.id + "-evidence.md", md); };
  }
  VW.views.runs._detail = detail; VW.views.runs._draw = draw;
  VW.views.runs._set = rs => { rows = rs; draw(); };
}, async onShow() { if (!VW.isLocal) return; await loadEnvs(); try { const rs = await VW.api("GET", "/api/runs?limit=200"); VW.views.runs._set(rs); refreshPending(); if (L.openRun) { VW.views.runs._detail(L.openRun); L.openRun = null; } } catch (e) { VW.toast(e.message); } } });

/* ======================= HCM DATA LOADS ======================= */
VW.view("loads", { title: "HCM data loads", render(el) {
  if (!VW.isLocal) { el.innerHTML = notLocal("HCM data loads", "Track HDL data sets and read HCM Atom feeds."); return; }
  el.innerHTML = title("HCM data loads", "Follow an HDL data set to completion, see errors per business object, and read new-hire or update events from the Atom feeds.") +
    '<div class="cols even"><section class="panel"><header><h2>HDL data set</h2><span class="meta" id="ld-when"></span></header><div class="body"><div class="toolbar"><div class="field" style="width:200px"><label for="ld-req">Request ID</label><input id="ld-req" type="text" class="code"></div><button class="btn primary" id="ld-go" style="align-self:flex-end">Check status</button><label class="check" style="align-self:flex-end;padding-bottom:6px"><input type="checkbox" id="ld-auto"> Refresh every 15 s</label></div><div id="ld-out"><div class="empty">Load a zip from the HDL Builder, or enter a data set request ID.</div></div></div></section>' +
    '<section class="panel"><header><h2>Atom feed</h2></header><div class="body"><div class="fields"><div class="field"><label for="at-col">Feed</label><select id="at-col"><option value="newhire">employee/newhire</option><option value="empupdate">employee/empupdate</option><option value="empassignment">employee/empassignment</option></select></div><div class="field"><label for="at-min">Updated after (UTC)</label><input id="at-min" type="text" class="code"></div></div><div><button class="btn primary" id="at-go">Read feed</button></div><div id="at-out"></div></div></section></div>';
  $("#at-min").value = new Date(Date.now() - 864e5).toISOString().slice(0, 19) + ".000Z";
  let timer = null;
  async function status() {
    const id = $("#ld-req").value.trim(); if (!id) { $("#ld-req").focus(); return; }
    const r = await VW.exec("hcm.hdl.status", { requestId: id }, { quiet: true }); if (!r) return;
    const j = r.steps && r.steps[0].response && r.steps[0].response.json; $("#ld-when").textContent = "Checked " + new Date().toLocaleTimeString();
    if (!j) { $("#ld-out").innerHTML = VW.responseView(r); return; }
    const bos = j.businessObjects || [], msgs = j.messages || [];
    const st = String(j.DataSetStatusCode || j.DataSetStatus || j.Status || "").toUpperCase();
    $("#ld-out").innerHTML = '<div class="toolbar">' + statusPill(/ERROR|FAIL/.test(st) ? "failed" : /COMPLETE|SUCCESS/.test(st) ? "succeeded" : "running") + '<span class="mono">' + esc(st || "status field not found") + "</span></div>" +
      (bos.length ? '<table class="tbl"><thead><tr><th>Business object</th>' + Object.keys(bos[0]).filter(k => /count/i.test(k)).map(k => '<th class="num">' + esc(k.replace(/Count$/, "")) + "</th>").join("") + "</tr></thead><tbody>" + bos.map(b => "<tr><td>" + esc(b.BusinessObjectName || b.BusinessObjectDiscriminator || b.Name || "—") + "</td>" + Object.keys(bos[0]).filter(k => /count/i.test(k)).map(k => '<td class="num">' + esc(b[k]) + "</td>").join("") + "</tr>").join("") + "</tbody></table>" : "") +
      (msgs.length ? '<div class="label">Messages</div><ul class="issues">' + msgs.slice(0, 50).map(m => '<li><span class="dot bad"></span><span>' + esc(m.MessageText || m.Message || JSON.stringify(m)) + "</span></li>").join("") + "</ul>" : "") +
      '<details><summary class="note">Full response</summary>' + VW.responseView(r) + "</details>";
    if (/COMPLETE|ERROR|FAIL|CANCEL/.test(st) && timer) { clearInterval(timer); timer = null; $("#ld-auto").checked = false; }
  }
  $("#ld-go").onclick = status;
  $("#ld-auto").onchange = e => { if (timer) clearInterval(timer); timer = e.target.checked ? setInterval(() => { if ($('.view[data-v="loads"]:not([hidden])')) status(); }, 15000) : null; };
  $("#at-go").onclick = async () => {
    const r = await VW.exec("hcm.atom", { collection: $("#at-col").value, updatedMin: $("#at-min").value.trim() }); if (!r) return;
    const txt = r.steps && r.steps[0].response && r.steps[0].response.text;
    if (!txt) { $("#at-out").innerHTML = VW.responseView(r); return; }
    const doc = new DOMParser().parseFromString(txt, "application/xml"); const ents = [...doc.getElementsByTagName("entry")];
    $("#at-out").innerHTML = ents.length ? '<table class="tbl"><thead><tr><th>Entry</th><th>Updated</th><th>Context</th></tr></thead><tbody>' + ents.map(en => { const g = t => (en.getElementsByTagName(t)[0] || {}).textContent || ""; let ctx = ""; try { const c = JSON.parse(g("content")).Context || []; ctx = c.map(x => [x.PersonNumber, x.DMLOperation, x.EffectiveDate].filter(Boolean).join(" · ")).join("; "); } catch (_) { ctx = g("content").slice(0, 120); } return "<tr><td>" + esc(g("title")) + '</td><td class="mono">' + esc(g("updated")) + "</td><td>" + esc(ctx) + "</td></tr>"; }).join("") + "</tbody></table>" + '<p class="note">' + ents.length + " entries. Loop pages until a page has fewer entries than the page size; store the last updated time only after processing.</p>" : '<div class="empty">No entries after that time.</div>';
  };
  VW.views.loads._prefill = id => { $("#ld-req").value = id; $("#ld-auto").checked = true; $("#ld-auto").onchange({ target: { checked: true } }); status(); };
}, onShow() { if (L.loadId && VW.views.loads._prefill) { VW.views.loads._prefill(L.loadId); L.loadId = null; } } });

/* ======================= ERP JOBS & REPORTS ======================= */
VW.view("erpjobs", { title: "ERP jobs & reports", render(el) {
  if (!VW.isLocal) { el.innerHTML = notLocal("ERP jobs & reports", "Follow ESS jobs, read their logs, and run BI Publisher reports."); return; }
  el.innerHTML = title("ERP jobs & reports", "Follow an FBDI or ESS request through its child jobs, open the log files, and run BI Publisher reports with a preview.") +
    '<div class="cols even"><section class="panel"><header><h2>ESS request</h2><span class="meta" id="es-when"></span></header><div class="body"><div class="toolbar"><div class="field" style="width:200px"><label for="es-req">Request ID</label><input id="es-req" type="text" class="code"></div><button class="btn primary" id="es-st" style="align-self:flex-end">Status</button><button class="btn" id="es-dt" style="align-self:flex-end">Child jobs</button><button class="btn" id="es-dl" style="align-self:flex-end">Logs and output</button></div><div id="es-out"><div class="empty">Submit an FBDI import, or enter an ESS request ID.</div></div></div></section>' +
    '<section class="panel"><header><h2>BI Publisher report</h2></header><div class="body"><div class="field"><label for="bp-path">Report path (.xdo)</label><input id="bp-path" type="text" class="code" placeholder="/Custom/Vantage/AP_Aging.xdo"></div><div class="fields"><div class="field"><label for="bp-fmt">Format</label><select id="bp-fmt"><option>csv</option><option>xml</option><option>pdf</option><option>excel</option></select></div></div><div class="field"><label for="bp-par">Parameters (name = value per line)</label><textarea id="bp-par" rows="3" class="code"></textarea></div><div class="toolbar"><button class="btn primary" id="bp-go">Run report</button><span class="note">Read-only; runs straight away. For large outputs schedule the report instead.</span></div><div id="bp-out"></div></div></section></div>';
  const req = () => { const v = $("#es-req").value.trim(); if (!v) $("#es-req").focus(); return v; };
  $("#es-st").onclick = async () => { const id = req(); if (!id) return; const r = await VW.exec("erp.ess.status", { requestId: id }); if (!r) return; const it = ((r.steps[0].response.json || {}).items || [])[0] || {};
    $("#es-when").textContent = "Checked " + new Date().toLocaleTimeString(); const s = String(it.RequestStatus || "");
    $("#es-out").innerHTML = '<div class="toolbar">' + statusPill(/SUCCEEDED/.test(s) ? "succeeded" : /WARNING/.test(s) ? "warning" : /ERROR|CANCEL/.test(s) ? "failed" : "running") + '<b class="mono">' + esc(s || "No status in the reply") + '</b></div><p class="note">Keep polling until the status is final. Oracle documents SUCCEEDED; treat any other final value as needing the log.</p>'; };
  $("#es-dt").onclick = async () => { const id = req(); if (!id) return; const r = await VW.exec("erp.ess.details", { requestId: id }); if (!r) return; let tree = null; try { tree = JSON.parse((((r.steps[0].response.json || {}).items || [])[0] || {}).RequestStatus); } catch (_) {}
    const flat = []; const walk = (n, d) => { if (!n) return; flat.push([d, n]); (n.CHILD || []).forEach(c => walk(c, d + 1)); };
    walk(tree && tree.JOBS, 0);
    $("#es-out").innerHTML = flat.length ? '<table class="tbl"><thead><tr><th>Job</th><th class="num">Request</th><th>Status</th></tr></thead><tbody>' + flat.map(([d, n]) => '<tr><td style="padding-left:' + (d * 18) + 'px">' + esc(n.JOBNAME || n.JOBPATH || "job") + '</td><td class="num mono">' + esc(n.REQUESTID) + "</td><td>" + statusPill(/SUCCEEDED/.test(n.STATUS) ? "succeeded" : /WARNING/.test(n.STATUS) ? "warning" : /ERROR|CANCEL/.test(n.STATUS) ? "failed" : "running") + ' <span class="note mono">' + esc(n.STATUS) + "</span></td></tr>").join("") + "</tbody></table>" : VW.responseView(r); };
  $("#es-dl").onclick = async () => { const id = req(); if (!id) return; const r = await VW.exec("erp.ess.download", { requestId: id, fileType: "ALL" }); if (!r) return;
    const b64 = (((r.steps[0].response.json || {}).items || [])[0] || {}).DocumentContent; if (!b64) { $("#es-out").innerHTML = VW.responseView(r); return; }
    try { const z = await JSZip.loadAsync(b64, { base64: true }); const names = Object.keys(z.files).filter(n => !z.files[n].dir);
      const parts = await Promise.all(names.slice(0, 8).map(async n => /\.(log|txt|out|csv|xml)$/i.test(n) ? VW.codeBlock((await z.file(n).async("string")).slice(0, 40000), "text", n) : '<p class="note mono">' + esc(n) + " (binary)</p>"));
      $("#es-out").innerHTML = (names.length ? '<p class="note">' + names.length + " file(s) in the zip.</p>" + parts.join("") : '<div class="empty">The zip is empty.</div>') + '<div class="toolbar"><button class="btn sm" id="es-save">Save zip</button></div>';
      $("#es-save").onclick = () => VW.save("ess_" + id + ".zip", Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
    } catch (e) { $("#es-out").innerHTML = '<div class="empty">Could not open the zip: ' + esc(e.message) + "</div>"; } };
  $("#bp-go").onclick = async () => { const path = $("#bp-path").value.trim(); if (!path) { $("#bp-path").focus(); return; }
    const params = $("#bp-par").value.split("\n").map(l => l.split("=")).filter(a => a[0].trim()).map(a => ({ name: a[0].trim(), value: a.slice(1).join("=").trim() }));
    const fmt = $("#bp-fmt").value; const r = await VW.exec("erp.bip.run", { reportPath: path, format: fmt, params }); if (!r) return;
    const res = r.result || {};
    if (r.status !== "succeeded") { $("#bp-out").innerHTML = VW.responseView(r); return; }
    let html = '<div class="toolbar">' + statusPill("succeeded") + '<span class="note">' + (res.bytes || 0).toLocaleString() + " bytes · " + esc(res.contentType || "") + '</span><span class="grow"></span><button class="btn sm" id="bp-save">Save output</button></div>';
    if (res.text && fmt === "csv") { const rows = VW.parseCsv(res.text).slice(0, 101); html += '<div style="overflow:auto;max-height:420px"><table class="tbl"><thead><tr>' + (rows[0] || []).map(h => "<th>" + esc(h) + "</th>").join("") + "</tr></thead><tbody>" + rows.slice(1).map(rw => "<tr>" + rw.map(c => '<td class="' + (/^-?[\d.,]+$/.test(c) ? "num" : "") + '">' + esc(c) + "</td>").join("") + "</tr>").join("") + '</tbody></table></div><p class="note">Showing up to 100 rows.</p>'; }
    else if (res.text) html += VW.codeBlock(res.text.slice(0, 60000), fmt === "xml" ? "xml" : "text", "Output");
    else html += '<p class="note">Binary output (' + esc(fmt) + "). Save it to open.</p>";
    $("#bp-out").innerHTML = html;
    $("#bp-save").onclick = () => VW.save("report." + ({ excel: "xlsx" }[fmt] || fmt), res.text != null ? res.text : Uint8Array.from(atob(res.base64), c => c.charCodeAt(0)));
  };
  VW.views.erpjobs._prefill = (id, bip) => { if (id) { $("#es-req").value = id; $("#es-st").click(); } if (bip) { $("#bp-path").value = bip.path || ""; $("#bp-fmt").value = bip.format || "csv"; $("#bp-par").value = bip.params || ""; } };
}, onShow() { if ((L.essId || L.bip) && VW.views.erpjobs._prefill) { VW.views.erpjobs._prefill(L.essId, L.bip); L.essId = null; L.bip = null; } } });

/* ======================= OIC MONITOR ======================= */
VW.view("oic", { title: "OIC monitor", render(el) {
  if (!VW.isLocal) { el.innerHTML = notLocal("OIC monitor", "Integrations, failed instances, resubmission and connection tests for OIC 3."); return; }
  el.innerHTML = title("OIC monitor", "Integrations and their status, failed instances, recoverable errors to resubmit, and connection tests. Activation and resubmission wait for your approval.", '<div class="field" style="width:150px"><label for="oc-tw">Time window</label><select id="oc-tw"><option value="1h">Last hour</option><option value="6h">Last 6 hours</option><option value="1d" selected>Last day</option><option value="3d">Last 3 days</option></select></div><button class="btn" id="oc-ref" style="align-self:flex-end">Refresh</button>') +
    '<div class="cols"><section class="panel"><header><h2>Recoverable errors</h2><span class="meta" id="oc-ec"></span></header><div class="body"><div id="oc-err"></div><div class="toolbar"><button class="btn primary" id="oc-rs" disabled>Resubmit selected</button><span class="note">Synchronous and parameterised scheduled flows cannot be resubmitted; ten resubmissions per instance at most.</span></div></div></section>' +
    '<section class="panel"><header><h2>Test a connection</h2></header><div class="body"><div class="field"><label for="oc-cn">Connection identifier</label><input id="oc-cn" type="text" class="code" placeholder="HCM_CONN"></div><div><button class="btn" id="oc-ct">Test</button></div><div id="oc-cto"></div></div></section></div>' +
    '<section class="panel"><header><h2>Integrations</h2><span class="meta" id="oc-ic"></span></header><div class="body"><div class="toolbar"><input type="search" id="oc-q" placeholder="Filter by name" style="max-width:280px" aria-label="Filter integrations"></div><div id="oc-int"></div></div></section>' +
    '<section class="panel"><header><h2>Failed instances</h2></header><div class="body" id="oc-ins"></div></section>';
  let ints = [];
  const items = r => (r && r.steps && r.steps[0].response && r.steps[0].response.json && r.steps[0].response.json.items) || [];
  async function load() {
    const tw = $("#oc-tw").value;
    const q = { quiet: true }; const a = await VW.exec("oic.integrations", {}, q); const b = a && await VW.exec("oic.errors", { timewindow: tw }, q); const c = a && await VW.exec("oic.instances", { timewindow: tw, status: "FAILED" }, q);
    if (!a) return;
    ints = items(a); drawInts();
    const errs = items(b); $("#oc-ec").textContent = errs.length + " in window";
    $("#oc-err").innerHTML = errs.length ? '<table class="tbl"><thead><tr><th><span class="sr">Select</span></th><th>Integration</th><th>Error</th></tr></thead><tbody>' + errs.map(e => '<tr><td><input type="checkbox" class="oc-sel" value="' + esc(e.id) + '" aria-label="Select error ' + esc(e.id) + '"></td><td><b>' + esc(e.integrationId || e.code || e.integration && e.integration.code || "—") + '</b><div class="note mono">' + esc(e.id) + "</div></td><td>" + esc(String(e.errorMessage || e.message || "").slice(0, 220)) + "</td></tr>").join("") + "</tbody></table>" : '<div class="empty">No recoverable errors in this window.</div>';
    $$(".oc-sel").forEach(x => x.onchange = () => { $("#oc-rs").disabled = !$$(".oc-sel:checked").length; });
    const ins = items(c);
    $("#oc-ins").innerHTML = ins.length ? '<table class="tbl resp"><thead><tr><th>Integration</th><th>Instance</th><th class="hide-sm">When</th></tr></thead><tbody>' + ins.map(i => "<tr><td>" + esc(i.integrationId || i.integrationName || i.code || "—") + '</td><td class="mono">' + esc(i.id) + '</td><td class="hide-sm note">' + esc(i.creationDate || i.lastTrackedTime || "") + "</td></tr>").join("") + "</tbody></table>" : '<div class="empty">No failed instances in this window.</div>';
  }
  function drawInts() {
    const q = $("#oc-q").value.trim().toLowerCase(); const list = ints.filter(i => !q || (i.name + " " + i.code).toLowerCase().includes(q));
    $("#oc-ic").textContent = list.length + " of " + ints.length;
    $("#oc-int").innerHTML = list.length ? '<table class="tbl resp"><thead><tr><th>Integration</th><th class="hide-sm">Version</th><th>Status</th><th></th></tr></thead><tbody>' + list.map(i => "<tr><td><b>" + esc(i.name || i.code) + '</b><div class="note mono">' + esc(i.code) + '</div></td><td class="hide-sm mono">' + esc(i.version) + "</td><td>" + (i.status === "ACTIVATED" ? '<span class="pill ok">Active</span>' : '<span class="pill">' + esc(i.status) + "</span>") + '</td><td class="num"><button class="btn sm" data-act="' + esc(i.id || i.code + "|" + i.version) + '" data-to="' + (i.status === "ACTIVATED" ? "CONFIGURED" : "ACTIVATED") + '">' + (i.status === "ACTIVATED" ? "Deactivate" : "Activate") + "</button></td></tr>").join("") + "</tbody></table>" : '<div class="empty">No integrations match.</div>';
    $$("[data-act]", $("#oc-int")).forEach(b => b.onclick = async () => { const r = await VW.exec("oic.activate", { id: b.dataset.act, status: b.dataset.to }, { title: (b.dataset.to === "ACTIVATED" ? "Activate " : "Deactivate ") + b.dataset.act }); if (r && r.status === "succeeded") load(); });
  }
  $("#oc-q").oninput = drawInts; $("#oc-ref").onclick = load; $("#oc-tw").onchange = load;
  $("#oc-rs").onclick = async () => { const ids = $$(".oc-sel:checked").map(x => x.value); const r = await VW.exec("oic.resubmit", { ids }, { title: "Resubmit " + ids.length + " failed message(s)" }); if (r && r.status === "succeeded") load(); };
  $("#oc-ct").onclick = async () => { const id = $("#oc-cn").value.trim(); if (!id) { $("#oc-cn").focus(); return; } $("#oc-cto").innerHTML = VW.responseView(await VW.exec("oic.connection.test", { id })); };
  VW.views.oic._load = load;
}, onShow() { if (VW.isLocal && VW.views.oic._load && !VW.views.oic._loaded) { VW.views.oic._loaded = true; loadEnvs().then(() => { if (VW.envFor("oic")) VW.views.oic._load(); else $("#oc-err").innerHTML = '<div class="empty">Add an OIC environment to start.</div>'; }); } } });

/* ======================= WORKLIST ======================= */
VW.view("worklist", { title: "Worklist", render(el) {
  if (!VW.isLocal) { el.innerHTML = notLocal("Worklist", "Pending approval tasks from Fusion BPM."); return; }
  el.innerHTML = title("Worklist", "Approval tasks for the integration user in the active Fusion environment. Each approve or reject goes through the approval dialog and is logged.") +
    '<section class="panel"><header><h2>Assigned tasks</h2><span class="meta" id="wl-c"></span></header><div class="body"><div class="toolbar"><select id="wl-ctx" style="width:180px" aria-label="Application"><option value="hcm">HCM tasks</option><option value="">All applications</option></select><select id="wl-as" style="width:200px" aria-label="Assignment"><option>MY_AND_GROUP</option><option>MY</option><option>GROUP</option><option>REPORTEES</option></select><input type="search" id="wl-k" placeholder="Keyword" style="max-width:220px" aria-label="Keyword"><button class="btn primary" id="wl-go">Load</button></div><div id="wl-out"><div class="empty">Load the tasks for the active environment.</div></div></div></section>';
  async function load() {
    const r = await VW.exec("bpm.tasks", { applicationContext: $("#wl-ctx").value || undefined, assignment: $("#wl-as").value, keyword: $("#wl-k").value.trim() || undefined }); if (!r) return;
    const j = r.steps[0].response.json || {}; const its = j.items || [];
    $("#wl-c").textContent = (j.totalResults != null ? j.totalResults : its.length) + " assigned";
    $("#wl-out").innerHTML = its.length ? '<table class="tbl resp"><thead><tr><th>Task</th><th class="hide-sm">Assigned</th><th class="num hide-sm">Priority</th><th></th></tr></thead><tbody>' + its.map(t => "<tr><td><b>" + esc(t.title || "Task") + '</b><div class="note mono">' + esc(t.number) + (t.identificationKey ? " · " + esc(t.identificationKey) : "") + '</div></td><td class="hide-sm note">' + esc(t.assignedDate || "") + '</td><td class="num hide-sm">' + esc(t.priority) + '</td><td class="num"><button class="btn sm" data-t="' + esc(t.number) + '" data-a="APPROVE">Approve</button> <button class="btn ghost sm" data-t="' + esc(t.number) + '" data-a="REJECT">Reject</button></td></tr>').join("") + "</tbody></table>" : '<div class="empty">Nothing is assigned. Check the assignment filter, or that the integration user holds the approver role.</div>';
    $$("[data-t]", $("#wl-out")).forEach(b => b.onclick = async () => { const r2 = await VW.exec("bpm.task.action", { id: b.dataset.t, action: b.dataset.a }, { title: (b.dataset.a === "APPROVE" ? "Approve" : "Reject") + " task " + b.dataset.t }); if (r2 && r2.status === "succeeded") load(); });
  }
  $("#wl-go").onclick = load;
}});

/* ---------- boot ---------- */
if (VW.isLocal) { loadEnvs(); refreshPending(); setInterval(refreshPending, 30000); }
else renderSwitcher();
})();
