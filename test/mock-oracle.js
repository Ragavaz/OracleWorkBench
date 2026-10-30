// A small stand-in for a Fusion pod and an OIC 3 instance, used by the automated tests.
// It checks auth headers and the request shapes the workbench sends, and answers with Oracle-like JSON.
import http from "node:http";

export function startMock() {
  const seen = [];
  const srv = http.createServer((req, res) => {
    const ch = []; req.on("data", (c) => ch.push(c)); req.on("end", () => {
      const body = Buffer.concat(ch).toString("utf8"); const u = new URL(req.url, "http://x"); const p = u.pathname;
      seen.push({ method: req.method, path: p, query: Object.fromEntries(u.searchParams), headers: req.headers, body });
      const j = (s, o, h) => { res.writeHead(s, { "Content-Type": "application/json", ...(h || {}) }); res.end(JSON.stringify(o)); };
      const auth = req.headers.authorization || "";
      if (p === "/oauth2/v1/token") return /^Basic /.test(auth) && /grant_type=client_credentials/.test(body) ? j(200, { access_token: "tok-123", expires_in: 3600 }) : j(401, { error: "invalid_client" });
      if (p.startsWith("/ic/api/")) {
        if (auth !== "Bearer tok-123") return j(401, { title: "Unauthorized" });
        if (p === "/ic/api/integration/v1/integrations" && req.method === "GET") return j(200, { items: [{ id: "HCM_WORKER_SYNC|01.00.0000", code: "HCM_WORKER_SYNC", version: "01.00.0000", name: "HCM Worker Sync", status: "ACTIVATED" }, { id: "AP_INVOICE_LOAD|01.02.0000", code: "AP_INVOICE_LOAD", version: "01.02.0000", name: "AP Invoice Load", status: "CONFIGURED" }], totalResults: 2, hasMore: false });
        if (p === "/ic/api/integration/v1/monitoring/instances") return j(200, { items: [{ id: "ins-1", integrationId: "HCM_WORKER_SYNC", status: "FAILED", creationDate: "2026-10-29T03:10:00Z" }], totalResults: 1 });
        if (p === "/ic/api/integration/v1/monitoring/errors") return j(200, { items: [{ id: "19", integrationId: "HCM_WORKER_SYNC", recoverable: true, errorMessage: "Fault from HCM: invalid PersonNumber" }], totalResults: 1 });
        if (p === "/ic/api/integration/v1/monitoring/errors/resubmit" && req.method === "POST") return j(202, { "recovery-job-id": "rj-77", "accepted-ids": JSON.parse(body).ids });
        if (p.startsWith("/ic/api/integration/v1/integrations/") && req.headers["x-http-method-override"] === "PATCH") return j(200, { status: JSON.parse(body).status });
        if (/\/connections\/[^/]+\/test$/.test(p)) return j(200, { status: "CONFIGURED" });
        return j(404, { title: "Not found" });
      }
      if (auth !== "Basic " + Buffer.from("integ.user:Secret#1").toString("base64")) return j(401, { title: "Unauthorized" });
      if (p === "/hcmRestApi/resources/11.13.18.05/workers" && req.method === "GET") return j(200, { items: [{ PersonId: 300000012345678, PersonNumber: "1001" }], count: 1, hasMore: false, limit: 1, offset: 0 });
      if (p === "/hcmRestApi/resources/11.13.18.05/workers/describe") return j(200, { Resources: { workers: { attributes: [{ name: "PersonNumber", type: "string" }] } } });
      if (p === "/hcmRestApi/resources/11.13.18.05/workers" && req.method === "POST") return j(201, { PersonId: 300000099999999, PersonNumber: "1002" });
      if (p.endsWith("/dataLoadDataSets/action/uploadFile")) { const b = JSON.parse(body); return b.content && b.fileName ? j(200, { result: { ContentId: "UCMFA00123" } }) : j(400, { title: "Bad" }); }
      if (p.endsWith("/dataLoadDataSets/action/createFileDataSet")) { const b = JSON.parse(body); return b.contentId === "UCMFA00123" ? j(200, { result: { RequestId: 900123 } }) : j(400, { title: "contentId not found" }); }
      if (p.endsWith("/dataLoadDataSets/900123")) return j(200, { RequestId: 900123, DataSetStatusCode: "COMPLETED", businessObjects: [{ BusinessObjectName: "Worker", LoadSuccessCount: 2, LoadErrorCount: 0 }], messages: [] });
      if (p === "/hcmRestApi/atomservlet/employee/newhire") { res.writeHead(200, { "Content-Type": "application/atom+xml" }); return res.end('<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Hire 1001</title><updated>2026-10-29T01:00:00.000Z</updated><content type="text">{"Context":[{"PersonNumber":"1001","DMLOperation":"Insert"}]}</content></entry></feed>'); }
      if (p === "/fscmRestApi/resources/11.13.18.05/erpintegrations" && req.method === "POST") { const b = JSON.parse(body); return b.OperationName === "importBulkData" ? j(201, { ...b, DocumentContent: null, ReqstId: "14557" }) : j(400, {}); }
      if (p === "/fscmRestApi/resources/11.13.18.05/erpintegrations" && req.method === "GET") {
        const f = u.searchParams.get("finder") || "";
        if (f.startsWith("ESSJobStatusRF")) return j(200, { items: [{ ReqstId: "14557", RequestStatus: "SUCCEEDED" }] });
        if (f.startsWith("ESSExecutionDetailsRF")) return j(200, { items: [{ RequestStatus: JSON.stringify({ JOBS: { JOBNAME: "Load Interface File for Import", REQUESTID: "14557", STATUS: "SUCCEEDED", CHILD: [{ JOBNAME: "Import Payables Invoices", REQUESTID: "14558", STATUS: "WARNING" }] } }) }] });
        if (f.startsWith("ESSJobExecutionDetailsRF")) return j(200, { items: [{ DocumentContent: "UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==", ContentType: "zip" }] });
      }
      if (p === "/xmlpserver/services/ExternalReportWSSService") {
        const ok = /<wsse:Password[^>]*>Secret#1</.test(body) && /reportAbsolutePath>\/Custom\/AP_Aging.xdo</.test(body);
        res.writeHead(ok ? 200 : 500, { "Content-Type": "text/xml" });
        return res.end(ok ? '<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><ns2:runReportResponse xmlns:ns2="http://xmlns.oracle.com/oxp/service/PublicReportService"><ns2:runReportReturn><ns2:reportBytes>' + Buffer.from("SUPPLIER,CURRENT,DAYS_31_60\nNorthwind,24000,6500\n").toString("base64") + "</ns2:reportBytes><ns2:reportContentType>text/plain</ns2:reportContentType></ns2:runReportReturn></ns2:runReportResponse></env:Body></env:Envelope>" : "<env:Envelope><env:Body><env:Fault><faultstring>Report not found</faultstring></env:Fault></env:Body></env:Envelope>");
      }
      if (p === "/bpm/api/4.0/tasks") return j(200, { items: [{ number: 215362, title: "Promotion for Asha Raman", assignedDate: "2026-10-28T10:00:00Z", priority: 3, identificationKey: "HCM-TX-881" }], totalResults: 1 });
      if (p === "/bpm/api/4.0/tasks/215362" && req.method === "PUT") return JSON.parse(body).action.id === "APPROVE" ? j(200, { number: 215362, outcome: "APPROVE", titlePrefix: "Completed" }) : j(400, {});
      return j(404, { title: "Not found", path: p });
    });
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok({ srv, port: srv.address().port, seen })));
}
