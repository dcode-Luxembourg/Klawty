---
summary: "Run the ACP bridge for IDE integrations"
read_when:
  - Setting up ACP-based IDE integrations
  - Debugging ACP session routing to the Gateway
title: "acp"
---

# acp

Run the [Agent Client Protocol (ACP)](https://agentclientprotocol.com/) bridge that talks to an Klawty Gateway.

This command speaks ACP over stdio for IDEs and forwards prompts to the Gateway
over WebSocket. It keeps ACP sessions mapped to Gateway session keys.

`klawty acp` is a Gateway-backed ACP bridge, not a full ACP-native editor
runtime. It focuses on session routing, prompt delivery, and basic streaming
updates.

## Compatibility Matrix

| ACP area                                                              | Status      | Notes                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `initialize`, `newSession`, `prompt`, `cancel`                        | Implemented | Core bridge flow over stdio to Gateway chat/send + abort.                                                                                                                                                                                        |
| `listSessions`, slash commands                                        | Implemented | Session list works against Gateway session state; commands are advertised via `available_commands_update`.                                                                                                                                       |
| `loadSession`                                                         | Partial     | Rebinds the ACP session to a Gateway session key and replays stored user/assistant text history. Tool/system history is not reconstructed yet.                                                                                                   |
| Prompt content (`text`, embedded `resource`, images)                  | Partial     | Text/resources are flattened into chat input; images become Gateway attachments.                                                                                                                                                                 |
| Session modes                                                         | Partial     | `session/set_mode` is supported and the bridge exposes initial Gateway-backed session controls for thought level, tool verbosity, reasoning, usage detail, and elevated actions. Broader ACP-native mode/config surfaces are still out of scope. |
| Session info and usage updates                                        | Partial     | The bridge emits `session_info_update` and best-effort `usage_update` notifications from cached Gateway session snapshots. Usage is approximate and only sent when Gateway token totals are marked fresh.                                        |
| Tool streaming                                                        | Partial     | `tool_call` / `tool_call_update` events include raw I/O, text content, and best-effort file locations when Gateway tool args/results expose them. Embedded terminals and richer diff-native output are still not exposed.                        |
| Per-session MCP servers (`mcpServers`)                                | Unsupported | Bridge mode rejects per-session MCP server requests. Configure MCP on the Klawty gateway or agent instead.                                                                                                                                       |
| Client filesystem methods (`fs/read_text_file`, `fs/write_text_file`) | Unsupported | The bridge does not call ACP client filesystem methods.                                                                                                                                                                                          |
| Client terminal methods (`terminal/*`)                                | Unsupported | The bridge does not create ACP client terminals or stream terminal ids through tool calls.                                                                                                                                                       |
| Session plans / thought streaming                                     | Unsupported | The bridge currently emits output text and tool status, not ACP plan or thought updates.                                                                                                                                                         |

## Known Limitations

- `loadSession` replays stored user and assistant text history, but it does not
  reconstruct historic tool calls, system notices, or richer ACP-native event
  types.
- If multiple ACP clients share the same Gateway session key, event and cancel
  routing are best-effort rather than strictly isolated per client. Prefer the
  default isolated `acp:<uuid>` sessions when you need clean editor-local
  turns.
- Gateway stop states are translated into ACP stop reasons, but that mapping is
  less expressive than a fully ACP-native runtime.
- Initial session controls currently surface a focused subset of Gateway knobs:
  thought level, tool verbosity, reasoning, usage detail, and elevated
  actions. Model selection and exec-host controls are not yet exposed as ACP
  config options.
- `session_info_update` and `usage_update` are derived from Gateway session
  snapshots, not live ACP-native runtime accounting. Usage is approximate,
  carries no cost data, and is only emitted when the Gateway marks total token
  data as fresh.
- Tool follow-along data is best-effort. The bridge can surface file paths that
  appear in known tool args/results, but it does not yet emit ACP terminals or
  structured file diffs.

## Usage

```bash
klawty acp

# Remote Gateway
klawty acp --url wss://gateway-host:2508 --token <token>

# Remote Gateway (token from file)
klawty acp --url wss://gateway-host:2508 --token-file ~/.klawty/gateway.token

# Attach to an existing session key
klawty acp --session agent:main:main

# Attach by label (must already exist)
klawty acp --session-label "support inbox"

# Reset the session key before the first prompt
klawty acp --session agent:main:main --reset-session
```

## ACP client (debug)

Use the built-in ACP client to sanity-check the bridge without an IDE.
It spawns the ACP bridge and lets you type prompts interactively.

```bash
klawty acp client

# Point the spawned bridge at a remote Gateway
klawty acp client --server-args --url wss://gateway-host:2508 --token-file ~/.klawty/gateway.token

# Override the server command (default: klawty)
klawty acp client --server "node" --server-args klawty.mjs acp --url ws://127.0.0.1:19001
```

Permission model (client debug mode):

- Auto-approval is allowlist-based and only applies to trusted core tool IDs.
- `read` auto-approval is scoped to the current working directory (`--cwd` when set).
- Unknown/non-core tool names, out-of-scope reads, and dangerous tools always require explicit prompt approval.
- Server-provided `toolCall.kind` is treated as untrusted metadata (not an authorization source).

## How to use this

Use ACP when an IDE (or other client) speaks Agent Client Protocol and you want
it to drive an Klawty Gateway session.

1. Ensure the Gateway is running (local or remote).
2. Configure the Gateway target (config or flags).
3. Point your IDE to run `klawty acp` over stdio.

Example config (persisted):

```bash
klawty config set gateway.remote.url wss://gateway-host:2508
klawty config set gateway.remote.token <token>
```

Example direct run (no config write):

```bash
klawty acp --url wss://gateway-host:2508 --token <token>
# preferred for local process safety
klawty acp --url wss://gateway-host:2508 --token-file ~/.klawty/gateway.token
```

## Selecting agents

ACP does not pick agents directly. It routes by the Gateway session key.

Use agent-scoped session keys to target a specific agent:

```bash
klawty acp --session agent:main:main
klawty acp --session agent:design:main
klawty acp --session agent:qa:bug-123
```

Each ACP session maps to a single Gateway session key. One agent can have many
sessions; ACP defaults to an isolated `acp:<uuid>` session unless you override
the key or label.

Per-session `mcpServers` are not supported in bridge mode. If an ACP client
sends them during `newSession` or `loadSession`, the bridge returns a clear
error instead of silently ignoring them.

## Use from `acpx` (Codex, Claude, other ACP clients)

If you want a coding agent such as Codex or Claude Code to talk to your
Klawty bot over ACP, use `acpx` with its built-in `klawty` target.

Typical flow:

1. Run the Gateway and make sure the ACP bridge can reach it.
2. Point `acpx klawty` at `klawty acp`.
3. Target the Klawty session key you want the coding agent to use.

Examples:

```bash
# One-shot request into your default Klawty ACP session
acpx klawty exec "Summarize the active Klawty session state."

# Persistent named session for follow-up turns
acpx klawty sessions ensure --name codex-bridge
acpx klawty -s codex-bridge --cwd /path/to/repo \
  "Ask my Klawty work agent for recent context relevant to this repo."
```

If you want `acpx klawty` to target a specific Gateway and session key every
time, override the `klawty` agent command in `~/.acpx/config.json`:

```json
{
  "agents": {
    "klawty": {
      "command": "env KLAWTY_HIDE_BANNER=1 KLAWTY_SUPPRESS_NOTES=1 klawty acp --url ws://127.0.0.1:2508 --token-file ~/.klawty/gateway.token --session agent:main:main"
    }
  }
}
```

For a repo-local Klawty checkout, use the direct CLI entrypoint instead of the
dev runner so the ACP stream stays clean. For example:

```bash
env KLAWTY_HIDE_BANNER=1 KLAWTY_SUPPRESS_NOTES=1 node klawty.mjs acp ...
```

This is the easiest way to let Codex, Claude Code, or another ACP-aware client
pull contextual information from an Klawty agent without scraping a terminal.

## Zed editor setup

Add a custom ACP agent in `~/.config/zed/settings.json` (or use Zed’s Settings UI):

```json
{
  "agent_servers": {
    "Klawty ACP": {
      "type": "custom",
      "command": "klawty",
      "args": ["acp"],
      "env": {}
    }
  }
}
```

To target a specific Gateway or agent:

```json
{
  "agent_servers": {
    "Klawty ACP": {
      "type": "custom",
      "command": "klawty",
      "args": [
        "acp",
        "--url",
        "wss://gateway-host:2508",
        "--token",
        "<token>",
        "--session",
        "agent:design:main"
      ],
      "env": {}
    }
  }
}
```

In Zed, open the Agent panel and select “Klawty ACP” to start a thread.

## Session mapping

By default, ACP sessions get an isolated Gateway session key with an `acp:` prefix.
To reuse a known session, pass a session key or label:

- `--session <key>`: use a specific Gateway session key.
- `--session-label <label>`: resolve an existing session by label.
- `--reset-session`: mint a fresh session id for that key (same key, new transcript).

If your ACP client supports metadata, you can override per session:

```json
{
  "_meta": {
    "sessionKey": "agent:main:main",
    "sessionLabel": "support inbox",
    "resetSession": true
  }
}
```

Learn more about session keys at [/concepts/session](/concepts/session).

## Options

- `--url <url>`: Gateway WebSocket URL (defaults to gateway.remote.url when configured).
- `--token <token>`: Gateway auth token.
- `--token-file <path>`: read Gateway auth token from file.
- `--password <password>`: Gateway auth password.
- `--password-file <path>`: read Gateway auth password from file.
- `--session <key>`: default session key.
- `--session-label <label>`: default session label to resolve.
- `--require-existing`: fail if the session key/label does not exist.
- `--reset-session`: reset the session key before first use.
- `--no-prefix-cwd`: do not prefix prompts with the working directory.
- `--verbose, -v`: verbose logging to stderr.

Security note:

- `--token` and `--password` can be visible in local process listings on some systems.
- Prefer `--token-file`/`--password-file` or environment variables (`KLAWTY_GATEWAY_TOKEN`, `KLAWTY_GATEWAY_PASSWORD`).
- Gateway auth resolution follows the shared contract used by other Gateway clients:
  - local mode: env (`KLAWTY_GATEWAY_*`) -> `gateway.auth.*` -> `gateway.remote.*` fallback only when `gateway.auth.*` is unset (configured-but-unresolved local SecretRefs fail closed)
  - remote mode: `gateway.remote.*` with env/config fallback per remote precedence rules
  - `--url` is override-safe and does not reuse implicit config/env credentials; pass explicit `--token`/`--password` (or file variants)
- ACP runtime backend child processes receive `KLAWTY_SHELL=acp`, which can be used for context-specific shell/profile rules.
- `klawty acp client` sets `KLAWTY_SHELL=acp-client` on the spawned bridge process.

### `acp client` options

- `--cwd <dir>`: working directory for the ACP session.
- `--server <command>`: ACP server command (default: `klawty`).
- `--server-args <args...>`: extra arguments passed to the ACP server.
- `--server-verbose`: enable verbose logging on the ACP server.
- `--verbose, -v`: verbose client logging.
