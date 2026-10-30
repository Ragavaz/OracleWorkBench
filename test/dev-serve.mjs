// Starts the mock pod and the workbench with two seeded environments (for UI checks and demos).
import { startMock } from "./mock-oracle.js";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
process.env.VW_ALLOW_HTTP = "1";
const { createServer } = await import("../server/index.js");
const port = Number(process.argv[2] || 4388);
const mock = await startMock(); const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vw-dev-"));
const app = createServer({ dataDir, port }); await app.listen();
const host = "http://127.0.0.1:" + mock.port; const base = "http://localhost:" + port;
const post = (p, b) => fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json", "X-VW": "1" }, body: JSON.stringify(b) }).then(r => r.json());
await post("/api/envs", { name: "Vision TEST", kind: "fusion", tier: "TEST", host, auth: { username: "integ.user", password: "Secret#1" } });
await post("/api/envs", { name: "OIC TEST", kind: "oic", tier: "TEST", host, oicInstance: "vision-oic", auth: { tokenUrl: host + "/oauth2/v1/token", clientId: "cid", clientSecret: "csecret" } });
console.log("dev server on " + base + " (mock pod " + host + ")");
