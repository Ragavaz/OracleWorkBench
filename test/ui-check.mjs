// Drives the real UI against the mock pod with Playwright (dev check, not shipped as a requirement).
import { startMock } from "./mock-oracle.js";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
process.env.VW_ALLOW_HTTP = "1";
const { createServer } = await import("../server/index.js");
const { chromium } = await import(process.env.PW || "playwright");
const OUT = process.argv[2];
const mock = await startMock(); const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "vw-ui-"));
const app = createServer({ dataDir, port: 4377 }); await app.listen();
const base = "http://localhost:4377"; const host = "http://127.0.0.1:" + mock.port;
const post = (p, b) => fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json", "X-VW": "1" }, body: JSON.stringify(b) }).then(r => r.json());
await post("/api/envs", { name: "Vision TEST", kind: "fusion", tier: "TEST", host, auth: { username: "integ.user", password: "Secret#1" } });
await post("/api/envs", { name: "OIC TEST", kind: "oic", tier: "TEST", host, oicInstance: "vision-oic", auth: { tokenUrl: host + "/oauth2/v1/token", clientId: "cid", clientSecret: "csecret" } });
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.route("**/fonts.googleapis.com/**", r => r.fulfill({ body: "", contentType: "text/css" }));
const p = await ctx.newPage(); const errs = [];
p.on("pageerror", e => errs.push("pageerror " + e.message)); p.on("console", m => { if (["error", "assert"].includes(m.type())) errs.push(m.text()); });
const shot = n => p.screenshot({ path: OUT + "/" + n + ".png" });
const log = (...a) => console.log(...a);
await p.goto(base + "/#home"); await p.waitForTimeout(1200); await shot("01-home");
// environments
await p.goto(base + "/#envs"); await p.waitForTimeout(800); await p.click("[data-test]"); await p.waitForTimeout(800); log("env test:", await p.textContent("td[id^=chk-]")); await shot("02-envs");
// REST GET
await p.goto(base + "/#rest"); await p.waitForTimeout(900); await p.click("#r-send"); await p.waitForTimeout(900); log("rest GET:", (await p.textContent("#r-resp")).slice(0, 80)); await shot("03-rest-get");
// REST POST -> approval dialog
await p.selectOption("#r-method", "POST"); await p.waitForTimeout(200); await p.fill("#r-body", '{"names":[{"LastName":"Raman"}]}'); await p.click("#r-send"); await p.waitForSelector("dialog.approval"); await p.waitForTimeout(400); await shot("04-approval");
await p.click("#apOk"); await p.waitForTimeout(1000); log("rest POST:", (await p.textContent("#r-resp")).slice(0, 80));
// HDL load
await p.goto(base + "/#hdl"); await p.waitForTimeout(900); await p.click("#h-load"); await p.waitForSelector("dialog.approval"); await p.click("#apOk"); await p.waitForTimeout(1800); log("after HDL:", p.url(), (await p.textContent("#ld-out")).slice(0, 120)); await shot("05-loads");
// Atom
await p.click("#at-go"); await p.waitForTimeout(800); log("atom:", (await p.textContent("#at-out")).slice(0, 80));
// FBDI
await p.goto(base + "/#fbdi"); await p.waitForTimeout(800); await p.click("#f-sample"); await p.waitForTimeout(800); await p.click("#f-submit"); await p.waitForSelector("dialog.approval"); await p.click("#apOk"); await p.waitForTimeout(1500); log("after FBDI:", p.url(), (await p.textContent("#es-out")).slice(0, 80));
await p.click("#es-dt"); await p.waitForTimeout(800); log("children:", (await p.textContent("#es-out")).slice(0, 120));
await p.fill("#bp-path", "/Custom/AP_Aging.xdo"); await p.click("#bp-go"); await p.waitForTimeout(900); log("bip:", (await p.textContent("#bp-out")).slice(0, 120)); await shot("06-erpjobs");
// OIC
await p.goto(base + "/#oic"); await p.waitForTimeout(1800); log("oic ints:", await p.textContent("#oc-ic"), "errs:", await p.textContent("#oc-ec"));
await p.check(".oc-sel"); await p.click("#oc-rs"); await p.waitForSelector("dialog.approval"); await shot("07-oic-approval"); await p.click("#apOk"); await p.waitForTimeout(1500); await shot("07b-oic");
// Worklist
await p.goto(base + "/#worklist"); await p.waitForTimeout(600); await p.click("#wl-go"); await p.waitForTimeout(900); log("tasks:", await p.textContent("#wl-c"));
await p.click('[data-a="APPROVE"]'); await p.waitForSelector("dialog.approval"); await p.click("#apCancel"); await p.waitForTimeout(500);
// Runs
await p.goto(base + "/#runs"); await p.waitForTimeout(1000); log("runs rows:", await p.locator("#rn-list tr[data-id]").count(), "waiting badge:", await p.textContent('[data-count="runs"]'));
await p.click("#rn-tabs [data-s=awaiting_approval]"); await p.waitForTimeout(300); await p.click("#rn-list tr[data-id]"); await p.waitForTimeout(700); await shot("08-runs");
// delivery run ledger (offline)
await p.goto(base + "/#home"); await p.waitForTimeout(500); await p.fill("#h-req", "Import AP invoices from a supplier portal CSV with FBDI and a callback"); await p.click("#h-start"); await p.waitForTimeout(1500); await shot("09-run-wait"); await p.click("#ap-yes"); await p.waitForTimeout(1200); await shot("10-run-receipt");
// palette + dark + phone
await p.keyboard.press("Control+k"); await p.waitForTimeout(200); await p.keyboard.type("resubmit"); await p.waitForTimeout(400); await shot("11-palette"); await p.keyboard.press("Escape");
await p.click("#themeBtn"); await p.waitForTimeout(500); await p.goto(base + "/#oic"); await p.waitForTimeout(1500); await shot("12-dark-oic");
await p.setViewportSize({ width: 390, height: 844 }); await p.goto(base + "/#runs"); await p.waitForTimeout(1000); log("phone overflow:", await p.evaluate(() => document.documentElement.scrollWidth)); await shot("13-phone-runs");
log("ERRS", JSON.stringify(errs));
log("secrets in data dir plain?", fs.readFileSync(path.join(dataDir, "environments.json"), "utf8").includes("Secret#1"));
await b.close(); app.server.close(); mock.srv.close();
