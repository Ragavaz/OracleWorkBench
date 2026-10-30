# OracleWings.AI / WingsPi — exploration notes and build spec

Explored 29 Oct 2026 in the browser (public pages only; workspaces sit behind sign-in, so nothing inside them was examined).

## Observed — oraclewings.ai (by IntegrationWings)
- Pitch: "Every Oracle tool. One intelligent workspace." 17 technical workspaces, 5 delivery checkpoints, 1 shared Oracle context.
- Delivery path: Describe → Design → Approve → Run → Evidence.
- Module coverage: HCM (Extracts, HDL, Fast Formula, Security & RCA), EPM, FIN, SCM, PRC, PPM, CX, RMCS.
- Workspaces: Fusion Copilot, Groovy Studio, OTBI Studio, Template Studio, HCM Setup Expert, REST Studio, SOAP Studio, FBDI Workspace, Database Agent, XSLT Generator, OIC Workspace, FusionClaw, OIC, Worklist, Runs, Data Management, Support Center.
- Pricing: Basic $20/mo (1M tokens), Pro $100/mo (5M), Max $200/mo (10M, OIC + VBCS + PCS), Enterprise on request.
- Parent product page (integrationwings.com/products/oraclewings) claims a sovereign 72B domain LLM, 90+ agents, 40+ connectors; these are vendor claims, not verified.

## Observed — wingspi.ai
- Enterprise personal assistant (mail, calendar, chat, Jira/Confluence) that drafts and acts only on approval.
- Autonomy ladder per capability: Observe → Suggest → Draft → Approve → Guarded.
- Role packs (Executive Assistant, Sales, Finance, Operations, Project Manager) and shared skills (Draft, Summarise, Schedule, Follow up, Research, Act on approval).
- Front end: Vite-built single-page app; fonts Inter, Bricolage Grotesque, Fraunces; dark navy background.

## Inferred
- Both products lean on "governed AI": a plan is shown and approved before anything changes the target system.
- The workspaces are AI front-ends over Oracle artefact types (REST, HDL, FBDI, Groovy, OTBI, XSLT).

## What Vantage Workbench implements (original build, not a copy)
| Tool | Behaviour | Status |
|---|---|---|
| REST Studio | Builds Fusion REST URL (hcmRestApi / fscmRestApi / crmRestApi) with q, fields, expand, orderBy, finder, paging, onlyData, headers; outputs URL, cURL, fetch, VBS JS action chain, OIC adapter checklist; validation flags | Working |
| HDL Builder | CSV → METADATA/MERGE/DELETE .dat; presets Worker, PersonName, PersonEmail, ElementEntry; checks column counts, YYYY/MM/DD dates, escapes pipes | Working |
| Fast Formula | Header, DEFAULT FOR, INPUTS ARE, logic, RETURN; checks unassigned returns, unbalanced parentheses | Working |
| Snippet Library | 15 filterable snippets across HCM, ERP, OIC, OCI, VBS, REST | Working |
| Utilities | JSON format, Base64 (text and file), date formats, q filter builder | Working |
| Oracle Assistant | Claude chat with domain and task selection, Tamil summary option, review hand-off from each generator | Works when opened in Claude |

## Open items
- Starter attributes, DBIs and resource names should be confirmed per release (/describe, View Business Objects).
- Possible next tools: SOAP envelope builder, XSLT mapper helper, OTBI logical SQL, Groovy snippets, FBDI CSV checker.
