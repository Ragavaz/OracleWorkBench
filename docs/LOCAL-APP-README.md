# Vantage Workbench Local 3.0

Oracle Cloud consultant workbench that runs on your laptop and talks to your pods:
Fusion HCM and ERP (REST, HDL, Atom feeds, FBDI/ESS, BI Publisher, BPM worklist) and OIC 3 (monitor, resubmit, activate, connection test).
Reads run straight away. Anything that changes data waits for your approval, and PROD changes need the environment name typed.

## 1. Prerequisites

- Windows 11 (macOS/Linux also work), Node.js **22 LTS or later** from nodejs.org. Check: `node -v`.
- No `npm install` is needed: the app has no third-party dependencies.
- A **TEST** pod and a dedicated integration user per pod. Give it only the roles you need:
  - REST reads/writes: the REST service roles for the resources you call.
  - HDL over REST: *Use REST Service - Data Load Data Set* (ORA_HRC_REST_SERVICE_ACCESS_DATA_LOAD_DATA_SETS), plus the privileges for creating a file data set and HDL import (see Oracle's "Automating data loading" page).
  - FBDI/ESS: the integration roles for erpintegrations and the import job (for Payables, the AP import duties).
  - BI Publisher: access to the report's catalog folder.
  - Worklist: the integration user only sees tasks assigned to it or its groups.
- OIC 3: Oracle requires **OAuth client credentials** for the OIC REST API (Basic is not accepted there). Create a confidential application in the identity domain with the Oracle Integration scope; you need the token URL, client ID, client secret, scope and the service instance name (`integrationInstance`).

## 2. Start

1. Unzip `vantage-workbench-local` to a folder such as `C:\Tools\vantage-workbench-local`.
2. Double-click `start-workbench.cmd` (or run `npm start` in that folder).
3. Your browser opens http://localhost:4300. Keep the black window open while you work.

## 3. First use (10 minutes)

1. **Environments** → add your Fusion TEST pod: name, tier TEST, host `https://<pod>.fa.<region>.oraclecloud.com`, integration user and password. Click **Test**; you should see *Connected*.
2. Add your OIC 3 instance (design-time host `https://design.integration.<region>.ocp.oraclecloud.com`, instance name, token URL, client ID/secret, scope). **Test** it.
3. Pick the active environments in the top bar.
4. Try: **REST Studio** → Workers → *Send to active pod* (GET runs immediately).
5. Try a write in TEST: change the method to POST, check the approval dialog, approve, then open **Runs** to see the evidence.

## 4. What each screen does

| Screen | Use it for |
|---|---|
| REST Studio | Build and send any Fusion REST call; *Describe resource* shows the real fields in your pod |
| HDL Builder → HCM data loads | Build a .dat, zip it, *Load to active pod*, then follow the data set to COMPLETED with counts per business object |
| HCM data loads → Atom feed | Read newhire / empupdate / empassignment events after a time |
| FBDI & ERP import → ERP jobs & reports | Zip FBDI CSVs, submit importBulkData, follow child jobs, open the log files |
| SOAP Studio / ERP jobs & reports | Run a BI Publisher report (runReport) and preview CSV output |
| OIC monitor | Integrations, failed instances, recoverable errors, resubmit, activate/deactivate, connection test |
| Worklist | BPM approval tasks; approve or reject through the approval dialog |
| Runs | Every call: request, response, approver, timings; save evidence as Markdown for CAB/UAT |
| Delivery run, Catalog, Cookbook, other studios | Planning, verified references and file builders (same as the Claude version) |

## 5. Security

- The server listens on 127.0.0.1 only and refuses requests from other web sites (custom header + origin check).
- Secrets are encrypted with AES-256-GCM. The key is `master.key` in the data folder `%USERPROFILE%\.vantage-workbench` (or set `VW_MASTER_KEY` to 64 hex characters to keep the key elsewhere). Passwords never go to the browser.
- Run logs keep requests and responses (with Authorization removed and the BI Publisher password masked). Responses can contain personal data: keep the data folder private, and use TEST pods with test data.
- To remove everything: delete the app folder and `%USERPROFILE%\.vantage-workbench`.

## 6. Settings

| Variable | Default | Purpose |
|---|---|---|
| `VW_PORT` | 4300 | Port |
| `VW_DATA_DIR` | `%USERPROFILE%\.vantage-workbench` | Environments, key and run logs |
| `VW_MASTER_KEY` | — | Encryption key (64 hex) instead of master.key |

## 7. Tests

`npm test` runs 12 end-to-end checks against a built-in mock pod (auth, encryption, approval gate, PROD confirm, HDL chain, FBDI/ESS, BIP, OIC, worklist).

## 8. Known limits and things to confirm in your pod

- HDL REST: Oracle does not document the response key names of uploadFile/createFileDataSet; the app searches the response for the content ID and request ID and logs the whole reply. If a load stops after step 1, open the run and send me the response shape.
- BI Publisher: uses the `PublicReportService` namespace on `ExternalReportWSSService`; confirm against your pod's WSDL if you get a SOAP fault.
- BPM task approve uses `{"action":{"id":"APPROVE"}}` as in Oracle's HCM guide; newer releases document a different task schema.
- Corporate proxy: Node 22 does not use `HTTPS_PROXY` automatically. If your office network requires a proxy to reach Oracle Cloud, ask for proxy support to be added.
- The Claude assistant runs only in the Claude version; in the local app the Assistant screen copies a grounded prompt for you to paste into Claude.
