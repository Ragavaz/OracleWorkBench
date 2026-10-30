import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { startMock } from "./mock-oracle.js";

process.env.VW_ALLOW_HTTP = "1";
const { createServer } = await import("../server/index.js");
let mock, app, base, fusion, oic, prod;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vw-test-"));
const api = async (m, p, body, hdr = { "X-VW": "1" }) => { const r = await fetch(base + p, { method: m, headers: { "Content-Type": "application/json", ...hdr }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, j: await r.json() }; };

before(async () => {
  mock = await startMock();
  app = createServer({ dataDir, port: 4399 }); await app.listen(); base = "http://127.0.0.1:4399";
  const host = "http://127.0.0.1:" + mock.port;
  fusion = (await api("POST", "/api/envs", { name: "Vision TEST", kind: "fusion", tier: "TEST", host, auth: { username: "integ.user", password: "Secret#1" } })).j;
  prod = (await api("POST", "/api/envs", { name: "Vision PROD", kind: "fusion", tier: "PROD", host, auth: { username: "integ.user", password: "Secret#1" } })).j;
  oic = (await api("POST", "/api/envs", { name: "OIC TEST", kind: "oic", tier: "TEST", host, oicInstance: "vision-oic", auth: { tokenUrl: host + "/oauth2/v1/token", clientId: "cid", clientSecret: "csecret", scope: "urn:opc:resource:consumer::all" } })).j;
});
after(() => { app.server.close(); mock.srv.close(); });

test("secrets are encrypted at rest and never returned", async () => {
  const raw = fs.readFileSync(path.join(dataDir, "environments.json"), "utf8");
  assert.ok(!raw.includes("Secret#1") && !raw.includes("csecret"));
  const list = (await api("GET", "/api/envs")).j;
  assert.equal(list.length, 3); assert.ok(list.every((e) => !("password" in e.auth) && !("clientSecret" in e.auth)));
  assert.equal(list[0].auth.has_password, true);
});
test("writes without the X-VW header or from another origin are refused", async () => {
  assert.equal((await api("POST", "/api/envs", { name: "x" }, {})).status, 403);
  assert.equal((await api("POST", "/api/envs", { name: "x" }, { "X-VW": "1", Origin: "https://evil.example" })).status, 403);
});
test("connection tests", async () => {
  assert.equal((await api("POST", "/api/envs/" + fusion.id + "/test")).j.status, "succeeded");
  const o = (await api("POST", "/api/envs/" + oic.id + "/test")).j; assert.equal(o.status, "succeeded");
  assert.ok(mock.seen.some((s) => s.path.startsWith("/ic/api/") && s.query.integrationInstance === "vision-oic"));
});
test("REST GET runs immediately; POST waits for approval", async () => {
  const g = (await api("POST", "/api/runs", { envId: fusion.id, op: "fusion.rest", params: { method: "GET", path: "/hcmRestApi/resources/11.13.18.05/workers", query: { q: "PersonNumber='1001'", onlyData: "true" }, frameworkVersion: 4 } })).j;
  assert.equal(g.status, "succeeded"); assert.equal(g.steps[0].response.json.items[0].PersonNumber, "1001");
  assert.ok(!JSON.stringify(g).includes("Secret#1"));
  const w = (await api("POST", "/api/runs", { envId: fusion.id, op: "fusion.rest", params: { method: "POST", path: "/hcmRestApi/resources/11.13.18.05/workers", body: { names: [{ LastName: "Raman" }] } } })).j;
  assert.equal(w.status, "awaiting_approval"); assert.ok(!mock.seen.some((s) => s.method === "POST" && s.path.endsWith("/workers")));
  const a = (await api("POST", "/api/runs/" + w.id + "/approve", {})).j; assert.equal(a.status, "succeeded"); assert.equal(a.result.status, 201);
});
test("PROD writes need the environment name typed", async () => {
  const w = (await api("POST", "/api/runs", { envId: prod.id, op: "bpm.task.action", params: { id: 215362, action: "APPROVE" } })).j;
  assert.equal((await api("POST", "/api/runs/" + w.id + "/approve", { confirm: "yes" })).status, 400);
  assert.equal((await api("POST", "/api/runs/" + w.id + "/approve", { confirm: "Vision PROD" })).j.status, "succeeded");
});
test("HDL load chains upload -> createFileDataSet and status reads back", async () => {
  const w = (await api("POST", "/api/runs", { envId: fusion.id, op: "hcm.hdl.load", params: { fileName: "Worker.zip", contentBase64: "UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==", dataSetName: "NEWHIRE_TEST" } })).j;
  const a = (await api("POST", "/api/runs/" + w.id + "/approve", {})).j; assert.equal(a.status, "succeeded"); assert.equal(a.result.requestId, "900123");
  const s = (await api("POST", "/api/runs", { envId: fusion.id, op: "hcm.hdl.status", params: { requestId: "900123" } })).j; assert.equal(s.steps[0].response.json.DataSetStatusCode, "COMPLETED");
  assert.ok(!JSON.stringify(a.steps[0].request).includes("UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==") || a.steps[0].request.body.content.length < 100);
});
test("Atom feed returns XML text", async () => {
  const r = (await api("POST", "/api/runs", { envId: fusion.id, op: "hcm.atom", params: { collection: "newhire", updatedMin: "2026-10-28T00:00:00.000Z" } })).j;
  assert.equal(r.status, "succeeded"); assert.match(r.steps[0].response.text, /<entry>/);
});
test("FBDI import, ESS status, details and download", async () => {
  const w = (await api("POST", "/api/runs", { envId: fusion.id, op: "erp.fbdi.import", params: { body: { OperationName: "importBulkData", DocumentContent: "UEsF", ContentType: "zip", FileName: "Ap.zip", DocumentAccount: "fin$/payables$/import$", JobName: "oracle/apps/ess/financials/payables/invoices/transactions,APXIIMPT", ParameterList: "#NULL", CallbackURL: "#NULL", NotificationCode: "10" } } })).j;
  const a = (await api("POST", "/api/runs/" + w.id + "/approve", {})).j; assert.equal(a.result.requestId, "14557");
  for (const op of ["erp.ess.status", "erp.ess.details", "erp.ess.download"]) assert.equal((await api("POST", "/api/runs", { envId: fusion.id, op, params: { requestId: "14557" } })).j.status, "succeeded");
});
test("BIP runReport decodes the report and masks the password in the log", async () => {
  const r = (await api("POST", "/api/runs", { envId: fusion.id, op: "erp.bip.run", params: { reportPath: "/Custom/AP_Aging.xdo", format: "csv" } })).j;
  assert.equal(r.status, "succeeded"); assert.match(r.result.text, /Northwind,24000/);
  assert.ok(!JSON.stringify(r).includes("Secret#1"));
  const bad = (await api("POST", "/api/runs", { envId: fusion.id, op: "erp.bip.run", params: { reportPath: "/Custom/Missing.xdo" } })).j;
  assert.equal(bad.status, "failed");
});
test("OIC list, instances, errors, resubmit and activate", async () => {
  assert.equal((await api("POST", "/api/runs", { envId: oic.id, op: "oic.integrations", params: {} })).j.steps[0].response.json.items.length, 2);
  assert.equal((await api("POST", "/api/runs", { envId: oic.id, op: "oic.instances", params: { status: "FAILED" } })).j.status, "succeeded");
  assert.equal((await api("POST", "/api/runs", { envId: oic.id, op: "oic.errors", params: {} })).j.status, "succeeded");
  const rs = (await api("POST", "/api/runs", { envId: oic.id, op: "oic.resubmit", params: { ids: ["19"] } })).j; assert.equal(rs.status, "awaiting_approval");
  assert.equal((await api("POST", "/api/runs/" + rs.id + "/approve", {})).j.result.status, 202);
  const ac = (await api("POST", "/api/runs", { envId: oic.id, op: "oic.activate", params: { id: "AP_INVOICE_LOAD|01.02.0000", status: "ACTIVATED" } })).j;
  assert.equal((await api("POST", "/api/runs/" + ac.id + "/approve", {})).j.status, "succeeded");
  assert.ok(mock.seen.some((s) => s.path === "/ic/api/integration/v1/integrations/AP_INVOICE_LOAD%7C01.02.0000"));
});
test("operations refuse the wrong environment kind and foreign hosts", async () => {
  assert.equal((await api("POST", "/api/runs", { envId: fusion.id, op: "oic.integrations", params: {} })).status, 400);
  assert.equal((await api("POST", "/api/runs", { envId: fusion.id, op: "fusion.rest", params: { method: "GET", path: "https://evil.example/x" } })).status, 400);
});
test("run history lists every run", async () => {
  const l = (await api("GET", "/api/runs")).j; assert.ok(l.length >= 15); assert.ok(l.every((r) => r.id && r.status));
});
