// Vantage Workbench Local — encrypted environment registry and run log.
// Secrets are encrypted with AES-256-GCM using a 32-byte key kept in the data folder
// (or VW_MASTER_KEY, 64 hex chars). Nothing secret is ever returned to the browser.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

export function openStore(dataDir) {
  const dir = dataDir || process.env.VW_DATA_DIR || path.join(os.homedir(), ".vantage-workbench");
  fs.mkdirSync(path.join(dir, "runs"), { recursive: true });
  const keyFile = path.join(dir, "master.key");
  let key;
  if (process.env.VW_MASTER_KEY && /^[0-9a-f]{64}$/i.test(process.env.VW_MASTER_KEY)) key = Buffer.from(process.env.VW_MASTER_KEY, "hex");
  else {
    if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
    key = Buffer.from(fs.readFileSync(keyFile, "utf8").trim(), "hex");
  }
  const seal = (text) => {
    const iv = crypto.randomBytes(12); const c = crypto.createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([c.update(String(text), "utf8"), c.final()]);
    return "v1:" + iv.toString("base64") + ":" + c.getAuthTag().toString("base64") + ":" + enc.toString("base64");
  };
  const open = (blob) => {
    if (!blob) return "";
    const [v, iv, tag, enc] = String(blob).split(":"); if (v !== "v1") throw new Error("Unknown secret format");
    const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64")); d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(enc, "base64")), d.final()]).toString("utf8");
  };

  const envFile = path.join(dir, "environments.json");
  const readEnvs = () => { try { return JSON.parse(fs.readFileSync(envFile, "utf8")); } catch { return []; } };
  const writeEnvs = (list) => { fs.writeFileSync(envFile + ".tmp", JSON.stringify(list, null, 2), { mode: 0o600 }); fs.renameSync(envFile + ".tmp", envFile); };

  const SECRET_FIELDS = ["password", "clientSecret"];
  const publicEnv = (e) => {
    const a = e.auth || {}; const out = { ...e, auth: { ...a } };
    SECRET_FIELDS.forEach((f) => { out.auth["has_" + f] = !!a[f]; delete out.auth[f]; });
    return out;
  };

  const envs = {
    list: () => readEnvs().map(publicEnv),
    get: (id) => readEnvs().find((e) => e.id === id) || null,
    secrets: (e) => { const a = e.auth || {}; const s = {}; SECRET_FIELDS.forEach((f) => { if (a[f]) s[f] = open(a[f]); }); return s; },
    save(input) {
      const list = readEnvs();
      const id = input.id || "env_" + crypto.randomBytes(4).toString("hex");
      const prev = list.find((e) => e.id === id);
      const tier = ["DEV", "TEST", "PROD"].includes(input.tier) ? input.tier : "TEST";
      const kind = input.kind === "oic" ? "oic" : "fusion";
      const host = String(input.host || "").trim().replace(/\/+$/, "");
      if (!/^https:\/\/[\w.-]+(:\d+)?$/.test(host) && !(process.env.VW_ALLOW_HTTP === "1" && /^http:\/\/127\.0\.0\.1:\d+$/.test(host))) throw Object.assign(new Error("Host must be https://<host> with no path."), { status: 400 });
      const ia = input.auth || {}; const pa = (prev && prev.auth) || {};
      const auth = kind === "oic"
        ? { type: "oauth", tokenUrl: String(ia.tokenUrl || pa.tokenUrl || "").trim(), clientId: String(ia.clientId || pa.clientId || "").trim(), scope: String(ia.scope || pa.scope || "").trim(), clientSecret: ia.clientSecret ? seal(ia.clientSecret) : pa.clientSecret }
        : { type: "basic", username: String(ia.username || pa.username || "").trim(), password: ia.password ? seal(ia.password) : pa.password };
      const env = { id, name: String(input.name || "Unnamed").trim().slice(0, 60), kind, tier, host, auth, sourceSystemOwner: String(input.sourceSystemOwner || "").trim(), oicInstance: String(input.oicInstance || "").trim(), updatedAt: new Date().toISOString() };
      writeEnvs(prev ? list.map((e) => (e.id === id ? env : e)) : list.concat(env));
      return publicEnv(env);
    },
    remove(id) { writeEnvs(readEnvs().filter((e) => e.id !== id)); },
  };

  const runs = {
    file: (id) => path.join(dir, "runs", id.replace(/[^\w-]/g, "") + ".json"),
    save(run) { fs.writeFileSync(runs.file(run.id), JSON.stringify(run, null, 2)); return run; },
    get(id) { try { return JSON.parse(fs.readFileSync(runs.file(id), "utf8")); } catch { return null; } },
    list(limit = 100) {
      return fs.readdirSync(path.join(dir, "runs")).filter((f) => f.endsWith(".json"))
        .map((f) => { try { const r = JSON.parse(fs.readFileSync(path.join(dir, "runs", f), "utf8")); return { id: r.id, op: r.op, title: r.title, envId: r.envId, envName: r.envName, tier: r.tier, status: r.status, write: r.write, createdAt: r.createdAt, finishedAt: r.finishedAt, httpStatus: r.result && r.result.status, ms: r.result && r.result.ms }; } catch { return null; } })
        .filter(Boolean).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, limit);
    },
  };
  return { dir, envs, runs };
}
