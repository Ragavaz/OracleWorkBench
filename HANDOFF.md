# HANDOFF — Vantage Workbench

> **Note to any AI assistant or teammate picking this up**
> Ragavan works with more than one AI assistant and may switch between them for this project. Whoever continues the work must, **at the end of every working session**:
> 1. Add a dated entry to **§9 Activity log** (what changed, which files, test result).
> 2. Update **§7 Open items** and **§8 Next moves** so they match reality.
> 3. Keep `README.md` (this folder) and `vantage-workbench-local/README.md` correct.
> Do not delete earlier log entries. Read this whole file before editing code.

Last updated: 31 Oct 2026 · Current version: **Vantage Workbench Local 3.0.0**

Repository: https://github.com/Ragavaz/OracleWorkBench (private) · branches `main` (stable) and `Development_v1` (ongoing work). Local copy: `R:\Claude\OracleWings REV\OracleWorkBench`.

---

## 1. Goal

Give Ragavan (Associate Technical Consultant, Cloud Vantage Solutions) one reliable, hands-on bench for Oracle Cloud technical delivery, so a new project in these areas starts fast:

- Fusion **HCM** (REST, HDL, Atom feeds, Fast Formula, BIP SQL)
- Fusion **ERP/SCM** (REST, FBDI via erpintegrations, ESS jobs, BI Publisher)
- **OIC 3** (monitor, resubmit, activate, connection tests)
- **VBS / VBCS / Redwood** (REST test bench, action-chain snippets, Redwood review)
- **BPM Worklist** approvals
- **OCI**: catalog only. Backend support is **deliberately postponed** (Ragavan's decision, 29 Oct).

Inspiration: oraclewings.ai (workspaces per Oracle artefact) and wingspi.ai (plan → approve → execute → receipt). Our product is an **original implementation**; never copy their code, copy or assets.

## 2. How Ragavan wants to work (apply always)

- Explain purpose → how it works → how to implement and test. Step-by-step, with prerequisites, sample code, validation, troubleshooting.
- Separate **verified** facts from **assumptions** and **version-dependent** behaviour. Never invent Oracle table names, REST resources, attributes, job names or UI paths; prefer docs.oracle.com.
- Distinguish HCM, ERP, OIC, OCI, VBS/VBCS, Redwood, BPM and Oracle JET precisely.
- Recommend one primary approach with brief trade-offs.
- Client names, endpoints, screenshots and data are **confidential**: use placeholders; never ask for passwords, tokens or keys.
- Simple, professional English. A short Tamil explanation helps for new or difficult concepts.

## 3. Architecture (v3)

```
Browser (UI at http://localhost:4300)
   │  fetch /api/*  (header X-VW: 1, same origin only)
   ▼
Local server  server/index.js  (Node 22, no dependencies, binds 127.0.0.1)
   ├─ store.js   environments (AES-256-GCM secrets, master.key) + run log (JSON per run)
   ├─ ops.js     operation registry (what each Oracle call looks like, read vs write)
   └─ oracle.js  the only module that calls Oracle (Basic for Fusion, OAuth client credentials for OIC 3)
   ▼
Fusion pod (REST, HDL, erpintegrations, BIP SOAP, BPM tasks)   ·   OIC 3 REST API
```

Rules built into the server:
- **Reads run immediately; writes wait for approval** (`POST /api/runs` → `awaiting_approval` → `POST /api/runs/:id/approve`).
- **PROD writes** require typing the environment name in the approval dialog.
- Requests only go to the environment's own host. Authorization is never logged; the BIP password is masked.
- Data folder: `%USERPROFILE%\.vantage-workbench` (`VW_DATA_DIR`, `VW_MASTER_KEY`, `VW_PORT` override).

The same `public/` UI is also published to Claude as an artifact (no pod execution there; it uses the Claude `sample` capability for the assistant and `downloads` for saving files). `document.body.dataset.local === "1"` (set by the local server) switches on the "Execute in pod" features.

## 4. File map — repository root (same files as `vantage-workbench-local/` in the R: folder)

| File | Responsibility |
|---|---|
| `server/index.js` | HTTP server, static files, API routes, run engine, approval gate, CSRF/origin checks |
| `server/ops.js` | 22 operations: `fusion.rest`, `fusion.describe`, `fusion.test`, `hcm.hdl.load`, `hcm.hdl.status`, `hcm.atom`, `erp.fbdi.import`, `erp.ess.status`, `erp.ess.details`, `erp.ess.download`, `erp.bip.run`, `bpm.tasks`, `bpm.task.get`, `bpm.task.action`, `oic.test`, `oic.integrations`, `oic.instances`, `oic.errors`, `oic.resubmit`, `oic.activate`, `oic.connection.test` |
| `server/oracle.js` | URL building (adds `integrationInstance` for OIC), auth, timeouts, redaction |
| `server/store.js` | Encrypted environment registry and run storage |
| `public/index.html` | Shell + all CSS (design tokens, motion layer, dark theme) |
| `public/app.js` | Data loading, router, catalog, cookbook, overview, roadmap, helpers (`VW.*`) |
| `public/studios.js` | REST, SOAP, HDL, FBDI, Fast Formula, XSLT, Redwood review, Utilities (+ "Send/Load/Submit to pod" buttons) |
| `public/run.js` | Delivery run (Understand → Gather context → Plan → Draft → Approve → Package → Verify → Receipt) and Oracle Assistant |
| `public/local.js` | Environments, approval dialog, `VW.exec`, Runs, HCM data loads, ERP jobs & reports, OIC monitor, Worklist |
| `public/ui.js` | Theme toggle, Ctrl+K command palette, run-ledger progress animation |
| `public/data/*.json` | Oracle catalog + cookbook (schema in `public/data/SCHEMA.md`) |
| `test/e2e.test.js` | 12 API end-to-end tests (`npm test`) |
| `test/mock-oracle.js` | Mock Fusion pod + OIC used by the tests |
| `docs/` | `LOCAL-APP-README.md` (setup, roles, security), `rea-analysis.md`, `research-notes.md` |
| `archive/v1`, `archive/v2` | Earlier versions for reference |
| `test/dev-serve.mjs` | Starts mock + app with two sample environments (`node test/dev-serve.mjs 4388`) for demos/UI checks |
| `start-workbench.cmd` | Windows launcher |

## 5. Catalog data (Oracle facts)

- 225 entries, 33 recipes across HCM 53, ERP 45, OIC 50, OCI 27, VBS 50. 215 entries checked on docs.oracle.com pages (each has `docUrl`).
- Researched 28–29 Oct 2026 via WebSearch/WebFetch of Oracle docs (69 Oracle sources).
- **Not verified** (`verified:false`, shown as "Check" in the UI): `hcm-rest-batch`, `hcm-tbl-per-all-assignments-m` (columns), `erp-ap-invoice-holds`, `erp-ap-interface-submit-import`, `erp-scm-receipts`.
- When adding entries, follow `SCHEMA.md` exactly and only mark `verified:true` after reading the Oracle page.

## 6. Design decisions

- Style: taste-skill **app "framed-sheet"** (seed 421169178): tinted L-frame, white sheet, one teal accent `#1b6c80` on data, IBM Plex Sans + IBM Plex Mono (mono only for paths/IDs/code), light + dark themes.
- Motion (impeccable): focal = run-ledger rail fill, approval card arrival, receipt "print"; view transitions; all with `prefers-reduced-motion` fallbacks.
- Checks used: `design-taste-frontend` lint + inspect `--app` (0 FAIL, 0 WARN at 1440/768/390), `impeccable detect` (only "nested cards" = panels on the sheet, intended by the style).
- Keep: no gradients, no icons in tinted circles, no emoji, sentence case, numbers tabular and right-aligned.

## 7. Open items (verify on a real TEST pod)

| # | Item | Why it matters | How to close |
|---|---|---|---|
| 1 | **Not yet run against a real pod.** All flows pass against the mock only. | Real reply shapes may differ. | Run each screen once on TEST; save the run evidence; fix shapes. |
| 2 | HDL `uploadFile` / `createFileDataSet` reply keys are undocumented; code searches for a key like `ContentId` / `RequestId`. | Load could stop after step 1. | Inspect the first real run's response; hard-code the right key in `ops.js`. |
| 3 | BIP `runReport` uses namespace `http://xmlns.oracle.com/oxp/service/PublicReportService` on `ExternalReportWSSService`. | SOAP fault if the pod differs. | Compare with the pod's `?wsdl`. |
| 4 | BPM approve body `{"action":{"id":"APPROVE"}}` (HCM guide); 26B docs show a newer task schema. | Approve may fail on newer releases. | Test once; adjust `bpm.task.action`. |
| 5 | Corporate proxy: Node 22 `fetch` ignores `HTTPS_PROXY`. | No connection from office network. | Add proxy support (undici `ProxyAgent` needs a dependency, or Node 24 env proxy) if needed. |
| 6 | OIC 3 REST needs OAuth (client credentials); Basic is not accepted by Oracle. | User chose "Basic only" for Fusion. | Create a confidential app in the identity domain for OIC. |
| 7 | Atom feed roles not confirmed. | 401/403 on feeds. | Confirm roles with the security admin. |
| 8 | Proposed update to the user's REA skill (restricted-network workaround, upstream references) was shown for review; not confirmed saved. | Skill accuracy. | Ask Ragavan whether it was saved. |

## 8. Next moves (in priority order)

1. **Pod validation sprint** (TEST): Environments → Test; REST GET/POST; HDL load of one Worker; FBDI with 1 AP invoice; BIP report; OIC list/errors; Worklist list. Record findings in §9 and fix items 2–4.
2. **Delivery run → execute**: after Package, let approved artefacts (HDL zip, FBDI payload, REST calls) be sent to TEST from the run itself, with results added to the receipt.
3. **Use real `/describe` metadata** in REST Studio and the assistant prompt so drafts use the pod's own field names.
4. **Assistant in the local app**: optional Anthropic API key (stored encrypted) so the Oracle Assistant works outside Claude.
5. **More ops**: HCM Extracts submit/status, ESS submitESSJobRequest, OIC schedule start/stop, OIC instance abort, HSDL guidance.
6. **Project templates**: per-client folders of saved requests, HDL templates and runs; export a CAB pack (receipts + evidence + rollback).
7. **Animated demo video** (Ragavan asked for WingsPi-style demos after this version): 90-second walkthrough of a delivery run and approval.
8. **Later**: OCI backend (Object Storage, Functions, Vault) and a shared team server.

## 9. Activity log

- **2026-10-28** — Explored oraclewings.ai with the browser; built v1 single-page toolkit (REST, HDL, Fast Formula, snippets, utilities, Claude assistant). Published as Claude artifact.
- **2026-10-29** — Ran REA 6.8.0: CDP inspection blocked by sandbox egress, so traffic was captured in the user's browser and analysed with `rea inspect-web-network-capture` (evidence ids in `rea-analysis.md`). Mapped OracleWings' 44 routes and service modules; analysed the WingsPi 92-second video frame by frame. Built the verified Oracle catalog (4 research agents, docs.oracle.com). Built v2 (catalog, cookbook, delivery run with approval + receipt, REST/SOAP/HDL/FBDI/Fast Formula/XSLT studios, Redwood review). Proposed a REA skill update.
- **2026-10-29** — Decisions: local Node backend on laptop; first flows HCM REST+HDL, ERP FBDI+ESS+BIP, OIC monitor+resubmit, Worklist; Basic auth for Fusion; "Polished pro" visuals; OCI postponed. Built v3 **Vantage Workbench Local** (server, 22 ops, approval gate, encrypted environments, run evidence) and the visual layer. Tests: `npm test` 12/12 pass; Playwright UI walkthrough of every execute screen against the mock: 0 console errors, phone width 390 px without overflow. Taste inspector 0 FAIL/0 WARN. Artifact republished (version 3).
- **2026-10-31** — Saved this HANDOFF and the folder README; added `public/data/SCHEMA.md`. No code changes.
- **2026-10-31** — Created git repository OracleWorkBench with history (v1, v2, v3 commits), README, HANDOFF, `.gitignore`, `.gitattributes`; branch `Development_v1` created from `main`. Prepared in `R:\Claude\OracleWings REV\OracleWorkBench`; first push to GitHub done by Ragavan with his own credentials.

### Working agreement for git
- Work on `Development_v1` (or a feature branch from it). Commit small, with clear messages.
- Before merging to `main`: `npm test` passes, UI checked at desktop and phone width, HANDOFF updated.
