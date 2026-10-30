// Vantage Workbench Local — server. Node 22+, no dependencies.
// Binds to 127.0.0.1 only. Serves the workbench UI from ../public and the /api routes.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { openStore } from "./store.js";
import { OPS } from "./ops.js";
import { call, redactRequest } from "./oracle.js";

const VERSION = "3.0.0";
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".md": "text/markdown; charset=utf-8" };

export function createServer({ dataDir, port } = {}) {
  const store = openStore(dataDir);
  const PORT = Number(port || process.env.VW_PORT || 4300);
  const allowedOrigins = new Set(["http://localhost:" + PORT, "http://127.0.0.1:" + PORT]);

  const send = (res, status, obj, extra) => { const b = JSON.stringify(obj); res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...(extra || {}) }); res.end(b); };
  const fail = (res, e) => send(res, e.status || 400, { error: e.message || String(e), code: e.code || "error" });
  const readBody = (req) => new Promise((ok, no) => { const ch = []; let n = 0;
    req.on("data", (c) => { n += c.length; if (n > 60 * 1024 * 1024) { no(Object.assign(new Error("Request too large (60 MB max)."), { status: 413 })); req.destroy(); } else ch.push(c); });
    req.on("end", () => { if (!ch.length) return ok({}); try { ok(JSON.parse(Buffer.concat(ch).toString("utf8"))); } catch { no(Object.assign(new Error("Body is not JSON."), { status: 400 })); } }); });

  async function execute(run, env, params) {
    const op = OPS[run.op]; const secrets = store.envs.secrets(env);
    const steps = op.plan(params, env, secrets); run.status = "running"; run.startedAt = new Date().toISOString(); run.steps = []; store.runs.save(run);
    try {
      let prev = null;
      for (let i = 0; i < steps.length; i++) {
        let r = steps[i].req; if (op.chain && i > 0) r = op.chain(i, prev, r);
        const rec = { label: steps[i].label, request: redactRequest(env, r) };
        run.steps.push(rec); store.runs.save(run);
        const resp = await call(env, secrets, r); rec.response = resp; prev = resp; store.runs.save(run);
        if (!resp.ok) throw Object.assign(new Error(steps[i].label + " returned HTTP " + resp.status + "."), { code: "http", status: resp.status });
      }
      run.result = op.summarize ? op.summarize(run.steps) : {};
      const last = run.steps[run.steps.length - 1];
      run.result.status = last.response.status; run.result.ms = run.steps.reduce((s, x) => s + (x.response ? x.response.ms : 0), 0);
      run.status = run.result.fault ? "failed" : "succeeded"; if (run.result.fault) run.error = run.result.fault;
    } catch (e) {
      run.status = "failed"; run.error = e.message; run.errorCode = e.code || "error"; const last = run.steps[run.steps.length - 1];
      run.result = { status: last && last.response ? last.response.status : undefined, ms: run.steps.reduce((s, x) => s + (x.response ? x.response.ms : 0), 0) };
    }
    run.finishedAt = new Date().toISOString(); store.runs.save(run); return run;
  }

  async function api(req, res, url) {
    const m = req.method, p = url.pathname;
    if (m !== "GET") {
      if (req.headers["x-vw"] !== "1") return send(res, 403, { error: "Missing X-VW header.", code: "csrf" });
      const o = req.headers.origin; if (o && !allowedOrigins.has(o)) return send(res, 403, { error: "Cross-origin request refused.", code: "csrf" });
    }
    if (p === "/api/health") return send(res, 200, { ok: true, version: VERSION, dataDir: store.dir, envs: store.envs.list().length, ops: Object.keys(OPS).length, node: process.version });
    if (p === "/api/ops" && m === "GET") return send(res, 200, Object.entries(OPS).map(([id, o]) => ({ id, title: o.title, area: o.area, envKind: o.envKind, write: typeof o.write === "function" ? "depends" : o.write })));
    if (p === "/api/envs" && m === "GET") return send(res, 200, store.envs.list());
    if (p === "/api/envs" && m === "POST") return send(res, 200, store.envs.save(await readBody(req)));
    let mm;
    if ((mm = p.match(/^\/api\/envs\/([\w-]+)$/)) && m === "DELETE") { store.envs.remove(mm[1]); return send(res, 200, { ok: true }); }
    if ((mm = p.match(/^\/api\/envs\/([\w-]+)\/test$/)) && m === "POST") {
      const env = store.envs.get(mm[1]); if (!env) return send(res, 404, { error: "Environment not found." });
      const run = newRun(env, env.kind === "oic" ? "oic.test" : "fusion.test", {}); return send(res, 200, await execute(run, env, {}));
    }
    if (p === "/api/runs" && m === "GET") return send(res, 200, store.runs.list(Number(url.searchParams.get("limit")) || 100));
    if (p === "/api/runs" && m === "POST") {
      const b = await readBody(req); const op = OPS[b.op]; if (!op) return send(res, 400, { error: "Unknown operation " + b.op });
      const env = store.envs.get(b.envId); if (!env) return send(res, 400, { error: "Pick an environment first.", code: "env" });
      if (op.envKind !== env.kind) return send(res, 400, { error: op.title + " needs " + (op.envKind === "oic" ? "an OIC" : "a Fusion") + " environment; " + env.name + " is " + env.kind + "." });
      const params = b.params || {}; if (op.validate) op.validate(params);
      const run = newRun(env, b.op, params, b.title);
      const write = typeof op.write === "function" ? op.write(params) : op.write; run.write = !!write;
      run.plan = op.plan(params, env, null).map((s) => ({ label: s.label, request: redactRequest(env, s.req) }));
      if (!write) return send(res, 200, await execute(run, env, params));
      run.status = "awaiting_approval"; run.params = params; store.runs.save(run); return send(res, 200, run);
    }
    if ((mm = p.match(/^\/api\/runs\/([\w-]+)$/)) && m === "GET") { const r = store.runs.get(mm[1]); return r ? send(res, 200, strip(r)) : send(res, 404, { error: "Run not found." }); }
    if ((mm = p.match(/^\/api\/runs\/([\w-]+)\/(approve|cancel)$/)) && m === "POST") {
      const run = store.runs.get(mm[1]); if (!run) return send(res, 404, { error: "Run not found." });
      if (run.status !== "awaiting_approval") return send(res, 409, { error: "This run is " + run.status + ", not waiting for approval." });
      const b = await readBody(req);
      if (mm[2] === "cancel") { run.status = "cancelled"; run.finishedAt = new Date().toISOString(); delete run.params; store.runs.save(run); return send(res, 200, strip(run)); }
      const env = store.envs.get(run.envId); if (!env) return send(res, 400, { error: "The run's environment no longer exists." });
      if (env.tier === "PROD" && String(b.confirm || "").trim() !== env.name) return send(res, 400, { error: "Type the environment name '" + env.name + "' to approve a PROD change.", code: "confirm" });
      run.approvedAt = new Date().toISOString(); run.approvedBy = b.approver ? String(b.approver).slice(0, 60) : "local user";
      const params = run.params; delete run.params; return send(res, 200, strip(await execute(run, env, params)));
    }
    return send(res, 404, { error: "No such API route." });
  }
  const strip = (r) => { const c = { ...r }; delete c.params; return c; };
  function newRun(env, op, params, title) {
    const id = "RUN-" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();
    return { id, op, title: title || OPS[op].title, envId: env.id, envName: env.name, tier: env.tier, kind: env.kind, status: "planned", createdAt: new Date().toISOString(), write: false };
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    try {
      if (url.pathname.startsWith("/api/")) return await api(req, res, url);
      let f = decodeURIComponent(url.pathname); if (f === "/") f = "/index.html";
      const full = path.join(ROOT, path.normalize(f)); if (!full.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(full, (err, buf) => {
        if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
        let body = buf; const ext = path.extname(full);
        if (f === "/index.html" && !/^<!doctype/i.test(buf.toString("utf8", 0, 20))) body = Buffer.concat([Buffer.from('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body data-local="1">'), buf, Buffer.from("</body></html>")]);
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" }); res.end(body);
      });
    } catch (e) { fail(res, e); }
  });
  return { server, store, PORT, listen: () => new Promise((ok) => server.listen(PORT, "127.0.0.1", () => ok(server))) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createServer();
  app.listen().then(() => {
    console.log("Vantage Workbench Local " + VERSION + " running at http://localhost:" + app.PORT);
    console.log("Data folder: " + app.store.dir + "  (environments are encrypted with master.key in that folder)");
  });
}
