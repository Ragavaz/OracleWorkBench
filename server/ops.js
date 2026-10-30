// Vantage Workbench Local — operations the workbench can run against a pod.
// Each op: { id, title, area, envKind, write, validate(p), plan(p, env) -> [{label, req}], after? }
// "write" ops wait for approval; reads run immediately and are still logged.
const V = "11.13.18.05";
const ACTION = "application/vnd.oracle.adf.action+json";
const ITEM = "application/vnd.oracle.adf.resourceitem+json";
const req = (o) => o;
const must = (p, keys) => { const miss = keys.filter((k) => p[k] === undefined || p[k] === null || String(p[k]).trim() === ""); if (miss.length) throw Object.assign(new Error("Missing: " + miss.join(", ")), { status: 400 }); };
const xmlEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const safePath = (p) => { const s = String(p || "").trim(); if (!/^\/[\w/.{}%:;=,-]*$/.test(s) || s.includes("..")) throw Object.assign(new Error("Path must start with / and contain no spaces or '..'."), { status: 400 }); return s; };

export const OPS = {
  /* ---------------- Fusion REST (HCM, ERP, any resource) ---------------- */
  "fusion.rest": {
    title: "Fusion REST request", area: "REST", envKind: "fusion",
    write: (p) => (p.method || "GET").toUpperCase() !== "GET",
    plan(p) {
      const method = String(p.method || "GET").toUpperCase(); if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) throw Object.assign(new Error("Method must be GET, POST, PATCH or DELETE."), { status: 400 });
      const headers = {}; if (p.frameworkVersion) headers["REST-Framework-Version"] = String(p.frameworkVersion);
      if (p.effectiveOf) headers["Effective-Of"] = String(p.effectiveOf);
      if (method === "POST" || method === "PATCH") headers["Content-Type"] = p.contentType || ITEM;
      let body; if (p.body !== undefined && p.body !== "" && method !== "GET" && method !== "DELETE") { body = typeof p.body === "string" ? JSON.parse(p.body) : p.body; }
      return [{ label: method + " " + p.path, req: req({ method, path: safePath(p.path), query: p.query || {}, headers, body }) }];
    },
  },
  "fusion.describe": {
    title: "Describe a resource", area: "REST", envKind: "fusion", write: false,
    plan(p) { const path = safePath(p.path).replace(/\/describe$/, "") + "/describe"; return [{ label: "GET " + path, req: { method: "GET", path, headers: { "REST-Framework-Version": "4" } } }]; },
  },
  "fusion.test": {
    title: "Test connection", area: "Environment", envKind: "fusion", write: false,
    plan() { return [{ label: "Read one worker", req: { method: "GET", path: "/hcmRestApi/resources/" + V + "/workers", query: { limit: 1, onlyData: "true", fields: "PersonNumber" } } }]; },
  },

  /* ---------------- HCM Data Loader ---------------- */
  "hcm.hdl.load": {
    title: "Load an HDL zip", area: "HCM", envKind: "fusion", write: true,
    validate(p) { must(p, ["fileName", "contentBase64", "dataSetName"]); if (!/\.zip$/i.test(p.fileName)) throw Object.assign(new Error("fileName must end in .zip"), { status: 400 }); },
    plan(p) {
      return [
        { label: "Upload " + p.fileName, req: { method: "POST", path: "/hcmRestApi/resources/" + V + "/dataLoadDataSets/action/uploadFile", headers: { "Content-Type": ACTION }, body: { fileName: p.fileName, content: p.contentBase64, fileEncryption: "NONE" } } },
        { label: "Create data set " + p.dataSetName + " (" + (p.fileAction || "IMPORT_AND_LOAD") + ")", req: { method: "POST", path: "/hcmRestApi/resources/" + V + "/dataLoadDataSets/action/createFileDataSet", headers: { "Content-Type": ACTION }, body: { contentId: "{contentId from step 1}", dataSetName: p.dataSetName, fileAction: p.fileAction || "IMPORT_AND_LOAD" } } },
      ];
    },
    // the response keys are not documented: search the result object for the content id / request id
    chain(stepIndex, prevResponse, nextReq) {
      if (stepIndex !== 1) return nextReq;
      const id = findKey(prevResponse.json, /^content[_ ]?id$/i) || findKey(prevResponse.json, /contentid/i);
      if (!id) throw Object.assign(new Error("Upload succeeded but no content ID was found in the response. See the logged response."), { code: "shape" });
      return { ...nextReq, body: { ...nextReq.body, contentId: id } };
    },
    summarize(steps) { const last = steps[steps.length - 1]; return { requestId: last && last.response && findKey(last.response.json, /^request[_ ]?id$/i) }; },
  },
  "hcm.hdl.status": {
    title: "HDL data set status", area: "HCM", envKind: "fusion", write: false,
    plan(p) { must(p, ["requestId"]); return [{ label: "Data set " + p.requestId, req: { method: "GET", path: "/hcmRestApi/resources/" + V + "/dataLoadDataSets/" + encodeURIComponent(p.requestId), query: { expand: "businessObjects,messages", onlyData: "true" } } }]; },
  },
  "hcm.atom": {
    title: "Read an HCM Atom feed", area: "HCM", envKind: "fusion", write: false,
    plan(p) {
      const col = String(p.collection || "newhire"); if (!/^[a-z]+$/.test(col)) throw Object.assign(new Error("Unknown feed collection"), { status: 400 });
      return [{ label: "Feed employee/" + col, req: { method: "GET", path: "/hcmRestApi/atomservlet/employee/" + col, accept: "application/atom+xml", query: { "updated-min": p.updatedMin, "page-size": p.pageSize || 25, page: p.page || 1, orderBy: "updated:asc" } } }];
    },
  },

  /* ---------------- ERP integrations ---------------- */
  "erp.fbdi.import": {
    title: "FBDI importBulkData", area: "ERP", envKind: "fusion", write: true,
    validate(p) { must(p, ["body"]); const b = p.body; ["OperationName", "DocumentContent", "FileName", "DocumentAccount", "JobName"].forEach((k) => { if (!b[k]) throw Object.assign(new Error("body." + k + " is required"), { status: 400 }); }); },
    plan(p) { return [{ label: "importBulkData " + p.body.FileName, req: { method: "POST", path: "/fscmRestApi/resources/" + V + "/erpintegrations", headers: { "Content-Type": ITEM }, body: p.body } }]; },
    summarize(steps) { const j = steps[0] && steps[0].response && steps[0].response.json; return { requestId: j && (j.ReqstId || j.reqstId) }; },
  },
  "erp.ess.status": {
    title: "ESS job status", area: "ERP", envKind: "fusion", write: false,
    plan(p) { must(p, ["requestId"]); return [{ label: "Status of " + p.requestId, req: { method: "GET", path: "/fscmRestApi/resources/" + V + "/erpintegrations", query: { finder: "ESSJobStatusRF;requestId=" + p.requestId, onlyData: "true" } } }]; },
  },
  "erp.ess.details": {
    title: "ESS child jobs", area: "ERP", envKind: "fusion", write: false,
    plan(p) { must(p, ["requestId"]); return [{ label: "Execution details of " + p.requestId, req: { method: "GET", path: "/fscmRestApi/resources/" + V + "/erpintegrations", query: { finder: "ESSExecutionDetailsRF;requestId=" + p.requestId, onlyData: "true" } } }]; },
  },
  "erp.ess.download": {
    title: "Download ESS logs and output", area: "ERP", envKind: "fusion", write: false,
    plan(p) { must(p, ["requestId"]); const ft = ["ALL", "LOG", "OUT"].includes(p.fileType) ? p.fileType : "ALL"; return [{ label: "Files of " + p.requestId, req: { method: "GET", path: "/fscmRestApi/resources/" + V + "/erpintegrations", query: { finder: "ESSJobExecutionDetailsRF;requestId=" + p.requestId + ",fileType=" + ft, onlyData: "true" } } }]; },
  },
  "erp.bip.run": {
    title: "Run a BI Publisher report", area: "ERP", envKind: "fusion", write: false,
    validate(p) { must(p, ["reportPath"]); },
    plan(p, env, secrets) {
      const params = (p.params || []).filter((x) => x && x.name);
      const env_ = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:pub="http://xmlns.oracle.com/oxp/service/PublicReportService">' +
        '<soapenv:Header><wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"><wsse:UsernameToken>' +
        "<wsse:Username>" + xmlEsc(env.auth.username || "") + '</wsse:Username><wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">' + xmlEsc((secrets && secrets.password) || "") + "</wsse:Password>" +
        "</wsse:UsernameToken></wsse:Security></soapenv:Header><soapenv:Body><pub:runReport><pub:reportRequest>" +
        "<pub:attributeFormat>" + xmlEsc(p.format || "csv") + "</pub:attributeFormat><pub:reportAbsolutePath>" + xmlEsc(p.reportPath) + "</pub:reportAbsolutePath>" +
        (params.length ? "<pub:parameterNameValues>" + params.map((x) => "<pub:item><pub:name>" + xmlEsc(x.name) + "</pub:name><pub:values><pub:item>" + xmlEsc(x.value || "") + "</pub:item></pub:values></pub:item>").join("") + "</pub:parameterNameValues>" : "") +
        "<pub:sizeOfDataChunkDownload>-1</pub:sizeOfDataChunkDownload></pub:reportRequest><pub:appParams></pub:appParams></pub:runReport></soapenv:Body></soapenv:Envelope>";
      return [{ label: "runReport " + p.reportPath, req: { method: "POST", path: "/xmlpserver/services/ExternalReportWSSService", accept: "text/xml", headers: { "Content-Type": "text/xml;charset=UTF-8", SOAPAction: "runReport" }, body: env_, timeoutMs: 300_000 } }];
    },
    summarize(steps) {
      const r = steps[0] && steps[0].response; const t = (r && r.text) || "";
      const fault = (t.match(/<(?:\w+:)?faultstring[^>]*>([\s\S]*?)<\//) || [])[1];
      const b64 = (t.match(/<(?:\w+:)?reportBytes[^>]*>([\s\S]*?)<\//) || [])[1];
      const ct = (t.match(/<(?:\w+:)?reportContentType[^>]*>([\s\S]*?)<\//) || [])[1];
      if (r) r.text = b64 ? t.replace(b64, "…(" + b64.length + " base64 characters, decoded below)") : t;
      if (fault) return { fault };
      if (!b64) return { fault: "No reportBytes in the reply." };
      const buf = Buffer.from(b64.replace(/\s+/g, ""), "base64");
      const textual = /csv|xml|text|html|json/i.test(ct || "") || /^[\x09\x0a\x0d\x20-\x7e -￿]*$/.test(buf.subarray(0, 2000).toString("utf8"));
      return { contentType: ct, bytes: buf.length, text: textual ? buf.toString("utf8").slice(0, 2_000_000) : undefined, base64: textual ? undefined : buf.toString("base64") };
    },
  },

  /* ---------------- Worklist (BPM) ---------------- */
  "bpm.tasks": {
    title: "List approval tasks", area: "Worklist", envKind: "fusion", write: false,
    plan(p) { return [{ label: "Tasks " + (p.assignment || "MY_AND_GROUP"), req: { method: "GET", path: "/bpm/api/4.0/tasks", query: { applicationContext: p.applicationContext, assignment: p.assignment || "MY_AND_GROUP", status: p.status || "ASSIGNED", keyword: p.keyword, limit: p.limit || 25, offset: p.offset || 0, orderBy: "assignedDate:desc", totalResults: "true" } } }]; },
  },
  "bpm.task.get": {
    title: "Read a task", area: "Worklist", envKind: "fusion", write: false,
    plan(p) { must(p, ["id"]); return [{ label: "Task " + p.id, req: { method: "GET", path: "/bpm/api/4.0/tasks/" + encodeURIComponent(p.id) } }]; },
  },
  "bpm.task.action": {
    title: "Approve or reject a task", area: "Worklist", envKind: "fusion", write: true,
    validate(p) { must(p, ["id", "action"]); if (!["APPROVE", "REJECT"].includes(p.action)) throw Object.assign(new Error("action must be APPROVE or REJECT"), { status: 400 }); },
    plan(p) { return [{ label: p.action + " task " + p.id, req: { method: "PUT", path: "/bpm/api/4.0/tasks/" + encodeURIComponent(p.id), headers: { "Content-Type": "application/json" }, body: { action: { id: p.action } } } }]; },
  },

  /* ---------------- OIC 3 ---------------- */
  "oic.test": { title: "Test connection", area: "Environment", envKind: "oic", write: false, plan() { return [{ label: "List one integration", req: { method: "GET", path: "/ic/api/integration/v1/integrations", query: { limit: 1 } } }]; } },
  "oic.integrations": {
    title: "List integrations", area: "OIC", envKind: "oic", write: false,
    plan(p) { const q = [p.name ? "name: /" + String(p.name).replace(/[^\w-]/g, "") + "/" : "", p.status ? "status: '" + p.status + "'" : ""].filter(Boolean).join(", ");
      return [{ label: "Integrations", req: { method: "GET", path: "/ic/api/integration/v1/integrations", query: { q: q ? "{" + q + "}" : undefined, orderBy: "name", limit: p.limit || 100, offset: p.offset || 0 } } }]; },
  },
  "oic.instances": {
    title: "Integration instances", area: "OIC", envKind: "oic", write: false,
    plan(p) { const tw = ["1h", "6h", "1d", "2d", "3d", "RETENTIONPERIOD"].includes(p.timewindow) ? p.timewindow : "1d";
      const q = ["timewindow: '" + tw + "'", p.status ? "status: '" + p.status + "'" : "", p.code ? "code: '" + String(p.code).replace(/'/g, "") + "'" : ""].filter(Boolean).join(", ");
      return [{ label: "Instances " + tw, req: { method: "GET", path: "/ic/api/integration/v1/monitoring/instances", query: { q: "{" + q + "}", orderBy: "lastupdateddate", limit: p.limit || 50 } } }]; },
  },
  "oic.errors": {
    title: "Recoverable errors", area: "OIC", envKind: "oic", write: false,
    plan(p) { const tw = ["1h", "6h", "1d", "2d", "3d", "RETENTIONPERIOD"].includes(p.timewindow) ? p.timewindow : "1d";
      return [{ label: "Errors " + tw, req: { method: "GET", path: "/ic/api/integration/v1/monitoring/errors", query: { q: "{timewindow: '" + tw + "'" + (p.recoverable === false ? "" : ", recoverable: 'true'") + "}", limit: p.limit || 50 } } }]; },
  },
  "oic.resubmit": {
    title: "Resubmit failed messages", area: "OIC", envKind: "oic", write: true,
    validate(p) { if (!Array.isArray(p.ids) || !p.ids.length) throw Object.assign(new Error("ids must be a non-empty list"), { status: 400 }); },
    plan(p) { return [{ label: "Resubmit " + p.ids.length + " error(s)", req: { method: "POST", path: "/ic/api/integration/v1/monitoring/errors/resubmit", headers: { "Content-Type": "application/json" }, body: { ids: p.ids.map(String) } } }]; },
  },
  "oic.activate": {
    title: "Activate or deactivate an integration", area: "OIC", envKind: "oic", write: true,
    validate(p) { must(p, ["id", "status"]); if (!["ACTIVATED", "CONFIGURED"].includes(p.status)) throw Object.assign(new Error("status must be ACTIVATED or CONFIGURED"), { status: 400 }); },
    plan(p) { return [{ label: (p.status === "ACTIVATED" ? "Activate " : "Deactivate ") + p.id, req: { method: "POST", path: "/ic/api/integration/v1/integrations/" + encodeURIComponent(p.id), headers: { "Content-Type": "application/json", "X-HTTP-Method-Override": "PATCH" }, body: p.status === "CONFIGURED" ? { status: "CONFIGURED", stopScheduleForDeactivation: "true" } : { status: "ACTIVATED" } } }]; },
  },
  "oic.connection.test": {
    title: "Test an OIC connection", area: "OIC", envKind: "oic", write: false,
    plan(p) { must(p, ["id"]); return [{ label: "Test connection " + p.id, req: { method: "POST", path: "/ic/api/integration/v1/connections/" + encodeURIComponent(p.id) + "/test", headers: { "Content-Type": "application/json" } } }]; },
  },
};

export function findKey(obj, re, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 5) return undefined;
  for (const [k, v] of Object.entries(obj)) { if (re.test(k) && (typeof v === "string" || typeof v === "number")) return String(v); }
  for (const v of Object.values(obj)) { const f = findKey(v, re, depth + 1); if (f) return f; }
  return undefined;
}
