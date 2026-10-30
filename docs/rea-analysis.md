# REA analysis — oraclewings.ai and wingspi.ai

Date: 29 Oct 2026. Analyst: Claude for Cloud Vantage (Ragavan). Scope: public, signed-out pages only. Purpose: understand the service catalogue to design our own original toolkit (interoperability / competitive research). No authentication was attempted and no protected areas were opened.

## Method and tool status

| Step | Tool | Result |
|---|---|---|
| Readiness | `rea doctor --json` (rea-agents 6.8.0, Node 22.23.4, Ubuntu 24.04) | CLI healthy for static/web work. Native engines (Hopper, Ghidra, IDA, JADX, Kuna) not configured; not needed for websites. MCP registration and bundled skill not installed (setup needs your approval). |
| Passive CDP inspection | `rea list-browser-targets` → `rea inspect-web-page` | Target listing worked (evidence `ev_10b4aa2e…`). Page inspection refused with `target_not_allowed`: the sandbox egress proxy blocks oraclewings.ai, wingspi.ai and docs.oracle.com, so the tabs held `chrome-error://` pages, which REA correctly refuses. |
| Capture | Claude built-in browser on your PC (network request list + same-origin static scan of the shipped JS bundles) | Worked. Requests transcribed into HAR 1.2 files. |
| Capture inspection | `rea inspect-web-network-capture <har> har` | Evidence `ev_23880481…` (oraclewings, 7 records) and `ev_e6e65bb1…` (wingspi, 15 records). Confidence: observed. Limitation: transcribed HAR carries no headers, bodies or timings. |

## Observed — oraclewings.ai

Front end: Vite-built React SPA; main bundle `assets/index-DtNw43AI.js` (495,578 bytes); one call on load, `GET /api/auth/me → 401` (signed-out session check).

Client routes found in the bundle (44): `/home`, `/oracle-fusion`, `/fusion-api`, `/fusion-soap`, `/groovy-studio`, `/otbi`, `/template`, `/hcm-setup`, `/xslt-generator`, `/fsd-generator`, `/atp`, `/oci`, `/apex`, `/tools`, `/worklist`, `/runs`, `/data-management`, `/support`, `/pricing`, `/org-admin`, `/admin/*`, `/vendor`, auth pages, legal pages.

Lazy chunks (page modules): FusionApi, FusionSoap, FbdiTool, GroovyStudio, OtbiStudio, XsltGenerator, HCMSetupExpert, ATPAgentPage, OCIAgentPage, WorklistPage, RunsPage, DataManagement, SupportCenter, ChatInterface, ChatPage, EnvSelector, SqlEditor, docgen, BulkUploadModal, AdminDashboard/Eval/Ingestion/Logs/Payments/Users/Vendors, OrgAdmin*, Vendor*.

Backend paths referenced by page modules:

| Module | Paths | UI evidence (labels) |
|---|---|---|
| REST Studio (FusionApi) | `/api/fusion-api/instances`, `…/instances/{id}/select`, `…/instances/{id}/test`, `/api/fusion-api/test-connection`, `/api/fusion-api/fetch-payload`, `/api/fusion-api/execute` | Instance Configuration (Base URL, Basic or OAuth client credentials, Token URL, Scope), Query Parameters (JSON), Request Body, Response Console, "Generate Payloads from CSV", "Execution Plan: Child APIs", sub-resource execution results |
| SOAP Studio | (none in chunk) | WSDL URL, Service Path, SOAPAction, Namespace, Body Payload, "Preview full envelope" |
| FBDI / HCM Extracts workspace (FbdiTool) | `/api/connect/hcm/extracts/designs/`, `/api/connect/hcm/extracts/interactive/jobs/{id}`, `/api/chat/technical-browser/jobs/{id}`, `/api/chat/approval/execute`, `/api/chat/downloads/` | Required Files, Oracle Import Job, Required Fields by File, CSV Preview, Validation Errors, "Verify the uploaded file", Content account, Interface option, EPM Narrative Reporting doclets |
| OTBI Studio | `/api/connect/otbi/subject-areas`, `/api/connect/otbi/sql`, `/api/connect/otbi/analysis`, `/api/connect/otbi/catalog?folder=` | Logical SQL, "Validate offline", "Run read-only query", Run Saved Analysis, Browse OTBI Catalog |
| Fusion Copilot (ChatInterface) | `/api/connect/execute` | Smart Connectivity Setup (Instance URL, Basic or OAuth 2.0, IDCS token URL, environment type Test/Dev/Prod, Source System Owner); Fast Formula manager ("DEPLOY TO FUSION", FF syntax check); Enterprise Report Generator (BI Catalog); Fusion Service Hub (service requests); FSM Automation Engine |
| Groovy Studio | — | "Select an event", static validation findings, scenario/expected, assumptions/warnings |
| XSLT Generator | — | Generate XSLT template, transformed XML output, validator errors, history |
| HCM Setup Expert | — | Setup manifest, configuration draft, functional object, collected metadata |
| Database Agent (ATPAgentPage) | — | DB connections with wallet ZIP, TNS name, host/SCAN, port, chat sessions |
| OCI NL Agent | — | Natural-language request → dry-run plan → "Confirm & Execute" with one-time token |
| Worklist | — | "Pending BPM approval tasks from your Fusion environment" |
| Runs | — | Durable operation runs: environment, risk, dry run, retries, approved by, correlation ID, artifacts |

## Observed — wingspi.ai

Front end: Vite-built React SPA (`assets/index-XDoGrKPr.js`, 226,525 bytes, plus vendor-react, vendor-motion chunks). API base `/api/v1`; referenced paths `/api/v1/auth/google/login/start`, `/api/v1/org-governance/residency`, `/api/v1/work-orders/pending-count`.

Routes (33): `/today`, `/work`, `/work/workflows/:workflowId/build`, `/assistant`, `/desk`, `/calendar`, `/knowledge`, `/everything`, `/connections`, `/connect/mcp`, `/role-packs`, `/trust`, `/team`, `/settings`, `/about-you`, `/onboarding`, `/billing`, `/admin/eval-health`, public card `/c/:handle`.

Page modules include WorkflowBuilderPage, ScheduledJobs, ApprovalNotifier, ApprovalAttachments, DestructiveConfirmDialog, StopAllDialog, TrustCentreArea, RolePacksArea, KnowledgeArea, ConnectMcpPage, DesktopBrowserBridge, CodingAgentsDesktopSync, EvalHealthPage.

## Inferred (not proven)

- Both products share one pattern: connect an environment once, let AI draft an artefact, show a plan, require approval, then execute and keep a run record with evidence.
- OracleWings executes against the customer's pod from its own backend (`/api/fusion-api/execute`, `/api/connect/*`), which is why it needs stored instance credentials.
- "17 workspaces" maps to the page modules above; FSD generator, APEX and ATP routes exist but are not advertised on the landing page.

## Unknown

- Backend behaviour, models used, data retention and security controls (server side, not observable).
- Whether AI answers are grounded in Oracle documentation or generated freely.

## What we take into Vantage Workbench (original implementation)

| Their service | Our version | Notes |
|---|---|---|
| REST Studio + child API plan + CSV→payload | REST Studio with verified resource catalogue, CSV→payload batch generator, child-resource builder | No stored credentials; browser cannot call a pod from the published page |
| SOAP Studio | SOAP envelope builder (WS-Security placeholders, SOAPAction) | Verified service list from Oracle docs |
| FBDI workspace | FBDI checklist + erpintegrations payload builder | Job names from Oracle docs |
| HCM Extracts / HDL | HDL Builder + HSDL notes + extract guidance | |
| Fast Formula manager | Fast Formula scaffold + checks | |
| OTBI Studio | OTBI/BIP SQL library and logical SQL templates | |
| Groovy Studio | Groovy snippet library (Application Composer) | |
| XSLT Generator | XSLT template builder for OIC/BIP | |
| OCI NL agent (plan → confirm) | OCI CLI builder + assistant with plan-first answers | |
| Worklist / Runs (approval + evidence) | Delivery checklist: plan, approval, test evidence, rollback (CAB-ready export) | |
| Fusion Copilot | Oracle Assistant (Claude) with domain + task modes | |
| WingsPi autonomy ladder | Assistant "mode" guidance: explain → draft → review; never executes | |

## Observed — WingsPi "in action" video (wingspi-90-second-cut.mp4, 92.1 s, 1920×1080)

Frames sampled every 6–8 s in the built-in browser. Labelled "Animated product demonstration · sample data".

| Time | Scene | What it shows |
|---|---|---|
| 0–5 s | Title | Mascot, "Meet WingsPi — Your work, moving forward." |
| 10–14 s | Request | WhatsApp message "Schedule a 30-minute review tomorrow"; mascot status "Reading your request"; stepper top-right starting at "Request" |
| 16 s | Context | Calendar week view, finding a free slot |
| 22 s | Draft | Meeting invitation card (title, when, guests, location) — status "Waiting for your approval" |
| 26 s | Execute | Google Meet with the assistant "Listening and transcribing" |
| 30 s | Receipt | Meeting recap with Summary / Action items tabs |
| 36 s | Connect | "Connected tools" list (Gmail, Outlook, Google Calendar, Teams, Slack) — "Connecting your work" |
| 44 s | Data | Contacts.xlsx import preview with match status ("Identity confirmed", "Ready to import") and "Apply reviewed import" |
| 52 s | Mail | Inbox → reply draft with instruction "Draft a reply with the next steps" |
| 60 s | Calls | Scheduled call card, "Call approved", live transcript, "Cancel or retry within your policy" |
| 68 s | Context | Role packs (Executive Assistant, Finance Manager, Sales Manager) + business context document being read |
| 76 s | Routine | "Every Monday, draft my weekly team update" → plan of 3 steps → "Activate schedule" |
| 84 s | Specialist | "Prepare an AP aging report from Oracle Fusion" → handed to OracleWings (Oracle Fusion reporting specialist) → AP aging table → Excel / CSV export |
| 90 s | Close | "Less chasing. More momentum." |

Interactive approval demo under the video: 7 steps — Understand → Gather context → Draft → Waiting for you → Execute → Verify → Receipt; the assistant lists its plan ("Here is what I will do — nothing leaves until you say so"), asks a single confirm question with a short scope line ("Three recipients · Thursday, 10:00") and offers Approve / Not yet, then Replay.

Pricing seen in the WingsPi app (your screenshot): Basic $50, Pro $100, Max $200 per month; Individual / Enterprise toggle; payments by Razorpay.

### Pattern to reuse in Vantage Workbench (our own design and wording)

One request → the assistant states its plan → shows the draft artefact → waits for approval → "executes" (in v2: generates the deployable files; in v3 with a backend: calls the pod) → verifies with checks → writes a receipt (run record) the consultant can export for CAB.
