# Klawty Changelog

All notable changes to the Klawty fork.

For OpenClaw upstream changes, see [OpenClaw CHANGELOG](./CHANGELOG.md).

---

## [1.0.0] — 2026-03-19 — Initial Release

### Fork

- Forked from [OpenClaw](https://github.com/openclaw/openclaw) v2026.3.14 (302K+ stars, MIT license)
- Rebranded: CLI binary `openclaw` → `klawty`, config `openclaw.json` → `klawty.json`, state dir `~/.openclaw` → `~/.klawty`
- Default gateway port changed from 18789 to 2508
- Version reset to 1.0.0 (Klawty's own semver, independent of OpenClaw's date-based versioning)
- OpenClaw MIT license preserved in all distributions

### Security Modules (src/security/) — 2,758 lines

| Module                  | Lines | Feature                                                                                                                                                                        |
| ----------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `policy-enforcer.js`    | 493   | Reads `klawty-policy.yaml` at runtime. Enforces deny-by-default rules for network endpoints, filesystem paths, and shell commands before any tool execution                    |
| `exec-sandbox.js`       | 229   | Wraps the `exec` tool in Docker containers: `--network none`, read-only root, 512MB memory limit, 30s timeout. Falls back to native + policy checks without Docker             |
| `privacy-router.js`     | 211   | Regex-based PII detection (email, phone, credit card, SSN, IBAN) + configurable keyword matching. Routes sensitive tasks to local models, redacts PII, or blocks execution     |
| `credential-monitor.js` | 448   | Validates OpenRouter, Discord, Telegram, Slack API keys against their endpoints every 6 hours. Alerts on expiry, revocation, or low balance (OpenRouter: $5 warn, $1 critical) |
| `integrity-check.js`    | 188   | Generates SHA-256 manifest of all runtime .js files. Verifies on every boot. Tampered critical files trigger read-only degradation                                             |
| `auto-update.js`        | 470   | Checks for new versions via license API. Downloads update bundles, creates pre-update backup, verifies integrity post-update, rollback on failure                              |
| `tui-dashboard.js`      | 624   | Full-screen ANSI terminal dashboard: agent status table, task stats, health indicators, cost progress bar, activity log. Keyboard navigation. 5s auto-refresh                  |
| `klawty-boot.js`        | 95    | Boot hook that initializes all security modules when the gateway starts. Non-blocking — gateway runs even if modules fail                                                      |

### Security Policy

- `klawty-policy.yaml` — deny-by-default configuration file:
  - Network: only allowlisted endpoints reachable (OpenRouter, Qdrant localhost, license server)
  - Filesystem: write only to workspace/, data/, backups/, observability/. Runtime/ and skills/ are read-only
  - Execution: blocked dangerous patterns (rm -rf, sudo, curl|bash, fork bombs). Allowed: node, npm, git, docker, sqlite3
  - Resources: 10MB max file size, 5GB max disk, 30s exec timeout
  - Privacy: PII regex patterns + keywords, configurable action (local_inference, redact, block)
  - Rate limits: channel posts, task creation, API calls per window

### Scripts

- `scripts/install.sh` (258 lines) — one-command installer: OS detection, Node.js/Docker/pnpm check, Klawty download, runs onboard
- `scripts/onboard.sh` (529 lines) — interactive setup wizard: license key, OpenRouter API validation, industry selection (7 verticals), channel setup, Docker/Qdrant, .env + klawty.json generation

### Workspace (Demo Agent)

- 1 agent: Atlas 🦞 (orchestrator) with read-only tools (file_read, web_search, web_fetch, recall_memory, store_memory)
- Minimal `klawty.json`: 1 model, no routing, no dedup, no cost caps — demonstrates architecture without revealing premium features
- `SOUL.md`: 5 operating principles + boundaries
- 1 demo skill: `web-research/SKILL.md`
- `.env.example` with OpenRouter key template

### What's NOT Included (Premium)

These features exist in the premium product at [ai-agent-builder.ai](https://ai-agent-builder.ai), not in this free version:

- Multi-agent coordination (up to 8 agents)
- 5-tier LLM routing with pattern matching
- 4-tier memory with Qdrant vector search
- 27 domain skills + auto-matching
- Reflection engine + skill gap detection
- Proposal lifecycle with rollback
- 4-layer deduplication
- Health monitor + automated backups
- Agent scorecard + cost tracker
- Management dashboard (web portal)
- Industry-specific pre-fitting (6 verticals)
- Managed hosting (all-inclusive from 79€/month)
- License protection

---

## Attribution

Klawty is built on [OpenClaw](https://github.com/openclaw/openclaw), created by Peter Steinberger and the OpenClaw community. MIT license. 302K+ GitHub stars.

All OpenClaw features (CLI, channels, plugins, gateway, memory, native apps) are inherited. Klawty's additions are the security modules in `src/security/`, the workspace configuration, and the install/onboard scripts.

Built by [dcode technologies S.A.](https://d-code.lu) — Luxembourg.
