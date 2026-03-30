# Klawty OS — Installation & Plugin Guide

Complete reference for installing Klawty and managing plugins/extensions.

---

## Table of Contents

- [System Requirements](#system-requirements)
- [Installation Methods](#installation-methods)
  - [Installer Script (Recommended)](#method-1-installer-script-recommended)
  - [npm / pnpm (Global)](#method-2-npm--pnpm-global)
  - [From Source](#method-3-from-source)
  - [Docker](#method-4-docker)
  - [Bun (CLI-only)](#method-5-bun-cli-only)
- [Post-Install Setup](#post-install-setup)
- [Platform-Specific Notes](#platform-specific-notes)
  - [macOS](#macos)
  - [Linux](#linux)
  - [Windows (WSL2)](#windows-wsl2)
- [Updating Klawty](#updating-klawty)
- [Uninstalling Klawty](#uninstalling-klawty)
- [Plugin Installation and Activation](#plugin-installation-and-activation)
  - [Step 1: List Loaded Plugins](#step-1-list-loaded-plugins)
  - [Step 2: Install a Plugin](#step-2-install-a-plugin)
  - [Step 3: Enable the Plugin](#step-3-enable-the-plugin)
  - [Step 4: Configure the Plugin](#step-4-configure-the-plugin)
  - [Step 5: Restart the Gateway](#step-5-restart-the-gateway)
  - [Step 6: Verify](#step-6-verify)
- [Plugin Management Commands](#plugin-management-commands)
- [Official Installable Plugins](#official-installable-plugins)
- [Plugin Configuration Reference](#plugin-configuration-reference)
  - [Allowlist and Denylist](#allowlist-and-denylist)
  - [Exclusive Slots](#exclusive-slots)
  - [Per-Plugin Config](#per-plugin-config)
- [Building Custom Plugins](#building-custom-plugins)

---

## System Requirements

- **Node.js**: 24 (recommended) or 22 LTS (22.16+)
- **OS**: macOS, Linux, or Windows (WSL2 strongly recommended on Windows)
- **pnpm**: only required when building from source
- **Docker**: optional, for containerized deployments or exec sandbox

---

## Installation Methods

### Method 1: Installer Script (Recommended)

**macOS / Linux / WSL:**

```bash
curl -fsSL https://klawty.ai/install.sh | bash
```

Auto-detects OS, installs Node 24 if missing, installs Klawty via npm, and runs the onboarding wizard.

**Flags:**

| Flag | Description |
|------|-------------|
| `--install-method npm\|git` | Choose install method |
| `--npm`, `--git`, `--github` | Shortcuts for install method |
| `--version <version>` | Specify version, dist-tag, or npm spec |
| `--beta` | Use beta dist-tag if available |
| `--git-dir <path>` | Custom checkout directory (git method) |
| `--no-git-update` | Skip git pull on existing checkouts |
| `--no-prompt` | Disable interactive prompts |
| `--no-onboard` | Skip onboarding wizard |
| `--onboard` | Force onboarding |
| `--dry-run` | Preview actions without executing |
| `--verbose` | Debug output |

**Environment variables:**

| Variable | Description |
|----------|-------------|
| `KLAWTY_INSTALL_METHOD` | `git` or `npm` |
| `KLAWTY_VERSION` | `latest`, `next`, `main`, or a semver/spec |
| `KLAWTY_BETA` | `0` or `1` |
| `KLAWTY_GIT_DIR` | Custom checkout path |
| `KLAWTY_GIT_UPDATE` | `0` to skip git pull |
| `KLAWTY_NO_PROMPT` | `1` to disable prompts |
| `KLAWTY_NO_ONBOARD` | `1` to skip onboarding |
| `KLAWTY_DRY_RUN` | `1` to preview only |
| `KLAWTY_VERBOSE` | `1` for debug output |
| `KLAWTY_NPM_LOGLEVEL` | `error`, `warn`, or `notice` |

---

**Self-Contained Installer (no system Node needed):**

```bash
curl -fsSL https://klawty.ai/install-cli.sh | bash
```

Downloads its own Node binary (currently 22.22.0) and installs Klawty under `~/.klawty`. Zero system dependencies besides curl and git.

**Flags:**

| Flag | Description |
|------|-------------|
| `--prefix <path>` | Install prefix (default: `~/.klawty`) |
| `--version <ver>` | Klawty version or dist-tag |
| `--node-version <ver>` | Node version to download |
| `--json` | NDJSON event output |
| `--onboard` | Run onboarding after install |
| `--no-onboard` | Skip onboarding |
| `--set-npm-prefix` | Force npm prefix on Linux if not writable |

---

**Windows (PowerShell):**

```powershell
irm https://klawty.ai/install.ps1 | iex
```

Installs Node 24 via winget, Chocolatey, or Scoop, then installs Klawty via npm.

**Flags:**

| Flag | Description |
|------|-------------|
| `-InstallMethod npm\|git` | Install method (default: npm) |
| `-Tag <tag\|version>` | npm dist-tag or version |
| `-GitDir <path>` | Checkout directory (git method) |
| `-NoOnboard` | Skip onboarding |
| `-NoGitUpdate` | Skip git pull |
| `-DryRun` | Preview only |

---

### Method 2: npm / pnpm (Global)

Requires Node 22.16+ already installed.

```bash
npm install -g klawty@latest
```

Or with pnpm:

```bash
pnpm add -g klawty@latest
```

If you get permission errors on Linux:

```bash
mkdir -p "$HOME/.npm-global"
npm config set prefix "$HOME/.npm-global"
export PATH="$HOME/.npm-global/bin:$PATH"    # add to ~/.bashrc or ~/.zshrc
npm install -g klawty@latest
```

---

### Method 3: From Source

```bash
git clone https://github.com/klawty/klawty.git
cd klawty
pnpm install
pnpm build
```

Run the gateway directly:

```bash
node klawty.mjs gateway --port 2508
```

Or in development mode with hot reload:

```bash
pnpm gateway:watch
```

---

### Method 4: Docker

Quick start:

```bash
./docker-setup.sh
```

Key environment variables:

| Variable | Description |
|----------|-------------|
| `KLAWTY_IMAGE` | Use a remote image instead of building locally |
| `KLAWTY_DOCKER_APT_PACKAGES` | Extra apt packages during build |
| `KLAWTY_EXTENSIONS` | Pre-install extension dependencies |
| `KLAWTY_EXTRA_MOUNTS` | Add extra host bind mounts |
| `KLAWTY_HOME_VOLUME` | Persist `/home/node` in a named volume |
| `KLAWTY_SANDBOX=1` | Enable Docker gateway sandbox |
| `KLAWTY_INSTALL_DOCKER_CLI=1` | Install Docker CLI inside image |
| `KLAWTY_DOCKER_SOCKET` | Override Docker socket path |

---

### Method 5: Bun (CLI-only)

```bash
bun install -g klawty@latest
```

The Gateway is not fully supported under Bun. Use Node for production gateway deployments.

---

## Post-Install Setup

After installing with any method, run the onboarding wizard:

```bash
klawty onboard --install-daemon
```

The wizard walks through:

1. **Model and Auth** -- choose your LLM provider and API key
2. **Workspace** -- location for agent files (default: `~/.klawty/workspace`)
3. **Gateway** -- port, bind address, auth mode
4. **Channels** -- connect WhatsApp, Telegram, Discord, Slack, Signal, etc.
5. **Daemon** -- install as a LaunchAgent (macOS) or systemd unit (Linux)
6. **Health check** -- start gateway and verify
7. **Skills** -- install recommended skills

Other useful post-install commands:

```bash
klawty dashboard          # Open Control UI at http://127.0.0.1:2508
klawty doctor             # Health check and quick fixes
klawty health             # Verify gateway is running
klawty status             # Channel health and session info
```

To reconfigure later:

```bash
klawty configure          # Re-run interactive config
klawty agents add <name>  # Add another agent
```

---

## Platform-Specific Notes

### macOS

- Klawty runs a **companion menu bar app** that manages the local gateway
- The app owns TCC prompts (Notifications, Accessibility, Screen Recording, Microphone, Speech, Automation)
- LaunchAgent label: `ai.klawty.gateway`
- Deep links supported: `klawty://agent?message=...`
- Avoid iCloud or cloud-synced directories for the state directory
- Exec approvals stored in `~/.klawty/exec-approvals.json`

### Linux

- Gateway fully supported, no native companion app
- Node 24 recommended (Node 22 LTS compatible)
- Enable systemd lingering for service persistence:

```bash
sudo loginctl enable-linger $USER
```

- VPS quick path: install Node, npm install klawty, onboard, set up SSH tunnel

### Windows (WSL2)

- WSL2 with Ubuntu is the recommended path
- Enable systemd inside WSL:

```ini
# /etc/wsl.conf
[boot]
systemd=true
```

- Installation inside WSL follows the same steps as Linux
- Use portproxy for LAN access over Windows

---

## Updating Klawty

**Re-run the installer (recommended):**

```bash
curl -fsSL https://klawty.ai/install.sh | bash
```

**Global install update:**

```bash
npm i -g klawty@latest
```

**Switch update channels:**

```bash
klawty update --channel stable     # Production releases
klawty update --channel beta       # Beta releases
klawty update --channel dev        # Development builds
```

**Source checkout update:**

```bash
klawty update                      # Safe update (requires clean worktree)
```

Or manually:

```bash
git pull
pnpm install
pnpm build
klawty doctor
klawty gateway restart
klawty health
```

**Rollback (global install):**

```bash
npm i -g klawty@<known-good-version>
klawty doctor
klawty gateway restart
```

**Rollback (source by date):**

```bash
git fetch origin
git checkout "$(git rev-list -n 1 --before=\"2026-01-01\" origin/main)"
pnpm install && pnpm build
klawty gateway restart
```

**Always run after any update:**

```bash
klawty doctor
klawty gateway restart
klawty health
```

---

## Uninstalling Klawty

**Easy path (CLI still installed):**

```bash
klawty uninstall                                   # Interactive
klawty uninstall --all --yes --non-interactive     # Non-interactive, remove everything
```

**Manual uninstall:**

1. Stop the gateway:

```bash
klawty gateway stop
```

2. Uninstall the service:

```bash
klawty gateway uninstall
```

3. Delete state:

```bash
rm -rf "${KLAWTY_STATE_DIR:-$HOME/.klawty}"
```

4. Delete workspace (optional):

```bash
rm -rf ~/.klawty/workspace
```

5. Remove the CLI:

```bash
npm rm -g klawty
# or
pnpm remove -g klawty
```

6. Remove macOS app (if installed):

```bash
rm -rf /Applications/Klawty.app
```

**Manual service removal by platform:**

macOS (launchd):

```bash
launchctl bootout gui/$UID/ai.klawty.gateway
rm -f ~/Library/LaunchAgents/ai.klawty.gateway.plist
```

Linux (systemd):

```bash
systemctl --user disable --now klawty-gateway.service
rm -f ~/.config/systemd/user/klawty-gateway.service
systemctl --user daemon-reload
```

Windows (Scheduled Task):

```powershell
schtasks /Delete /F /TN "Klawty Gateway"
Remove-Item -Force "$env:USERPROFILE\.klawty\gateway.cmd"
```

---

## Plugin Installation and Activation

### Step 1: List Loaded Plugins

```bash
klawty plugins list
```

Shows all bundled and installed plugins with their current state: `loaded`, `disabled`, or `error`.

### Step 2: Install a Plugin

**From npm registry:**

```bash
klawty plugins install @klawty/voice-call           # Official plugin
klawty plugins install voice-call@1.2.3             # Exact version
klawty plugins install voice-call@beta              # Beta dist-tag
klawty plugins install @scope/voice-call            # Scoped package
klawty plugins install voice-call@latest --pin      # Pin exact version
```

**From a local directory:**

```bash
klawty plugins install ./my-plugin                  # Copy and install deps
klawty plugins install -l ./my-plugin               # Link (no copy, dev mode)
```

**From an archive file (.tgz, .tar.gz, .tar, .zip):**

```bash
klawty plugins install ./my-plugin.tgz
```

**From a marketplace:**

```bash
klawty plugins marketplace list claude              # Browse Claude marketplace
klawty plugins install voice-call@claude            # Install from marketplace
klawty plugins install voice-call --marketplace owner/repo   # GitHub marketplace
klawty plugins install voice-call --marketplace ./local      # Local marketplace
```

Installed files go to `~/.klawty/extensions/<plugin-id>/`.

### Step 3: Enable the Plugin

Plugins are **enabled by default** after installation. If a plugin was previously disabled:

```bash
klawty plugins enable <plugin-id>
```

To disable a plugin:

```bash
klawty plugins disable <plugin-id>
```

### Step 4: Configure the Plugin

Edit `~/.klawty/klawty.json` to add plugin-specific settings:

```json5
{
  plugins: {
    entries: {
      "voice-call": {
        enabled: true,
        config: {
          provider: "twilio",
          // any plugin-specific settings go here
        }
      }
    }
  }
}
```

### Step 5: Restart the Gateway

Configuration changes require a gateway restart:

```bash
klawty gateway restart
```

### Step 6: Verify

```bash
klawty plugins list                   # Confirm plugin shows "loaded"
klawty plugins inspect <plugin-id>    # Deep introspection of plugin details
klawty plugins doctor                 # Debug any load failures
```

---

## Plugin Management Commands

| Action | Command |
|--------|---------|
| List all plugins | `klawty plugins list` |
| Install a plugin | `klawty plugins install <path-or-spec>` |
| Update one plugin | `klawty plugins update <id>` |
| Update all plugins | `klawty plugins update --all` |
| Enable a plugin | `klawty plugins enable <id>` |
| Disable a plugin | `klawty plugins disable <id>` |
| Uninstall a plugin | `klawty plugins uninstall <id>` |
| Inspect a plugin | `klawty plugins inspect <id>` |
| Inspect (JSON) | `klawty plugins inspect <id> --json` |
| Debug load failures | `klawty plugins doctor` |
| Browse marketplace | `klawty plugins marketplace list <name>` |
| Dry-run uninstall | `klawty plugins uninstall <id> --dry-run` |
| Keep files on uninstall | `klawty plugins uninstall <id> --keep-files` |

---

## Official Installable Plugins

| Plugin | npm Spec | Description |
|--------|----------|-------------|
| Matrix | `@klawty/matrix` | Matrix protocol messaging channel |
| Microsoft Teams | `@klawty/msteams` | Microsoft Teams channel |
| Nostr | `@klawty/nostr` | Nostr protocol channel |
| Voice Call | `@klawty/voice-call` | Twilio/telephony voice channel |
| Zalo | `@klawty/zalo` | Zalo Official Account channel |
| Zalo Personal | `@klawty/zalouser` | Zalo personal account channel |

**Bundled plugins (shipped with Klawty, no install needed):**

- **Memory**: `memory-core` (default), `memory-lancedb` (install-on-demand)
- **Model providers**: anthropic, openai, google, mistral, openrouter, amazon-bedrock, cloudflare-ai-gateway, byteplus, chutes, and more (enabled by default)
- **Speech**: elevenlabs, microsoft (enabled by default)
- **Channels**: discord, telegram, slack, signal, whatsapp, imessage, bluebubbles, googlechat, mattermost, irc, line, feishu, twitch (disabled by default, enable individually)
- **Other**: copilot-proxy (disabled by default), diagnostics-otel, diffs, brave

---

## Plugin Configuration Reference

### Allowlist and Denylist

Control which plugins load via allowlist and denylist. Deny always wins over allow.

```json5
{
  plugins: {
    allow: ["voice-call", "memory-lancedb"],    // only these load
    deny: ["untrusted-plugin"],                 // deny always wins
  }
}
```

### Exclusive Slots

Some capabilities use exclusive slots where only one plugin can fill a role:

```json5
{
  plugins: {
    slots: {
      memory: "memory-lancedb"       // replaces default memory-core
    }
  }
}
```

### Per-Plugin Config

Configure individual plugins under `plugins.entries`:

```json5
{
  plugins: {
    entries: {
      "voice-call": {
        enabled: true,
        config: {
          provider: "twilio",
          twilioAccountSid: "AC...",
          twilioAuthToken: "...",
        }
      },
      "discord": {
        enabled: true,
        config: {}
      }
    }
  }
}
```

### Load Extra Plugin Paths

Load plugins from custom directories:

```json5
{
  plugins: {
    load: {
      paths: ["~/Projects/oss/my-plugin", "/opt/klawty-plugins"]
    }
  }
}
```

---

## Building Custom Plugins

### Plugin Directory Structure

```
my-plugin/
  package.json              # npm metadata + klawty config
  klawty.plugin.json        # Plugin manifest
  index.ts                  # Entry point
  setup-entry.ts            # Setup wizard (optional)
  api.ts                    # Public contract barrel (optional)
  runtime-api.ts            # Internal runtime barrel (optional)
  src/
    channel.ts              # Implementation
    runtime.ts              # Runtime wiring
    *.test.ts               # Colocated tests
```

### Minimal package.json

```json
{
  "name": "@klawty/my-plugin",
  "version": "1.0.0",
  "type": "module",
  "klawty": {
    "extensions": ["./index.ts"]
  }
}
```

### Minimal klawty.plugin.json

```json
{
  "id": "my-plugin",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

### Entry Point (index.ts)

```typescript
import { defineChannelPluginEntry } from "klawty/plugin-sdk/core";

export default defineChannelPluginEntry({
  id: "my-plugin",
  name: "My Plugin",
  description: "What this plugin does",
  plugin: {
    // capability implementation
  },
});
```

### Plugin SDK Import Rules

Always use focused subpath imports:

```typescript
// Correct
import { defineChannelPluginEntry } from "klawty/plugin-sdk/core";
import { createChannelReplyPipeline } from "klawty/plugin-sdk/channel-reply-pipeline";
import { createPluginRuntimeStore } from "klawty/plugin-sdk/runtime-store";

// Wrong (monolithic root import, lint will reject)
import { ... } from "klawty/plugin-sdk";
```

Common SDK subpaths:

| Subpath | Purpose |
|---------|---------|
| `plugin-sdk/core` | Plugin entry definitions, base types |
| `plugin-sdk/channel-setup` | Optional setup adapters and wizards |
| `plugin-sdk/channel-pairing` | DM pairing primitives |
| `plugin-sdk/channel-reply-pipeline` | Prefix + typing reply wiring |
| `plugin-sdk/channel-config-schema` | Config schema builders |
| `plugin-sdk/channel-policy` | Group/DM policy helpers |
| `plugin-sdk/secret-input` | Secret input parsing |
| `plugin-sdk/webhook-ingress` | Webhook request/target helpers |
| `plugin-sdk/runtime-store` | Persistent plugin storage |
| `plugin-sdk/allow-from` | Allowlist resolution |
| `plugin-sdk/reply-payload` | Message reply types |
| `plugin-sdk/provider-onboard` | Provider onboarding config patches |
| `plugin-sdk/testing` | Test utilities |

### Testing Your Plugin

```bash
pnpm test:contracts:channels     # Channel plugin contracts
pnpm test:contracts:plugins      # Provider plugin contracts
pnpm check                       # Lint + format + types
```

### Pre-Submission Checklist

- `package.json` has correct `klawty` metadata with `extensions` field
- Entry point uses `defineChannelPluginEntry` or `definePluginEntry`
- All imports use focused `plugin-sdk/<subpath>` paths
- Internal imports use local barrels (`./api.ts`), not SDK self-imports
- `klawty.plugin.json` manifest is valid
- Contract tests pass
- Unit tests colocated as `*.test.ts`
- `pnpm check` passes
