# OracleWorkBench — Vantage Workbench

An Oracle Cloud consultant workbench by Ragavan (Cloud Vantage Solutions): plan, build, validate and run delivery work for **Fusion HCM, ERP/SCM, OIC 3, VBS/VBCS/Redwood and BPM Worklist** from one screen.
Reads run straight away; anything that changes data waits for approval, and PROD changes need the environment name typed.

> Continuing this project (person or AI assistant)? Read **[HANDOFF.md](HANDOFF.md)** first and update its activity log at the end of every session.

## Quick start (Windows 11)

1. Install Node.js **22 LTS or later** from nodejs.org. No `npm install` is needed (no third-party dependencies).
2. Clone and start:
   ```bash
   git clone https://github.com/Ragavaz/OracleWorkBench.git
   cd OracleWorkBench
   npm start            # or double-click start-workbench.cmd
   ```
3. Open http://localhost:4300 → **Environments** → add your TEST pod → **Test**.
4. `npm test` runs 12 end-to-end checks against a built-in mock pod.

Full setup, Oracle roles, security and known limits: [docs/LOCAL-APP-README.md](docs/LOCAL-APP-README.md).

## Repository layout

| Path | Contents |
|---|---|
| `server/` | Local Node server: API, approval gate, encrypted environments (`store.js`), Oracle operations (`ops.js`), Oracle HTTP client (`oracle.js`) |
| `public/` | Workbench UI (also published as a Claude artifact) and `public/data/*.json`, the verified Oracle catalog + cookbook (`SCHEMA.md`) |
| `test/` | `e2e.test.js`, `mock-oracle.js` (mock Fusion pod + OIC), `dev-serve.mjs` (demo server with sample environments) |
| `docs/` | `LOCAL-APP-README.md`, `rea-analysis.md` (competitor analysis with REA evidence), `research-notes.md` |
| `archive/v1`, `archive/v2` | Earlier versions, kept for reference |
| `HANDOFF.md` | Status, decisions, open items, next moves, activity log |

## Branches

| Branch | Use |
|---|---|
| `main` | Stable, tested versions only |
| `Development_v1` | Ongoing development; merge to `main` after `npm test` passes and a TEST-pod check |

## Security

Never commit pod hosts of clients, credentials, `master.key`, the `.vantage-workbench` data folder or run logs (they can contain personal data). `.gitignore` excludes the usual ones; check `git status` before every commit.
