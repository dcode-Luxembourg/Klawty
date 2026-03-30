<div align="center">

# 🦞 Klawty

### The AI Agent Operating System

**Autonomous AI agents that run 24/7, learn from every task, and coordinate with each other.**

Security-hardened fork of [OpenClaw](https://github.com/openclaw/openclaw) · Open source · MIT

[![Version](https://img.shields.io/badge/version-1.0.0-blue?style=for-the-badge)](https://github.com/dcode-tec/Klawty/releases)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)
[![Node](https://img.shields.io/badge/node-22%2B-brightgreen?style=for-the-badge)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](docker-compose.yml)
[![Channels](https://img.shields.io/badge/channels-20%2B-purple?style=for-the-badge)](https://docs.klawty.ai/channels)

[Website](https://klawty.ai) · [Documentation](https://klawty.ai/docs) · [Quick Start](#quick-start) · [Premium](https://ai-agent-builder.ai) · [GitHub](https://github.com/dcode-tec/Klawty)

</div>

---

## What is Klawty?

Klawty is an **operating system for AI agents**. It's a security-hardened fork of [OpenClaw](https://github.com/openclaw/openclaw) (302K+ stars, MIT) with custom security modules built by [dcode technologies](https://d-code.lu).

The free version gives you **1 agent** with the full OpenClaw platform (40+ CLI commands, 20+ channels, 52 skills, plugin SDK) plus Klawty's security layer (policy engine, exec sandbox, PII detection, credential monitoring, runtime integrity).

For multi-agent teams, smart routing, industry skills, and managed hosting, see the [premium version](https://ai-agent-builder.ai).

```bash
curl -fsSL https://klawty.ai/install.sh | bash
```

---

## Quick Start

```bash
# Option 1: One-command install
curl -fsSL https://klawty.ai/install.sh | bash

# Option 2: From source
git clone https://github.com/dcode-tec/Klawty.git
cd Klawty && pnpm install && pnpm build
klawty onboard    # interactive setup
klawty run         # start your agent

# Option 3: Docker
git clone https://github.com/dcode-tec/Klawty.git
cd Klawty && docker compose up -d
```

**Requirements:** Node.js 22+ · [OpenRouter](https://openrouter.ai) API key (recommended)

---

## Architecture

| Layer             | Source                                                 | What it provides                                                                           |
| ----------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **Platform**      | [OpenClaw](https://github.com/openclaw/openclaw) (MIT) | CLI, 20+ channels, plugin SDK, gateway, memory, native apps, 52 skills                     |
| **Security**      | dcode technologies                                     | Policy engine, Docker exec sandbox, PII detection, credential monitoring, integrity checks |
| **Agent Runtime** | Klawty (premium)                                       | 5-tier LLM routing, 4-tier memory, proposals, dedup, self-improvement                      |

---

## What's Included (Free)

| Feature                 | Details                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| **1 agent (Atlas)**     | General-purpose orchestrator with read-only tools                       |
| **CLI (40+ commands)**  | `klawty run`, `status`, `stop`, `tui`, `logs`, `onboard`, `doctor`, ... |
| **20+ channels**        | Discord, Slack, Telegram, WhatsApp, Signal, Matrix, IRC, Teams, ...     |
| **52 community skills** | Web research, coding, data analysis, comms, devops, ...                 |
| **Plugin SDK**          | Build custom skills and channel integrations                            |
| **Security policy**     | `klawty-policy.yaml` — deny-by-default (network, filesystem, exec)      |
| **Docker exec sandbox** | Shell commands in isolated containers (no network, read-only)           |
| **PII detection**       | Email, phone, credit card, IBAN auto-detect + local routing             |
| **Credential monitor**  | API key validation every 6 hours, balance alerts                        |
| **Runtime integrity**   | SHA-256 manifest verified on every boot                                 |
| **TUI dashboard**       | Full-screen terminal: agents, tasks, costs, health                      |
| **Docker deployment**   | docker-compose.yml included                                             |
| **File-based memory**   | MEMORY.md (50 lines) — persistent across restarts                       |

---

## What's Premium

Available at [ai-agent-builder.ai](https://ai-agent-builder.ai):

- Up to **8 coordinated agents** with inter-agent messaging and delegation context
- **4-layer architecture** — orchestration, execution, governance, memory (not a flat list of bots)
- **5-tier LLM routing** — 10x cost savings via smart model selection
- **Pattern memory** — agents learn from their own execution history (success rates, tool patterns, duration)
- **Policy engine** — code-level governance gate before every tool call (7 rules, zero LLM cost)
- **4-tier memory** — file + session + JSONL + Qdrant vector search
- **27 domain skills** — SEO, copywriting, sales, finance, client ops, ...
- **Proposal lifecycle** — Sentinel validation + 15-minute auto-approve + human gate
- **4-layer deduplication** — task, channel, proposal, discovery
- **Board dashboard** — real-time ops UI (tasks, proposals, agents, costs) via SSH tunnel
- **Discord + Telegram** — agent activity in Discord channels, critical alerts on Telegram
- **6 industry solutions** — restaurants, real estate, construction, resellers, accounting, law firms
- **Managed hosting** — all-inclusive from 79€/month (hosting + AI credits + support)

---

## CLI Reference

```bash
klawty run               # start agents
klawty status            # health + tasks at a glance
klawty stop              # graceful shutdown
klawty tui               # full-screen terminal dashboard
klawty logs [agent]      # tail agent logs
klawty onboard           # interactive setup wizard
klawty doctor            # diagnose issues
klawty agent --message   # run one agent turn
klawty channels list     # connected channels
klawty memory search     # search agent knowledge
klawty security audit    # scan for vulnerabilities
klawty backup create     # snapshot state
klawty update            # check for updates
klawty plugins list      # loaded plugins (36+)
klawty skills list       # available skills (52+)
klawty models list       # configured models
klawty --version         # Klawty 1.0.0
```

---

## Security

All security modules live in `src/security/` — real code, not templates.

| Module                  | Lines | What it does                                                          |
| ----------------------- | ----- | --------------------------------------------------------------------- |
| `policy-enforcer.js`    | 493   | Reads `klawty-policy.yaml`, enforces network/filesystem/exec rules    |
| `exec-sandbox.js`       | 229   | Runs shell commands in Docker containers (no network, read-only root) |
| `privacy-router.js`     | 211   | Detects PII (email, phone, IBAN) → local model routing or redaction   |
| `credential-monitor.js` | 448   | Validates API keys every 6h, alerts on expiry or low balance          |
| `integrity-check.js`    | 188   | SHA-256 manifest of all modules, verified on every boot               |
| `auto-update.js`        | 470   | Version check + download + rollback on failure                        |
| `tui-dashboard.js`      | 624   | Full-screen ANSI dashboard: agents, tasks, costs, health              |
| `klawty-boot.js`        | 95    | Boot hook — initializes all security modules on gateway start         |

**Total: 2,758 lines of custom security code.**

---

## Workspace

```
workspace/
├── klawty.json              # main config (1 model, basic settings)
├── klawty-policy.yaml       # security policy (deny-by-default)
├── SOUL.md                  # agent personality
├── IDENTITY.md              # agent identity (Atlas 🦞)
├── AGENTS.md                # roster
├── TOOLS.md                 # 5 read-only tools
├── MEMORY.md                # persistent knowledge
├── HEARTBEAT.md             # check schedule
├── USER.md                  # operator profile
├── agents/main/AGENT.md     # Atlas config
├── skills/web-research/     # 1 demo skill
└── .env.example             # API key template
```

---

## Channels

| Stable                                                                                                   | Beta                                                 |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Discord · Slack · Telegram · WhatsApp · Signal · Matrix · MS Teams · IRC · Line · Nostr · Terminal · Web | iMessage (macOS) · Google Chat · Mattermost · Twitch |

---

## System Requirements

| Resource | Minimum            | Recommended                    |
| -------- | ------------------ | ------------------------------ |
| Node.js  | 22+                | Latest LTS                     |
| RAM      | 2 GB               | 8 GB                           |
| Docker   | Optional           | Recommended (for exec sandbox) |
| OS       | macOS, Linux, WSL2 | macOS or Ubuntu 22.04+         |

---

## What the Premium Version Looks Like in Production

We run our own business on the premium Klawty engine. **7 AI agents** manage all dcode websites 24/7 for under €40/month.

See [dcode-tec/klawty-team](https://github.com/dcode-tec/klawty-team):

- **4-layer architecture** — orchestration, execution, governance, memory
- **7 agents** — Atlas (orchestrator), Scout (research), Ship (build/ops), Plume (communication), Mira (analysis), Closer (business), Sentinel (audit)
- **5-tier LLM routing** — $0.07 to $15/M tokens, 80% of calls on cheap models
- **Board dashboard** — internal ops UI accessible via SSH tunnel
- **Discord + Telegram** — agent activity visible in real-time
- **Health monitoring** — 60-second checks with Telegram escalation

The free version (this repo) gives you **1 agent with the full platform**. The premium version at [ai-agent-builder.ai](https://ai-agent-builder.ai) unlocks multi-agent teams, LLM routing, proposals, and everything you see in dcode-ops.

---

## Remote Access (SSH Tunnels)

Klawty services bind to **loopback** (127.0.0.1) — never exposed to the internet. Access them from anywhere via SSH tunnel:

```bash
# Forward Klawty Gateway to your laptop
ssh -L 2508:127.0.0.1:2508 user@your-server -N

# Forward Board dashboard
ssh -L 3100:127.0.0.1:3100 user@your-server -N

# Multiple services at once
ssh -L 2508:127.0.0.1:2508 -L 3100:127.0.0.1:3100 -L 6333:127.0.0.1:6333 user@your-server -N
```

Then open `http://localhost:2508` (Gateway) or `http://localhost:3100` (Board) in your browser.

**Why SSH tunnels:**

- Zero attack surface — services invisible to the internet
- No auth overhead — SSH key is the auth
- Works from anywhere — any machine with SSH access
- No firewall rules, no Nginx config, no VPN

See [docs/gateway/remote.md](docs/gateway/remote.md) for detailed remote access documentation.

---

## Contributing

- **Bug fixes** — open an issue, then a PR
- **New skills** — add `SKILL.md` to `skills/`
- **Security reports** — email security@klawty.ai

```bash
git clone https://github.com/dcode-tec/Klawty.git
cd Klawty && pnpm install && pnpm build && pnpm test
```

---

## Built On

- **[OpenClaw](https://github.com/openclaw/openclaw)** — 302K+ stars, MIT license. The fastest-growing open-source AI agent framework.
- **[Qdrant](https://github.com/qdrant/qdrant)** — Open-source vector database (premium feature).
- **[OpenRouter](https://openrouter.ai)** — Unified API for 200+ LLM models.

---

<div align="center">

**Built by [dcode technologies](https://d-code.lu) · Luxembourg 🇱🇺**

_Security-hardened fork of OpenClaw. MIT license preserved._

[klawty.ai](https://klawty.ai) · [ai-agent-builder.ai](https://ai-agent-builder.ai) · [d-code.lu](https://d-code.lu)

</div>
