/* Vantage Workbench — studios: REST, SOAP, HDL, FBDI, Fast Formula, XSLT, Redwood review, Utilities */
(function () {
"use strict";
const VW = window.VW, $ = VW.$, $$ = VW.$$, esc = VW.esc;
const issues = (list) => '<ul class="issues">' + list.map(([l, t]) => '<li><span class="dot ' + l + '"></span><span>' + t + "</span></li>").join("") + "</ul>";
const enc = v => encodeURIComponent(v).replace(/%2C/g, ",").replace(/%3A/g, ":").replace(/%3B/g, ";").replace(/%3D/g, "=");
const title = (h, p, actions) => '<div class="titlerow"><div><div class="crumb"><a href="#home">Studios</a></div><h1>' + h + "</h1><p>" + p + '</p></div><div class="actions">' + (actions || "") + "</div></div>";
const take = kind => { const i = VW.pendingStudio; if (i && i.kind === kind) { VW.pendingStudio = null; return i; } return null; };
const outTabs = (id, tabs) => '<div class="tabs" role="tablist" id="' + id + '">' + tabs.map((t, i) => '<button class="tab" role="tab" data-t="' + t[0] + '" aria-selected="' + (i === 0) + '">' + t[1] + "</button>").join("") + "</div>";
const bindTabs = (id, fn) => $$("#" + id + " .tab").forEach(b => b.onclick = () => { $$("#" + id + " .tab").forEach(x => x.setAttribute("aria-selected", String(x === b))); fn(b.dataset.t); });
function parseCsv(text) {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(cur); cur = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; } else cur += c; }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(v => String(v).trim() !== ""));
}
VW.parseCsv = parseCsv;

/* ======================= REST STUDIO ======================= */
VW.view("rest", { title: "REST Studio", needsData: true, render(el) {
  const rest = VW.items.filter(i => i.kind === "rest" && /^\/(hcmRestApi|fscmRestApi|crmRestApi|ic\/api|bpm\/api)/.test(i.path || ""));
  const groups = VW.AREAS.map(a => [a, rest.filter(i => i.area === a.id)]).filter(g => g[1].length);
  el.innerHTML = title("REST Studio", "Pick a verified resource, shape the query, and take the request as a URL, cURL, JavaScript, a VBS action chain or an OIC adapter checklist. Turn a CSV into one payload per row.") +
    '<div class="cols split"><section class="panel"><header><h2>Request</h2></header><div class="body">' +
    '<div class="field"><label for="r-item">Resource from the catalog</label><select id="r-item"><option value="">Custom path</option>' + groups.map(([a, its]) => '<optgroup label="' + a.name + '">' + its.map(i => '<option value="' + i.id + '">' + esc(i.name) + "</option>").join("") + "</optgroup>").join("") + "</select></div>" +
    '<div class="field"><label for="r-path">Resource path</label><input id="r-path" type="text" class="code" value="/hcmRestApi/resources/11.13.18.05/workers"><span class="hint">Child resources: <span class="mono">…/workers/{id}/child/names</span>. Use <span class="mono">/describe</span> on any resource to list its fields in your pod.</span></div>' +
    '<div class="fields"><div class="field"><label for="r-host">Pod host</label><input id="r-host" type="text" class="code" value="https://{pod}.fa.{region}.oraclecloud.com"></div><div class="field"><label for="r-method">Method</label><select id="r-method"><option>GET</option><option>POST</option><option>PATCH</option><option>DELETE</option></select></div><div class="field"><label for="r-id">Item key</label><input id="r-id" type="text" class="code" placeholder="from the self link"></div></div>' +
    '<div class="field"><label for="r-q">q filter</label><input id="r-q" type="text" class="code" value="PersonNumber=\'1001\'"><span class="hint">Framework 2 or later: <span class="mono">LastName=\'Smith\' and HireDate &gt; \'2026-01-01\'</span></span></div>' +
    '<div class="fields"><div class="field"><label for="r-fields">fields</label><input id="r-fields" type="text" class="code" placeholder="PersonId,PersonNumber"></div><div class="field"><label for="r-expand">expand</label><input id="r-expand" type="text" class="code" value="names"></div></div>' +
    '<div class="fields"><div class="field"><label for="r-finder">finder</label><input id="r-finder" type="text" class="code" placeholder="findByX;Attr=value"></div><div class="field"><label for="r-order">orderBy</label><input id="r-order" type="text" class="code" placeholder="PersonNumber:desc"></div></div>' +
    '<div class="fields"><div class="field"><label for="r-limit">limit</label><input id="r-limit" type="text" class="code" value="25"></div><div class="field"><label for="r-offset">offset</label><input id="r-offset" type="text" class="code" value="0"></div><div class="field"><label for="r-fw">REST-Framework-Version</label><select id="r-fw"><option value="">not sent</option><option>1</option><option>2</option><option>3</option><option selected>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option></select></div></div>' +
    '<div class="toolbar"><label class="check"><input type="checkbox" id="r-only" checked> onlyData=true</label><label class="check"><input type="checkbox" id="r-total"> totalResults=true</label></div>' +
    '<div class="field"><label for="r-eff">Effective-Of header</label><input id="r-eff" type="text" class="code" placeholder="RangeMode=UPDATE;RangeStartDate=2026-11-01"></div>' +
    '<div class="field" id="r-bodyw" hidden><label for="r-body">Request body</label><textarea id="r-body" rows="8" class="code" spellcheck="false"></textarea></div>' +
    '<div class="field"><label for="r-conn">VBS service connection</label><input id="r-conn" type="text" class="code" value="hcmRestApi"></div></div></section>' +
    '<div class="stack"><section class="panel"><header><h2>Output</h2><span class="meta" id="r-src"></span></header><div class="body">' + outTabs("r-tabs", [["url", "URL"], ["curl", "cURL"], ["js", "JavaScript"], ["vbs", "VBS action chain"], ["oic", "OIC adapter"]]) + '<div id="r-out"></div><div id="r-iss"></div></div></section>' +
    '<section class="panel"><header><h2>CSV to payloads</h2><span class="meta">One POST body per row</span></header><div class="body"><div class="field"><label for="r-csv">CSV with a header row. Use <span class="mono">child.Field</span> for a child collection, e.g. <span class="mono">names.FirstName</span></label><textarea id="r-csv" rows="5" class="code" spellcheck="false">names.LegislationCode,names.FirstName,names.LastName,emails.EmailType,emails.EmailAddress\nIN,Asha,Raman,W1,asha.raman@vantage-test.invalid\nIN,Karthik,Selvam,W1,karthik.selvam@vantage-test.invalid</textarea></div><div id="r-csvout"></div></div></section></div></div>';
  const S = { out: "url" };
  const set = (id, v) => { $("#" + id).value = v || ""; };
  function applyItem(it) {
    if (!it) return;
    const p = String(it.path || "").split("?")[0];
    set("r-path", p); set("r-q", ""); set("r-fields", ""); set("r-expand", ""); set("r-finder", ""); set("r-eff", "");
    const f = String(it.path || "").match(/finder=([^&]+)/); if (f) set("r-finder", decodeURIComponent(f[1]));
    const methods = String(it.method || "GET").split(/[ ,/]+/).filter(Boolean);
    $("#r-method").value = methods.includes("GET") ? "GET" : methods[0] || "GET";
    const ex = (it.examples || []).map(e => e.code).join("\n");
    const jm = ex.match(/\n\s*\n(\{[\s\S]*\})\s*$/) || ex.match(/^(\{[\s\S]*\})\s*$/);
    $("#r-body").value = jm ? jm[1] : "{\n  \n}";
    set("r-conn", /fscm/.test(p) ? "fscmRestApi" : /crm/.test(p) ? "crmRestApi" : /\/ic\/api/.test(p) ? "oicApi" : "hcmRestApi");
    $("#r-src").innerHTML = it.verified ? 'From catalog · <a href="' + esc(it.docUrl) + '" target="_blank" rel="noopener">Oracle doc</a>' : "From catalog · not confirmed";
    $("#r-item").value = it.id; build();
  }
  function st() {
    const m = $("#r-method").value, id = $("#r-id").value.trim(), host = $("#r-host").value.trim().replace(/\/+$/, "");
    const path = "/" + $("#r-path").value.trim().replace(/^\/+/, "") + (id ? "/" + encodeURIComponent(id) : "");
    const params = [];
    if (m === "GET") { const add = (k, v) => { if (v !== "" && v != null) params.push([k, v]); };
      add("q", $("#r-q").value.trim()); add("fields", $("#r-fields").value.trim()); add("expand", $("#r-expand").value.trim()); add("finder", $("#r-finder").value.trim()); add("orderBy", $("#r-order").value.trim());
      if (!id) { add("limit", $("#r-limit").value.trim()); add("offset", $("#r-offset").value.trim()); if ($("#r-total").checked) add("totalResults", "true"); }
      if ($("#r-only").checked) add("onlyData", "true"); }
    const qs = params.map(([k, v]) => k + "=" + enc(v)).join("&");
    const headers = []; if ($("#r-fw").value) headers.push(["REST-Framework-Version", $("#r-fw").value]);
    if (m === "POST" || m === "PATCH") headers.push(["Content-Type", "application/vnd.oracle.adf.resourceitem+json"]);
    if ($("#r-eff").value.trim()) headers.push(["Effective-Of", $("#r-eff").value.trim()]);
    return { m, id, host, path, params, headers, url: host + path + (qs ? "?" + qs : ""), body: $("#r-body").value, conn: $("#r-conn").value.trim() || "hcmRestApi", wants: m === "POST" || m === "PATCH" };
  }
  function build() {
    const s = st(); $("#r-bodyw").hidden = !s.wants; let out = "", lang = "text";
    if (S.out === "url") { lang = "http"; out = s.m + " " + s.url + (s.params.length ? "\n\n# Decoded query\n" + s.params.map(p => "#   " + p[0] + " = " + p[1]).join("\n") : "") + (s.headers.length ? "\n\n# Headers\n" + s.headers.map(h => "#   " + h[0] + ": " + h[1]).join("\n") : ""); }
    if (S.out === "curl") { lang = "bash"; out = "# FUSION_TOKEN: OAuth bearer from your IAM domain (or -u user:pass on a test pod only)\ncurl -sS -X " + s.m + ' "' + s.url + '" \\\n  -H "Authorization: Bearer $FUSION_TOKEN"' + s.headers.map(h => ' \\\n  -H "' + h[0] + ": " + h[1] + '"').join("") + (s.wants ? " \\\n  --data-raw '" + s.body.replace(/'/g, "'\\''") + "'" : ""); }
    if (S.out === "js") { lang = "js"; const h = ["'Authorization': 'Bearer ' + token"].concat(s.headers.map(x => "'" + x[0] + "': '" + x[1] + "'"));
      out = "// Node 18+ or a server-side function. Fusion does not allow browser calls from other origins.\nasync function callFusion(token) {\n  const res = await fetch(" + JSON.stringify(s.url) + ", {\n    method: '" + s.m + "',\n    headers: {\n      " + h.join(",\n      ") + "\n    }" + (s.wants ? ",\n    body: JSON.stringify(" + s.body.trim().split("\n").join("\n    ") + ")" : "") + "\n  });\n  if (!res.ok) throw new Error(res.status + ' ' + (await res.text()));\n  return " + (s.m === "DELETE" ? "res.status" : "res.json()") + ";\n}"; }
    if (S.out === "vbs") { lang = "js"; const last = s.path.split("/").filter(x => x && !/^\{|^\d+$/.test(x) && x !== "child").pop();
      const pre = s.m === "GET" ? (s.id ? "get_" : "getall_") : s.m === "POST" ? "create_" : s.m === "PATCH" ? "update_" : "delete_";
      const up = s.params.map(p => "          " + p[0] + ": " + (p[0] === "onlyData" ? "true" : JSON.stringify(p[1])));
      out = "// JavaScript action chain (Visual Builder Studio). Confirm the endpoint ID in the service connection's Endpoints tab.\ndefine(['vb/action/actionChain', 'vb/action/actions'], (ActionChain, Actions) => {\n  'use strict';\n  class LoadData extends ActionChain {\n    async run(context) {\n      const { $page } = context;\n      const response = await Actions.callRest(context, {\n        endpoint: '" + s.conn + "/" + pre + last + "',\n" +
        (up.length || s.id ? "        uriParams: {\n" + (s.id ? "          // path parameter name comes from the endpoint definition\n          '<resource>_Id': '" + s.id + "'" + (up.length ? ",\n" : "\n") : "") + up.join(",\n") + (up.length ? "\n" : "") + "        },\n" : "") +
        (s.headers.some(h => h[0] === "Effective-Of") ? "        headers: { 'Effective-Of': '" + $("#r-eff").value.trim() + "' },\n" : "") + (s.wants ? "        body: " + s.body.trim().split("\n").join("\n        ") + ",\n" : "") +
        "      });\n      if (!response.ok) {\n        await Actions.fireNotificationEvent(context, { summary: 'Request failed', message: 'Status ' + response.status, type: 'error' });\n        return;\n      }\n      " + (s.m === "GET" && !s.id ? "$page.variables.rows = response.body.items;" : "$page.variables.result = response.body;") + "\n    }\n  }\n  return LoadData;\n});"; }
    if (S.out === "oic") { out = "OIC — REST adapter (invoke)\n\nConnection\n  Type                 REST API Base URL\n  Connection URL       " + s.host + "\n  Security             OAuth Client Credentials (Basic only on a test pod)\n\nEndpoint\n  Relative URI         " + s.path.replace(/\/[^/]*$/, s.id ? "/{id}" : "$&") + "\n  Action               " + s.m + "\n" + (s.params.length ? "  Query parameters     " + s.params.map(p => p[0]).join(", ") + "\n" : "") + (s.headers.length ? "  Custom headers       " + s.headers.map(h => h[0]).join(", ") + "\n" : "") + (s.wants ? "  Request payload      JSON sample below\n" : "  Response payload     run once in a test pod and paste the reply as the sample\n") + "\nMapper\n" + s.params.map(p => "  " + p[0].padEnd(12) + " ← " + JSON.stringify(p[1])).join("\n") + (s.wants ? "\n\nSample request\n" + s.body : ""); }
    $("#r-out").innerHTML = VW.codeBlock(out, lang, { url: "Request", curl: "cURL", js: "JavaScript", vbs: "Action chain", oic: "OIC checklist" }[S.out], { ask: true });
    const iss = [];
    if (/\{pod\}|\{region\}/.test(s.host)) iss.push(["warn", "Replace <span class=\"mono\">{pod}</span> and <span class=\"mono\">{region}</span> with your environment host."]);
    const base = "/" + $("#r-path").value.trim().replace(/^\/+/, "");
    const known = VW.items.some(i => i.kind === "rest" && String(i.path || "").split("?")[0] === base);
    if (VW.items.length && !known) iss.push(["warn", "This path is not in the catalog. Check it with <span class=\"mono\">/describe</span> before you build on it."]);
    if (s.wants) { try { JSON.parse(s.body); iss.push(["ok", "Body is valid JSON."]); } catch (e) { iss.push(["bad", "Body is not valid JSON: " + esc(e.message)]); } }
    if (s.m === "PATCH" && /hcmRestApi/.test(s.path) && !$("#r-eff").value.trim()) iss.push(["warn", "Effective-dated HCM objects usually need an Effective-Of header on PATCH (RangeMode UPDATE or CORRECTION)."]);
    if ((s.m === "PATCH" || s.m === "DELETE") && !s.id) iss.push(["bad", "PATCH and DELETE need an item key."]);
    if (s.params.find(p => p[0] === "q") && $("#r-fw").value === "1") iss.push(["warn", "Framework version 1 only accepts the semicolon form of q."]);
    if (+$("#r-limit").value > 500) iss.push(["warn", "Large limits are capped by the server. Page with offset until hasMore is false."]);
    if (!iss.length) iss.push(["ok", "Request looks complete."]);
    $("#r-iss").innerHTML = issues(iss);
  }
  function csvOut() {
    const rows = parseCsv($("#r-csv").value); const box = $("#r-csvout");
    if (rows.length < 2) { box.innerHTML = '<div class="empty">Add a header row and at least one data row.</div>'; return; }
    const head = rows[0].map(h => h.trim()); const bad = [];
    const payloads = rows.slice(1).map((r, n) => { if (r.length !== head.length) bad.push(n + 2); const o = {};
      head.forEach((h, i) => { const v = (r[i] || "").trim(); if (v === "") return; const [a, b] = h.split("."); if (b) { o[a] = o[a] || [{}]; o[a][0][b] = v; } else o[a] = v; }); return o; });
    const script = "# Save the array as payloads.json, then post each element\njq -c '.[]' payloads.json | while read -r body; do\n  curl -sS -X POST \"" + st().host + "/" + $("#r-path").value.trim().replace(/^\/+/, "") + "\" \\\n    -H \"Authorization: Bearer $FUSION_TOKEN\" -H \"REST-Framework-Version: 4\" \\\n    -H \"Content-Type: application/vnd.oracle.adf.resourceitem+json\" --data-raw \"$body\"\n  sleep 1\ndone";
    box.innerHTML = VW.codeBlock(JSON.stringify(payloads, null, 2), "json", payloads.length + " payloads", { file: "payloads.json" }) + VW.codeBlock(script, "bash", "Post them") +
      issues(bad.length ? [["bad", "Rows " + bad.join(", ") + " have a different number of values from the header."]] : [["ok", payloads.length + " rows, " + head.length + " columns, all rows match the header."], ["warn", "For more than a few hundred records use HDL (HCM) or FBDI (ERP) instead of REST."]]);
  }
  $("#r-item").onchange = e => applyItem(VW.byId[e.target.value]);
  $$("input,select,textarea", $(".cols", el)).forEach(x => { if (!["r-item", "r-csv"].includes(x.id)) x.addEventListener("input", build); });
  $("#r-csv").addEventListener("input", csvOut);
  bindTabs("r-tabs", t => { S.out = t; build(); });
  const first = VW.byId["hcm-workers"]; if (first) { applyItem(first); set("r-q", "PersonNumber='1001'"); set("r-expand", "names"); }
  build(); csvOut();
  VW._restApply = applyItem;
}, onShow() { const i = take("rest"); if (i && VW._restApply) VW._restApply(i); } });

/* ======================= SOAP STUDIO ======================= */
const SOAP_T = {
  runReport: { label: "BI Publisher — runReport", path: "/xmlpserver/services/ExternalReportWSSService", action: "runReport", ns: "http://xmlns.oracle.com/oxp/service/PublicReportService", prefix: "pub",
    body: (p) => "<pub:runReport>\n  <pub:reportRequest>\n    <pub:attributeFormat>" + p.format + "</pub:attributeFormat>\n    <pub:reportAbsolutePath>" + p.report + "</pub:reportAbsolutePath>\n" + (p.params.length ? "    <pub:parameterNameValues>\n      <pub:item>\n" + p.params.map(([k, v]) => "        <pub:name>" + k + "</pub:name>\n        <pub:values><pub:item>" + v + "</pub:item></pub:values>").join("\n      </pub:item>\n      <pub:item>\n") + "\n      </pub:item>\n    </pub:parameterNameValues>\n" : "") + "    <pub:sizeOfDataChunkDownload>-1</pub:sizeOfDataChunkDownload>\n  </pub:reportRequest>\n  <pub:appParams></pub:appParams>\n</pub:runReport>",
    fields: [["report", "Report path (.xdo)", "/Custom/Vantage/AP_Aging.xdo"], ["format", "Output format", "csv"], ["params", "Parameters (name = value per line)", "P_BUSINESS_UNIT = Vision Operations"]], item: "erp-soap-bip-runreport" },
  submitESS: { label: "ErpIntegrationService — submitESSJobRequest", path: "/fscmService/ErpIntegrationService", action: "submitESSJobRequest", ns: "http://xmlns.oracle.com/apps/financials/commonModules/shared/model/erpIntegrationService/types/", prefix: "typ",
    body: (p) => "<typ:submitESSJobRequest>\n  <typ:jobPackageName>" + p.pkg + "</typ:jobPackageName>\n  <typ:jobDefinitionName>" + p.def + "</typ:jobDefinitionName>\n" + p.list.split(",").map(v => "  <typ:paramList>" + v.trim() + "</typ:paramList>").join("\n") + "\n</typ:submitESSJobRequest>",
    fields: [["pkg", "Job package", "oracle/apps/ess/financials/commonModules/shared/common/interfaceLoader"], ["def", "Job definition", "InterfaceLoaderController"], ["list", "Parameters (comma separated, #NULL for empty)", "1,10420,N,N"]], item: "erp-soap-erpintegrationservice" },
  getStatus: { label: "ErpIntegrationService — getESSJobStatus", path: "/fscmService/ErpIntegrationService", action: "getESSJobStatus", ns: "http://xmlns.oracle.com/apps/financials/commonModules/shared/model/erpIntegrationService/types/", prefix: "typ",
    body: (p) => "<typ:getESSJobStatus>\n  <typ:requestId>" + p.req + "</typ:requestId>\n</typ:getESSJobStatus>", fields: [["req", "ESS request ID", "14557"]], item: "erp-soap-erpintegrationservice" },
  custom: { label: "Custom operation", path: "/fscmService/<Service>", action: "<operation>", ns: "<types namespace from the WSDL>", prefix: "typ",
    body: (p) => "<typ:" + p.op + ">\n" + p.params.map(([k, v]) => "  <typ:" + k + ">" + v + "</typ:" + k + ">").join("\n") + "\n</typ:" + p.op + ">", fields: [["op", "Operation element", "operationName"], ["params", "Elements (name = value per line)", "elementName = value"]] }
};
VW.view("soap", { title: "SOAP Studio", needsData: true, render(el) {
  el.innerHTML = title("SOAP Studio", "Compose SOAP 1.1 envelopes for ErpIntegrationService and the BI Publisher report service, with a cURL call and an XML check. Namespaces must match your pod's WSDL.") +
    '<div class="cols split"><section class="panel"><header><h2>Envelope</h2></header><div class="body"><div class="field"><label for="s-t">Operation</label><select id="s-t">' + Object.entries(SOAP_T).map(([k, t]) => '<option value="' + k + '">' + t.label + "</option>").join("") + "</select></div>" +
    '<div class="fields"><div class="field"><label for="s-host">Pod host</label><input id="s-host" type="text" class="code" value="https://{pod}.fa.{region}.oraclecloud.com"></div><div class="field"><label for="s-path">Service path</label><input id="s-path" type="text" class="code"></div></div>' +
    '<div class="field"><label for="s-ns">Types namespace</label><input id="s-ns" type="text" class="code"></div><div id="s-fields" class="stack" style="gap:12px"></div>' +
    '<div class="field"><label for="s-sec">Security</label><select id="s-sec"><option value="wsse">WS-Security UsernameToken in the header (placeholders)</option><option value="basic">HTTP Basic header (test pods)</option><option value="none">Set by the caller (OIC connection)</option></select></div></div></section>' +
    '<section class="panel"><header><h2>Output</h2><span class="meta" id="s-src"></span></header><div class="body" id="s-out"></div></section></div>';
  function fieldsFor(t) { $("#s-fields").innerHTML = t.fields.map(([k, l, v]) => '<div class="field"><label for="sf-' + k + '">' + l + "</label>" + (k === "params" ? '<textarea id="sf-' + k + '" rows="3" class="code">' + esc(v) + "</textarea>" : '<input id="sf-' + k + '" type="text" class="code" value="' + esc(v) + '">') + "</div>").join(""); $$("#s-fields input,#s-fields textarea").forEach(x => x.oninput = build); }
  function load() { const t = SOAP_T[$("#s-t").value]; $("#s-path").value = t.path; $("#s-ns").value = t.ns; fieldsFor(t); const it = VW.byId[t.item]; $("#s-src").innerHTML = it ? '<a href="' + esc(it.docUrl) + '" target="_blank" rel="noopener">Oracle doc</a>' : ""; build(); }
  function build() {
    const t = SOAP_T[$("#s-t").value]; const p = {};
    t.fields.forEach(([k]) => { const v = $("#sf-" + k).value; p[k] = k === "params" ? v.split("\n").map(l => l.split("=")).filter(a => a[0].trim()).map(a => [a[0].trim(), (a.slice(1).join("=") || "").trim()]) : v.trim(); });
    const sec = $("#s-sec").value;
    const header = sec === "wsse" ? '\n  <soapenv:Header>\n    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">\n      <wsse:UsernameToken>\n        <wsse:Username>${INTEGRATION_USER}</wsse:Username>\n        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${INTEGRATION_PASSWORD}</wsse:Password>\n      </wsse:UsernameToken>\n    </wsse:Security>\n  </soapenv:Header>' : "\n  <soapenv:Header/>";
    const env = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:' + t.prefix + '="' + $("#s-ns").value.trim() + '">' + header + "\n  <soapenv:Body>\n" + t.body(p).split("\n").map(l => "    " + l).join("\n") + "\n  </soapenv:Body>\n</soapenv:Envelope>";
    const url = $("#s-host").value.trim().replace(/\/+$/, "") + $("#s-path").value.trim();
    const curl = "# Save the envelope as request.xml\ncurl -sS -X POST \"" + url + "\" \\\n  -H \"Content-Type: text/xml;charset=UTF-8\" \\\n  -H \"SOAPAction: " + t.action + "\"" + (sec === "basic" ? " \\\n  -u \"$INTEGRATION_USER:$INTEGRATION_PASSWORD\"" : "") + " \\\n  --data-binary @request.xml" + (t === SOAP_T.runReport ? "\n\n# reportBytes in the reply is base64: extract and decode it\n#   xmllint --xpath 'string(//*[local-name()=\"reportBytes\"])' reply.xml | base64 -d > report." + (p.format || "csv") : "");
    const iss = []; const doc = new DOMParser().parseFromString(env.replace(/\$\{[A-Z_]+\}/g, "x"), "application/xml");
    iss.push(doc.querySelector("parsererror") ? ["bad", "The envelope is not well-formed XML. Check the values for <, > or &."] : ["ok", "Envelope is well-formed XML."]);
    iss.push(["warn", "Confirm the types namespace and element names in " + esc($("#s-path").value.trim()) + "?WSDL for your release."]);
    if (sec === "wsse") iss.push(["warn", "Keep the password out of files: let OIC or your secret store fill the token."]);
    if (/\{pod\}/.test(url)) iss.push(["warn", "Replace {pod} and {region} with your host."]);
    $("#s-out").innerHTML = VW.codeBlock(env, "xml", "SOAP envelope", { ask: true }) + VW.codeBlock(curl, "bash", "cURL") + issues(iss);
  }
  $("#s-t").onchange = load; ["s-host", "s-path", "s-ns"].forEach(i => $("#" + i).oninput = build); $("#s-sec").onchange = build; load();
}});

/* ======================= HDL BUILDER ======================= */
function hdlPresets() {
  const out = [];
  VW.items.filter(i => i.kind === "hdl").forEach(it => (it.examples || []).forEach(ex => {
    const lines = String(ex.code).split("\n"); let cur = null;
    lines.forEach(l => { const m = l.match(/^METADATA\|([^|]+)\|(.*)$/); if (m) { cur = { id: it.id + ":" + m[1] + ":" + out.length, label: it.name + " — " + m[1], obj: m[1], attrs: m[2].split("|"), rows: [], file: (String(it.path).match(/\w+\.dat/) || [m[1] + ".dat"])[0], src: it }; out.push(cur); }
      else if (cur && /^(MERGE|DELETE)\|/.test(l)) { const p = l.split("|"); if (p[1] === cur.obj) cur.rows.push(p.slice(2)); } });
  }));
  return out.filter(p => p.attrs.length > 1 && p.rows.length && !p.attrs.some(a => a.includes("...")));
}
VW.validateHdl = (text) => {
  const iss = []; const meta = {}; let n = 0, badDate = 0;
  String(text).split(/\r?\n/).forEach((l, i) => {
    if (!l.trim() || /^(COMMENT|SET)\b/.test(l)) return;
    const p = l.split(/(?<!\\)\|/);
    if (p[0] === "METADATA") { meta[p[1]] = p.slice(2); return; }
    if (p[0] === "MERGE" || p[0] === "DELETE") { n++; const m = meta[p[1]];
      if (!m) iss.push(["bad", "Line " + (i + 1) + ": no METADATA line for " + esc(p[1]) + " before it."]);
      else if (p.length - 2 !== m.length) iss.push(["bad", "Line " + (i + 1) + ": " + (p.length - 2) + " values, METADATA for " + esc(p[1]) + " has " + m.length + "."]);
      if (m) m.forEach((a, j) => { const v = p[j + 2]; if (/date|datefrom|dateto/i.test(a) && v && !/^\d{4}\/\d{2}\/\d{2}$/.test(v)) badDate++; });
      return; }
    iss.push(["bad", "Line " + (i + 1) + " does not start with METADATA, MERGE, DELETE, SET or COMMENT."]);
  });
  if (badDate) iss.push(["warn", badDate + " date value(s) are not in YYYY/MM/DD, the format Oracle's HDL examples use."]);
  if (!iss.some(x => x[0] === "bad")) iss.unshift(["ok", n + " data line(s) across " + Object.keys(meta).length + " component(s); every line matches its METADATA."]);
  return iss;
};
VW.view("hdl", { title: "HDL Builder", needsData: true, render(el) {
  const P = hdlPresets(); VW._hdlPresets = P;
  el.innerHTML = title("HDL Builder", "Start from an Oracle example, paste your rows as CSV, and save a zipped .dat ready for Import and Load Data. Add components to build one multi-component file.") +
    '<div class="cols split"><section class="panel"><header><h2>Component</h2><span class="meta" id="h-src"></span></header><div class="body">' +
    '<div class="field"><label for="h-preset">Start from</label><select id="h-preset"><option value="">Blank component</option>' + P.map((p, i) => '<option value="' + i + '">' + esc(p.label) + "</option>").join("") + "</select></div>" +
    '<div class="fields"><div class="field"><label for="h-obj">Component</label><input id="h-obj" type="text" class="code"></div><div class="field"><label for="h-act">Action</label><select id="h-act"><option>MERGE</option><option>DELETE</option></select></div><div class="field"><label for="h-sso">Default SourceSystemOwner</label><input id="h-sso" type="text" class="code" value="VANTAGE"></div></div>' +
    '<div class="field"><label for="h-attrs">Attributes (pipe or comma separated)</label><textarea id="h-attrs" rows="3" class="code" spellcheck="false"></textarea></div>' +
    '<div class="field"><label for="h-rows">Rows as CSV, same order as the attributes</label><textarea id="h-rows" rows="6" class="code" spellcheck="false"></textarea><span class="hint">Sample rows come from Oracle examples. Replace them with your data. Blank SourceSystemOwner cells take the default.</span></div>' +
    '<div class="toolbar"><button class="btn" id="h-add">Add component to file</button><span class="grow"></span><label class="check"><input type="checkbox" id="h-purge"> SET PURGE_FUTURE_CHANGES N</label></div>' +
    '<div class="field"><label for="h-file">Business object file</label><input id="h-file" type="text" class="code" value="Worker.dat"></div></div></section>' +
    '<section class="panel"><header><h2 id="h-title">Worker.dat</h2><span class="meta" id="h-blocks"></span></header><div class="body"><div id="h-out"></div><div id="h-iss"></div><div class="toolbar"><button class="btn primary" id="h-zip">Save as zip</button><button class="btn" id="h-clear">Clear added components</button></div></div></section></div>';
  const blocks = [];
  function apply(i) { const p = P[i]; if (!p) { $("#h-obj").value = "Worker"; $("#h-attrs").value = "SourceSystemOwner|SourceSystemId|EffectiveStartDate"; $("#h-rows").value = ",KEY_1,2026/11/01"; $("#h-src").textContent = ""; build(); return; }
    $("#h-obj").value = p.obj; $("#h-attrs").value = p.attrs.join("|"); $("#h-rows").value = p.rows.map(r => r.map(v => /[",]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(",")).join("\n"); $("#h-file").value = p.file;
    $("#h-src").innerHTML = '<a href="' + esc(p.src.docUrl) + '" target="_blank" rel="noopener">Oracle example</a>'; build(); }
  function current() {
    const obj = $("#h-obj").value.trim() || "Object", act = $("#h-act").value; const attrs = $("#h-attrs").value.split(/[|,\n]/).map(s => s.trim()).filter(Boolean);
    const sso = $("#h-sso").value.trim(), ix = attrs.indexOf("SourceSystemOwner");
    const lines = parseCsv($("#h-rows").value).map(v => { v = v.map(x => String(x).trim()); if (ix >= 0 && !v[ix] && sso) v[ix] = sso; return act + "|" + obj + "|" + v.map(x => x.replace(/\|/g, "\\|")).join("|"); });
    return ["METADATA|" + obj + "|" + attrs.join("|")].concat(lines).join("\n");
  }
  function text() { return ($("#h-purge").checked ? "SET PURGE_FUTURE_CHANGES N\n" : "") + blocks.concat([current()]).join("\n"); }
  function build() { const t = text(); $("#h-title").textContent = $("#h-file").value.trim() || "Object.dat"; $("#h-blocks").textContent = (blocks.length + 1) + " component" + (blocks.length ? "s" : "");
    $("#h-out").innerHTML = VW.codeBlock(t, "hdl", $("#h-file").value, { ask: true }); const iss = VW.validateHdl(t);
    if ($("#h-act").value === "DELETE") iss.push(["warn", "DELETE removes records. Load it in a test pod first and keep the MERGE file for rollback."]); $("#h-iss").innerHTML = issues(iss); }
  $("#h-preset").onchange = e => apply(e.target.value);
  $$("input,select,textarea", $(".cols", el)).forEach(x => { if (x.id !== "h-preset") x.addEventListener("input", build); });
  $("#h-add").onclick = () => { blocks.push(current()); VW.toast("Component added. Pick the next one."); build(); };
  $("#h-clear").onclick = () => { blocks.length = 0; build(); };
  $("#h-zip").onclick = async () => { const f = $("#h-file").value.trim() || "Object.dat"; try { const z = await VW.zip([{ name: f, content: text() }]); VW.save(f.replace(/\.dat$/i, "") + ".zip", z); } catch (e) { VW.toast("Could not build the zip: " + e.message); } };
  const w = P.findIndex(p => p.obj === "Worker"); $("#h-preset").value = w >= 0 ? String(w) : ""; apply(w);
  VW._hdlApply = it => { const i = P.findIndex(p => p.src.id === it.id); if (i >= 0) { $("#h-preset").value = String(i); apply(i); } };
}, onShow() { const i = take("hdl"); if (i && VW._hdlApply) VW._hdlApply(i); } });

/* ======================= FBDI ======================= */
VW.view("fbdi", { title: "FBDI & ERP import", needsData: true, render(el) {
  const T = VW.items.filter(i => i.kind === "fbdi" && i.area === "ERP");
  const acct = it => { const m = String(it.notes || "").match(/web service form:?\s*([\w$\/]+\$)/i); if (m) return m[1]; const u = String(it.notes || "").match(/UCM account\s+([a-z]+\/[A-Za-z]+\/[a-z]+)/); return u ? u[1].split("/").join("$/") + "$" : ""; };
  const job = it => { const m = String(it.notes || "").match(/(oracle\/apps\/ess\/[\w\/]+,\w+)/); return m ? m[1] : ""; };
  el.innerHTML = title("FBDI & ERP import", "Zip your FBDI CSV files, build the erpintegrations importBulkData request, and get the ESS polling calls. The zip and the payload are made in your browser.") +
    '<div class="cols split"><section class="panel"><header><h2>Import</h2><span class="meta" id="f-src"></span></header><div class="body">' +
    '<div class="field"><label for="f-t">FBDI template</label><select id="f-t">' + T.map((t, i) => '<option value="' + i + '">' + esc(t.name) + "</option>").join("") + '<option value="x">Other template</option></select></div>' +
    '<div class="fields"><div class="field"><label for="f-acct">Document account</label><input id="f-acct" type="text" class="code"></div><div class="field"><label for="f-zipname">Zip file name</label><input id="f-zipname" type="text" class="code" value="ApInvoices_001.zip"></div></div>' +
    '<div class="field"><label for="f-job">Job name (package,definition)</label><input id="f-job" type="text" class="code"><span class="hint" id="f-jobhint"></span></div>' +
    '<div class="field"><label for="f-params">ParameterList</label><input id="f-params" type="text" class="code" value="#NULL,Vision Operations,#NULL,#NULL,#NULL,#NULL,#NULL,INVOICE GATEWAY,#NULL,#NULL,#NULL,1,#NULL"><span class="hint">Positions follow the import job. Use #NULL for empty positions.</span></div>' +
    '<div class="fields"><div class="field"><label for="f-notify">NotificationCode</label><select id="f-notify"><option value="10">10 — email, any outcome</option><option value="30">30 — email and bell, any outcome</option><option value="12">12 — email on failure</option><option value="00">00 — none</option></select></div><div class="field"><label for="f-cb">CallbackURL</label><input id="f-cb" type="text" class="code" value="#NULL"></div></div>' +
    '<div class="field"><label>CSV files</label><div class="toolbar"><label class="btn" for="f-files">Add CSV files…</label><input type="file" id="f-files" accept=".csv,text/csv" multiple hidden><button class="btn ghost" id="f-sample">Use sample files</button></div><div id="f-list"></div></div></div></section>' +
    '<div class="stack"><section class="panel"><header><h2>Request</h2></header><div class="body" id="f-out"><div class="empty">Add the CSV files generated from the FBDI template to build the zip and payload.</div></div></section>' +
    '<section class="panel"><header><h2>After you submit</h2><span class="meta">Use the ReqstId from the reply</span></header><div class="body"><div class="field" style="max-width:220px"><label for="f-req">Request ID</label><input id="f-req" type="text" class="code" value="14557"></div><div id="f-poll"></div></div></section></div></div>';
  const files = [];
  function loadT() { const v = $("#f-t").value; const t = T[+v];
    if (t) { $("#f-acct").value = acct(t); $("#f-job").value = job(t); $("#f-jobhint").textContent = job(t) ? "From Oracle's example for this template." : "Not in the catalog for this template. Take it from the template's instructions sheet or the FBDI guide.";
      $("#f-src").innerHTML = '<a href="' + esc(t.docUrl) + '" target="_blank" rel="noopener">Template doc</a>'; }
    else { $("#f-acct").value = ""; $("#f-job").value = ""; $("#f-jobhint").textContent = "Enter the job package and definition, comma separated."; $("#f-src").textContent = ""; }
    build(); }
  function list() { $("#f-list").innerHTML = files.length ? '<table class="tbl"><thead><tr><th>File</th><th class="num">Rows</th><th class="num">Columns</th><th></th></tr></thead><tbody>' + files.map((f, i) => { const rows = parseCsv(f.content); const cols = [...new Set(rows.map(r => r.length))]; return '<tr><td class="mono">' + esc(f.name) + '</td><td class="num">' + rows.length + '</td><td class="num">' + (cols.length === 1 ? cols[0] : '<span class="pill warn">' + cols.join(" / ") + "</span>") + '</td><td class="num"><button class="btn ghost sm" data-rm="' + i + '">Remove</button></td></tr>'; }).join("") + "</tbody></table>" : '<div class="empty">No files yet.</div>';
    $$("#f-list [data-rm]").forEach(b => b.onclick = () => { files.splice(+b.dataset.rm, 1); list(); build(); }); }
  let zipB64 = "", zipU8 = null;
  async function build() {
    if (!files.length) { $("#f-out").innerHTML = '<div class="empty">Add the CSV files generated from the FBDI template to build the zip and payload.</div>'; poll(); return; }
    try { zipU8 = await VW.zip(files.map(f => ({ name: f.name, content: f.content }))); zipB64 = VW.b64(zipU8); } catch (e) { $("#f-out").innerHTML = '<div class="empty">Could not build the zip: ' + esc(e.message) + "</div>"; return; }
    const body = { OperationName: "importBulkData", DocumentContent: zipB64, ContentType: "zip", FileName: $("#f-zipname").value.trim(), DocumentAccount: $("#f-acct").value.trim(), JobName: $("#f-job").value.trim(), ParameterList: $("#f-params").value.trim(), CallbackURL: $("#f-cb").value.trim() || "#NULL", NotificationCode: $("#f-notify").value, JobOptions: "InterfaceDetails=1,ImportOption=Y,PurgeOption=Y,ExtractFileType=ALL" };
    const shown = Object.assign({}, body, { DocumentContent: zipB64.slice(0, 48) + "…(" + zipB64.length + " characters)" });
    const iss = [["ok", "Zip built: " + files.length + " file(s), " + zipU8.length.toLocaleString() + " bytes."]];
    files.forEach(f => { const c = [...new Set(parseCsv(f.content).map(r => r.length))]; if (c.length > 1) iss.push(["bad", esc(f.name) + " has rows with different column counts (" + c.join(", ") + "). Regenerate it from the template."]); });
    if (!body.JobName || /</.test(body.JobName)) iss.push(["bad", "JobName is missing."]); if (!body.DocumentAccount) iss.push(["bad", "Document account is missing."]);
    if (!/\.zip$/i.test(body.FileName)) iss.push(["warn", "FileName should end in .zip."]);
    VW.cache.fbdiBody = JSON.stringify(body, null, 2);
    $("#f-out").innerHTML = '<div class="note mono">POST /fscmRestApi/resources/11.13.18.05/erpintegrations<br>Content-Type: application/vnd.oracle.adf.resourceitem+json</div>' + VW.codeBlock(JSON.stringify(shown, null, 2), "json", "importBulkData (content shortened on screen)") + issues(iss) +
      '<div class="toolbar"><button class="btn primary" id="f-savezip">Save zip</button><button class="btn" id="f-savejson">Save full payload</button><button class="btn" id="f-copyjson">Copy full payload</button></div>';
    $("#f-savezip").onclick = () => VW.save(body.FileName || "fbdi.zip", zipU8.slice(0));
    $("#f-savejson").onclick = () => VW.save((body.FileName || "fbdi").replace(/\.zip$/i, "") + "_importBulkData.json", VW.cache.fbdiBody);
    $("#f-copyjson").onclick = () => VW.copy(VW.cache.fbdiBody);
    poll();
  }
  function poll() { const r = $("#f-req").value.trim() || "{requestId}"; const b = "/fscmRestApi/resources/11.13.18.05/erpintegrations?finder=";
    $("#f-poll").innerHTML = VW.codeBlock("# 1 · status (repeat until a final status such as SUCCEEDED)\nGET " + b + "ESSJobStatusRF;requestId=" + r + "\n\n# 2 · child jobs (load, import) as a JSON string in RequestStatus\nGET " + b + "ESSExecutionDetailsRF;requestId=" + r + "\n\n# 3 · logs and output as a base64 zip in DocumentContent\nGET " + b + "ESSJobExecutionDetailsRF;requestId=" + r + ",fileType=ALL", "http", "Polling calls"); }
  $("#f-t").onchange = loadT; ["f-acct", "f-zipname", "f-job", "f-params", "f-cb"].forEach(i => $("#" + i).addEventListener("input", build)); $("#f-notify").onchange = build; $("#f-req").oninput = poll;
  $("#f-files").onchange = async e => { for (const f of e.target.files) files.push({ name: f.name, content: await f.text() }); e.target.value = ""; list(); build(); };
  $("#f-sample").onclick = () => { files.length = 0; files.push({ name: "ApInvoicesInterface.csv", content: "1001,Vision Operations,INV-2026-0042,1250.00,USD,ACME Industrial Supplies,2026/10/28,INVOICE GATEWAY\n" }, { name: "ApInvoiceLinesInterface.csv", content: "1001,1,ITEM,1250.00,Office chairs\n" }); list(); build(); VW.toast("Sample files are illustrative. Generate real ones from the template."); };
  loadT(); list(); poll();
}, onShow() { take("fbdi"); } });

/* ======================= FAST FORMULA ======================= */
VW.view("formula", { title: "Fast Formula", needsData: false, render(el) {
  el.innerHTML = title("Fast Formula", "A commented skeleton with defaults, inputs, logic and the return statement, plus structure checks. Compile it in a test environment to confirm database item names.") +
    '<div class="cols split"><section class="panel"><header><h2>Formula</h2></header><div class="body"><div class="fields"><div class="field"><label for="ff-name">Name</label><input id="ff-name" type="text" class="code" value="XX_GRADE_ELIGIBILITY"></div><div class="field"><label for="ff-type">Formula type</label><select id="ff-type"><option>Participation and Rate Eligibility</option><option>Oracle Payroll</option><option>Extract Rule</option><option>Extract Criteria</option><option>Global Absence Accrual</option><option>Other</option></select></div></div>' +
    '<div class="field"><label for="ff-desc">Description</label><input id="ff-desc" type="text" value="Eligible when the worker\'s grade is in the senior band."></div>' +
    '<div class="field"><label for="ff-dbi">Database items with defaults (NAME : type : default)</label><textarea id="ff-dbi" rows="3" class="code" spellcheck="false">PER_ASG_GRADE_NAME : text : \' \'</textarea></div>' +
    '<div class="field"><label for="ff-in">Inputs (NAME : type)</label><textarea id="ff-in" rows="2" class="code" spellcheck="false"></textarea></div>' +
    '<div class="field"><label for="ff-body">Logic</label><textarea id="ff-body" rows="7" class="code" spellcheck="false">ELIGIBLE = \'N\'\nIF (PER_ASG_GRADE_NAME = \'G7\' OR PER_ASG_GRADE_NAME = \'G8\') THEN\n(\n  ELIGIBLE = \'Y\'\n)</textarea></div>' +
    '<div class="field"><label for="ff-ret">Return variables</label><input id="ff-ret" type="text" class="code" value="ELIGIBLE"></div></div></section>' +
    '<section class="panel"><header><h2>Formula text</h2></header><div class="body"><div id="ff-out"></div><div id="ff-iss"></div></div></section></div>';
  const dflt = (t, d) => d ? d + (t === "date" && !/\(date\)/i.test(d) ? " (date)" : "") : t === "number" ? "0" : t === "date" ? "'1951/01/01 00:00:00' (date)" : "' '";
  const dec = s => s.split("\n").map(l => l.split(":").map(x => x.trim())).filter(a => a[0]);
  function build() {
    const name = $("#ff-name").value.trim().toUpperCase().replace(/\s+/g, "_") || "XX_FORMULA", type = $("#ff-type").value, rets = $("#ff-ret").value.split(",").map(s => s.trim()).filter(Boolean);
    const L = ["/" + "*".repeat(58), " Formula name : " + name, " Formula type : " + type, " Description  : " + $("#ff-desc").value.trim(), " Change log   : " + new Date().toISOString().slice(0, 10) + "  1.0  Initial version", "*".repeat(58) + "/", ""];
    const dbis = dec($("#ff-dbi").value), ins = dec($("#ff-in").value);
    if (dbis.length) { L.push("/* Defaults for database items */"); dbis.forEach(([n, t, d]) => L.push("DEFAULT FOR " + n.toUpperCase() + " IS " + dflt((t || "text").toLowerCase(), d))); L.push(""); }
    if (ins.length) { L.push("/* Inputs */"); ins.forEach(([n, t]) => L.push("DEFAULT FOR " + n.toUpperCase() + " IS " + dflt((t || "number").toLowerCase()))); L.push("INPUTS ARE " + ins.map(([n, t]) => n.toUpperCase() + " (" + (t || "number").toLowerCase() + ")").join(", "), ""); }
    L.push("/* Logic */"); $("#ff-body").value.split("\n").forEach(l => L.push(l)); L.push("", "RETURN " + rets.join(", "));
    const t = L.join("\n"); $("#ff-out").innerHTML = VW.codeBlock(t, "text", name, { ask: true });
    const body = $("#ff-body").value, iss = [];
    if (!rets.length) iss.push(["bad", "Add at least one return variable."]);
    rets.forEach(r => { if (!new RegExp("\\b" + r + "\\s*=", "i").test(body)) iss.push(["warn", "<span class=\"mono\">" + esc(r) + "</span> is returned but never set in the logic."]); });
    if (type === "Participation and Rate Eligibility" && !rets.map(r => r.toUpperCase()).includes("ELIGIBLE")) iss.push(["warn", "Eligibility formulas conventionally return ELIGIBLE."]);
    const o = (body.match(/\(/g) || []).length, c = (body.match(/\)/g) || []).length; if (o !== c) iss.push(["bad", "Parentheses are unbalanced (" + o + " open, " + c + " close)."]);
    if (/\bIF\b/i.test(body) && !/\bTHEN\b/i.test(body)) iss.push(["bad", "IF without THEN."]);
    if (!iss.length) iss.push(["ok", "Structure looks complete. Compile to confirm the database item names."]);
    $("#ff-iss").innerHTML = issues(iss);
  }
  $$("input,select,textarea", el).forEach(x => x.addEventListener("input", build)); build();
}});

/* ======================= XSLT MAPPER ======================= */
VW.view("xslt", { title: "XSLT Mapper", needsData: false, render(el) {
  el.innerHTML = title("XSLT Mapper", "Map fields from a source XML (a BIP or HCM Extract output, an OIC payload) to a target layout, generate XSLT 1.0, and run it here against your sample.") +
    '<div class="cols split"><section class="panel"><header><h2>Mapping</h2></header><div class="body"><div class="fields"><div class="field"><label for="x-mode">Output</label><select id="x-mode"><option value="xml">XML</option><option value="csv">Delimited text</option></select></div><div class="field"><label for="x-root">Target root</label><input id="x-root" type="text" class="code" value="Workers"></div><div class="field"><label for="x-rec">Target record</label><input id="x-rec" type="text" class="code" value="Worker"></div></div>' +
    '<div class="field"><label for="x-each">Repeat for each (XPath)</label><input id="x-each" type="text" class="code" value="/DATA_DS/G_1"></div>' +
    '<div class="field"><label for="x-map">Fields: target = XPath, one per line</label><textarea id="x-map" rows="6" class="code" spellcheck="false">PersonNumber = PERSON_NUMBER\nFullName = concat(FIRST_NAME, \' \', LAST_NAME)\nEmail = EMAIL_ADDRESS\nHireDate = HIRE_DATE</textarea><span class="hint">Any XPath 1.0 expression works, relative to the repeated node.</span></div>' +
    '<div class="field"><label for="x-sample">Sample source XML</label><textarea id="x-sample" rows="9" class="code" spellcheck="false">&lt;DATA_DS&gt;\n  &lt;G_1&gt;&lt;PERSON_NUMBER&gt;1001&lt;/PERSON_NUMBER&gt;&lt;FIRST_NAME&gt;Asha&lt;/FIRST_NAME&gt;&lt;LAST_NAME&gt;Raman&lt;/LAST_NAME&gt;&lt;EMAIL_ADDRESS&gt;asha.raman@vantage-test.invalid&lt;/EMAIL_ADDRESS&gt;&lt;HIRE_DATE&gt;2026-11-01&lt;/HIRE_DATE&gt;&lt;/G_1&gt;\n  &lt;G_1&gt;&lt;PERSON_NUMBER&gt;1002&lt;/PERSON_NUMBER&gt;&lt;FIRST_NAME&gt;Karthik&lt;/FIRST_NAME&gt;&lt;LAST_NAME&gt;Selvam&lt;/LAST_NAME&gt;&lt;EMAIL_ADDRESS&gt;karthik.selvam@vantage-test.invalid&lt;/EMAIL_ADDRESS&gt;&lt;HIRE_DATE&gt;2026-11-03&lt;/HIRE_DATE&gt;&lt;/G_1&gt;\n&lt;/DATA_DS&gt;</textarea></div></div></section>' +
    '<section class="panel"><header><h2>Stylesheet and test</h2></header><div class="body"><div id="x-out"></div><div id="x-res"></div><div id="x-iss"></div><div class="toolbar"><button class="btn primary" id="x-save">Save .xsl as zip</button></div></div></section></div>';
  const xa = s => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  let xsl = "";
  function build() {
    const mode = $("#x-mode").value, root = $("#x-root").value.trim() || "Root", rec = $("#x-rec").value.trim() || "Record", each = $("#x-each").value.trim() || "/*/*";
    const maps = $("#x-map").value.split("\n").map(l => { const i = l.indexOf("="); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : null; }).filter(Boolean);
    if (mode === "xml") xsl = '<?xml version="1.0" encoding="UTF-8"?>\n<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">\n  <xsl:output method="xml" indent="yes"/>\n  <xsl:template match="/">\n    <' + root + '>\n      <xsl:for-each select="' + xa(each) + '">\n        <' + rec + ">\n" + maps.map(([t, x]) => "          <" + t + '><xsl:value-of select="' + xa(x) + '"/></' + t + ">").join("\n") + "\n        </" + rec + ">\n      </xsl:for-each>\n    </" + root + ">\n  </xsl:template>\n</xsl:stylesheet>";
    else xsl = '<?xml version="1.0" encoding="UTF-8"?>\n<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">\n  <xsl:output method="text" encoding="UTF-8"/>\n  <xsl:template match="/">\n    <xsl:text>' + maps.map(m => m[0]).join(",") + '&#10;</xsl:text>\n    <xsl:for-each select="' + xa(each) + '">\n' + maps.map(([t, x], i) => '      <xsl:value-of select="' + xa(x) + '"/>' + (i < maps.length - 1 ? "<xsl:text>,</xsl:text>" : "")).join("\n") + "\n      <xsl:text>&#10;</xsl:text>\n    </xsl:for-each>\n  </xsl:template>\n</xsl:stylesheet>";
    $("#x-out").innerHTML = VW.codeBlock(xsl, "xsl", "transform.xsl", { ask: true });
    const iss = []; let out = "";
    try {
      const p = new DOMParser(); const sx = p.parseFromString(xsl, "application/xml"); const src = p.parseFromString($("#x-sample").value, "application/xml");
      if (sx.querySelector("parsererror")) throw new Error("The stylesheet is not well-formed. Check the target names.");
      if (src.querySelector("parsererror")) throw new Error("The sample XML is not well-formed.");
      if (!window.XSLTProcessor) throw new Error("This browser cannot run XSLT.");
      const pr = new XSLTProcessor(); pr.importStylesheet(sx); const res = pr.transformToDocument(src);
      out = mode === "xml" ? new XMLSerializer().serializeToString(res) : (res.documentElement ? res.documentElement.textContent : "");
      const n = src.evaluate("count(" + each + ")", src, null, XPathResult.NUMBER_TYPE, null).numberValue;
      iss.push(n ? ["ok", "Stylesheet ran against the sample: " + n + " record(s) produced."] : ["warn", "The repeat path matched no nodes in the sample."]);
    } catch (e) { iss.push(["bad", esc(e.message)]); }
    iss.push(["warn", "This test uses the browser's XSLT 1.0 engine. OIC and BI Publisher support more functions; test the final map there."]);
    $("#x-res").innerHTML = out ? VW.codeBlock(out, mode === "xml" ? "xml" : "text", "Output from the sample") : ""; $("#x-iss").innerHTML = issues(iss);
  }
  $$("input,select,textarea", el).forEach(x => x.addEventListener("input", build));
  $("#x-save").onclick = async () => { try { VW.save("transform_xsl.zip", await VW.zip([{ name: "transform.xsl", content: xsl }])); } catch (e) { VW.toast(e.message); } };
  build();
}});

/* ======================= REDWOOD REVIEW ======================= */
const RW = [
  ["Redwood conformance", ["Page starts from a Redwood template or pattern; extensions keep the base page structure", "The JET or Redwood component made for the job (button, input with label), one component family per job", "Look changed only through JET CSS variables or public classes; no oj- class overrides", "No !important, no font-family in page CSS, rem units, namespaced custom classes", "Hard-coded hex colours and pixel spacing mapped to theme variables or utility classes"]],
  ["Accessibility", ["Text contrast 4.5:1, large text and UI parts 3:1", "Every field has a visible label; required uses the component's required property", "Keyboard: visible focus, logical order, Esc closes dialogs, no traps", "Headings in order; images and icon buttons have accessible names"]],
  ["Responsive", ["1440, 1024 and 390 px screenshots reviewed", "No horizontal scroll at any width", "Tables and forms usable on a phone; touch targets large enough"]],
  ["Robustness", ["Loading, empty and error states on every data region", "Long text and translated labels do not break the layout; RTL checked if multilingual", "Validation messages on the field; button disabled while saving", "REST errors (401, 403, 404, 500, timeout) show a clear message and a retry, never raw JSON"]],
  ["Performance & data", ["Fusion REST calls use onlyData, fields, limit/offset and q", "No duplicate calls on page load; large data paged or virtualised", "No console errors or binding warnings"]]
];
VW.view("redwood", { title: "Redwood review", needsData: false, render(el) {
  el.innerHTML = title("Redwood review", "Score a Redwood or VBS page on five dimensions, log findings by severity, and export the report in the team's format. Do not paste personal data into findings.") +
    '<div class="cols split"><section class="panel"><header><h2>Checklist</h2><span class="meta num" id="w-total"></span></header><div class="body"><div class="fields"><div class="field"><label for="w-page">Page or flow</label><input id="w-page" type="text" value="Worker search (Redwood App UI)"></div><div class="field"><label for="w-env">Environment</label><input id="w-env" type="text" value="TEST pod, 26A"></div></div><div id="w-dims" class="stack" style="gap:18px"></div></div></section>' +
    '<div class="stack"><section class="panel"><header><h2>Findings</h2><span class="meta num" id="w-sev"></span></header><div class="body"><div class="fields"><div class="field"><label for="w-s">Severity</label><select id="w-s"><option value="P0">P0 Blocking</option><option value="P1" selected>P1 Major</option><option value="P2">P2 Minor</option><option value="P3">P3 Polish</option></select></div><div class="field" style="grid-column:span 2"><label for="w-t">Title</label><input id="w-t" type="text" placeholder="e.g. Save button has no focus state"></div></div>' +
    '<div class="fields"><div class="field"><label for="w-where">Where</label><input id="w-where" type="text" placeholder="file:line, region, width"></div><div class="field"><label for="w-fix">Fix</label><input id="w-fix" type="text" placeholder="the concrete change"></div></div><div><button class="btn" id="w-add">Add finding</button></div><div id="w-list"></div></div></section>' +
    '<section class="panel"><header><h2>Report</h2></header><div class="body"><div id="w-rep"></div><div class="toolbar"><button class="btn primary" id="w-save">Save report (.md)</button></div></div></section></div></div>';
  const st = RW.map(d => d[1].map(() => "untested")); const finds = [];
  $("#w-dims").innerHTML = RW.map(([d, cs], di) => '<div><div class="toolbar"><b>' + d + '</b><span class="grow"></span><span class="note num" id="w-ds' + di + '"></span></div><table class="tbl"><tbody>' + cs.map((c, ci) => "<tr><td>" + esc(c) + '</td><td class="num" style="width:220px"><span class="seg" role="group" aria-label="' + esc(c) + '">' + ["pass", "fail", "untested"].map(v => '<button data-d="' + di + '" data-c="' + ci + '" data-v="' + v + '" aria-pressed="' + (v === "untested") + '">' + ({ pass: "Pass", fail: "Fail", untested: "Not tested" }[v]) + "</button>").join("") + "</span></td></tr>").join("") + "</tbody></table></div>").join("");
  $$("#w-dims .seg button").forEach(b => b.onclick = () => { st[b.dataset.d][b.dataset.c] = b.dataset.v; $$('#w-dims .seg button[data-d="' + b.dataset.d + '"][data-c="' + b.dataset.c + '"]').forEach(x => x.setAttribute("aria-pressed", String(x === b))); rep(); });
  const score = di => { const t = st[di].filter(v => v !== "untested"); return t.length ? Math.round(4 * t.filter(v => v === "pass").length / t.length) : null; };
  const band = t => t >= 18 ? "ready to ship" : t >= 14 ? "fix P1s first" : t >= 10 ? "significant work" : "rework";
  function rep() {
    const sc = RW.map((_, i) => score(i)); sc.forEach((s, i) => $("#w-ds" + i).textContent = s == null ? "not scored" : s + " / 4");
    const all = sc.every(s => s != null), tot = sc.reduce((a, s) => a + (s || 0), 0);
    $("#w-total").textContent = all ? tot + " / 20 · " + band(tot) : "Score each dimension to total";
    const cnt = ["P0", "P1", "P2", "P3"].map(p => p + " " + finds.filter(f => f.s === p).length).join(" · "); $("#w-sev").textContent = cnt;
    $("#w-list").innerHTML = finds.length ? '<div class="list">' + finds.map((f, i) => '<button data-f="' + i + '"><span class="t">[' + f.s + "] " + esc(f.t) + '</span><span class="s">' + esc(f.where || "—") + " · Fix: " + esc(f.fix || "—") + '</span><span class="r">Remove</span></button>').join("") + "</div>" : '<div class="empty">No findings logged.</div>';
    $$("#w-list [data-f]").forEach(b => b.onclick = () => { finds.splice(+b.dataset.f, 1); rep(); });
    const md = "# Redwood UI Review: " + $("#w-page").value + " (" + $("#w-env").value + ", " + new Date().toISOString().slice(0, 10) + ")\n\n**Score:** " + (all ? tot + "/20 (" + band(tot) + ")" : "incomplete") + " · **Issues:** " + cnt + "\n\n## Scores\n| Dimension | Score | Failed checks |\n|---|---|---|\n" +
      RW.map(([d, cs], i) => "| " + d + " | " + (sc[i] == null ? "not scored" : sc[i] + "/4") + " | " + (cs.filter((c, j) => st[i][j] === "fail").join("; ") || "—") + " |").join("\n") +
      "\n\n## Findings\n" + (finds.length ? finds.map(f => "### [" + f.s + "] " + f.t + "\n- **Where:** " + (f.where || "—") + "\n- **Fix:** " + (f.fix || "—") + "\n- **Retest:** repeat the check at the same widths").join("\n\n") : "None logged.") +
      "\n\n## Not tested\n" + (RW.flatMap(([d, cs], i) => cs.filter((c, j) => st[i][j] === "untested").map(c => "- " + d + ": " + c)).join("\n") || "- Nothing") + "\n";
    VW.cache.rwmd = md; $("#w-rep").innerHTML = VW.codeBlock(md, "text", "review.md");
  }
  $("#w-add").onclick = () => { const t = $("#w-t").value.trim(); if (!t) { $("#w-t").focus(); return; } finds.push({ s: $("#w-s").value, t, where: $("#w-where").value.trim(), fix: $("#w-fix").value.trim() }); finds.sort((a, b) => a.s.localeCompare(b.s)); $("#w-t").value = $("#w-where").value = $("#w-fix").value = ""; rep(); };
  ["w-page", "w-env"].forEach(i => $("#" + i).oninput = rep);
  $("#w-save").onclick = () => VW.save("redwood-review.md", VW.cache.rwmd);
  rep();
}});

/* ======================= UTILITIES ======================= */
VW.view("utils", { title: "Utilities", needsData: false, render(el) {
  el.innerHTML = title("Utilities", "Small conversions you need mid-integration. Everything runs in your browser.") +
    '<div class="cols even"><section class="panel"><header><h2>JSON format and validate</h2></header><div class="body"><textarea id="u-json" rows="8" class="code" spellcheck="false">{"PersonNumber":"1001","names":[{"FirstName":"Asha","LastName":"Raman","LegislationCode":"IN"}]}</textarea><div class="toolbar"><button class="btn primary" id="u-fmt">Format</button><button class="btn" id="u-min">Minify</button><span class="note" id="u-js"></span></div></div></section>' +
    '<section class="panel"><header><h2>Base64</h2></header><div class="body"><textarea id="u-b64" rows="5" class="code" spellcheck="false">METADATA|Worker|SourceSystemOwner|SourceSystemId</textarea><div class="toolbar"><button class="btn primary" id="u-enc">Encode</button><button class="btn" id="u-dec">Decode</button><label class="btn" for="u-file">Encode a file…</label><input type="file" id="u-file" hidden><span class="note" id="u-bs"></span></div><p class="note">For DocumentContent in erpintegrations, attachments and HDL over REST.</p></div></section>' +
    '<section class="panel"><header><h2>Date formats</h2></header><div class="body"><div class="field" style="max-width:240px"><label for="u-date">Date</label><input id="u-date" type="text" class="code" value="2026-11-01"></div><div id="u-dates"></div></div></section>' +
    '<section class="panel"><header><h2>q filter builder</h2></header><div class="body"><div class="field"><label for="u-qf">One condition per line (Field = value)</label><textarea id="u-qf" rows="3" class="code" spellcheck="false">PersonNumber = 1001\nLastName = Raman</textarea></div><label class="check"><input type="checkbox" id="u-or"> Join with OR</label><div id="u-q"></div></div></section></div>';
  $("#u-fmt").onclick = () => { try { $("#u-json").value = JSON.stringify(JSON.parse($("#u-json").value), null, 2); $("#u-js").textContent = "Valid JSON"; } catch (e) { $("#u-js").textContent = "Invalid: " + e.message; } };
  $("#u-min").onclick = () => { try { $("#u-json").value = JSON.stringify(JSON.parse($("#u-json").value)); $("#u-js").textContent = "Minified"; } catch (e) { $("#u-js").textContent = "Invalid: " + e.message; } };
  $("#u-enc").onclick = () => { $("#u-b64").value = VW.b64(new TextEncoder().encode($("#u-b64").value)); $("#u-bs").textContent = "Encoded as UTF-8"; };
  $("#u-dec").onclick = () => { try { const s = atob($("#u-b64").value.trim()); $("#u-b64").value = new TextDecoder().decode(Uint8Array.from(s, c => c.charCodeAt(0))); $("#u-bs").textContent = "Decoded"; } catch (_) { $("#u-bs").textContent = "That is not valid Base64."; } };
  $("#u-file").onchange = async e => { const f = e.target.files[0]; if (!f) return; $("#u-b64").value = VW.b64(new Uint8Array(await f.arrayBuffer())); $("#u-bs").textContent = f.name + " · " + Math.round(f.size / 1024) + " KB"; };
  function dates() { const raw = $("#u-date").value.trim().replace(/\//g, "-"); const d = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(raw + "T00:00:00Z") : new Date(raw);
    if (isNaN(d)) { $("#u-dates").innerHTML = '<div class="empty">Enter a date such as 2026-11-01.</div>'; return; }
    const p = n => String(n).padStart(2, "0"), y = d.getUTCFullYear(), m = p(d.getUTCMonth() + 1), dd = p(d.getUTCDate()), mon = "JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC".split(" ")[d.getUTCMonth()];
    $("#u-dates").innerHTML = VW.codeBlock(["HDL               " + y + "/" + m + "/" + dd, "REST date         " + y + "-" + m + "-" + dd, "REST timestamp    " + y + "-" + m + "-" + dd + "T00:00:00+00:00", "Fast Formula      '" + y + "/" + m + "/" + dd + " 00:00:00' (date)", "SQL literal       DATE '" + y + "-" + m + "-" + dd + "'", "DD-MON-YYYY       " + dd + "-" + mon + "-" + y, "Epoch ms (UTC)    " + d.getTime()].join("\n"), "text", "Formats"); }
  function qb() { const j = $("#u-or").checked ? " or " : " and ";
    const parts = $("#u-qf").value.split("\n").map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/^(\w+)\s*(=|!=|<>|>=|<=|>|<|LIKE)\s*(.+)$/i); return m ? m[1] + " " + m[2].toUpperCase().replace("!=", "<>") + " '" + m[3].trim().replace(/^'|'$/g, "").replace(/'/g, "''") + "'" : null; }).filter(Boolean);
    $("#u-q").innerHTML = parts.length ? VW.codeBlock("q=" + parts.join(j) + "\n\n# URL-encoded\nq=" + encodeURIComponent(parts.join(j)), "text", "q parameter") : '<div class="empty">Write conditions like PersonNumber = 1001.</div>'; }
  $("#u-date").oninput = dates; $("#u-qf").oninput = qb; $("#u-or").onchange = qb; dates(); qb();
}});
})();
