"use strict";

/**
 * Klawty Runtime — Terminal UI Dashboard
 *
 * Full-screen terminal dashboard using only ANSI escape codes.
 * No external dependencies — works over SSH, minimal terminal.
 *
 * Usage:
 *   node tui-dashboard.js --workspace /path/to/workspace
 *
 * Keyboard:
 *   q — quit
 *   r — manual refresh
 *   s — toggle detailed status view
 *   l — toggle recent logs view
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// ANSI escape codes
// ---------------------------------------------------------------------------

var C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
  bgBlack: "\x1b[40m",
  clear: "\x1b[2J\x1b[H",
  hideCursor: "\x1b[?25l",
  showCursor: "\x1b[?25h",
};

// Box drawing characters
var B = {
  tl: "\u250c",
  tr: "\u2510",
  bl: "\u2514",
  br: "\u2518",
  h: "\u2500",
  v: "\u2502",
  lt: "\u251c",
  rt: "\u2524",
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

var _workspaceDir = null;
var _config = null;
var _refreshTimer = null;
var _view = "main"; // 'main', 'status', 'logs'
var _width = 60;
var _taskDb = null;
var _costTracker = null;

var REFRESH_MS = 5000;
var VERSION = "1.0.0";

// Agent data cache (refreshed each render)
var _data = {
  agents: [],
  taskStats: { backlog: 0, active: 0, done: 0, failed: 0 },
  health: {},
  cost: { daily: 0, cap: 15.0, pct: 0 },
  activity: [],
  dbOk: false,
};

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function init(workspaceDir) {
  _workspaceDir = workspaceDir;

  // Try to read version from package.json
  try {
    var pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));
    VERSION = pkg.version || VERSION;
  } catch (_e) {
    /* use default */
  }

  // Try to load config
  try {
    var configPath = path.join(workspaceDir, "..", "klawty.json");
    if (fs.existsSync(configPath)) {
      var raw = fs
        .readFileSync(configPath, "utf8")
        .replace(/\/\/[^\n]*/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      _config = JSON.parse(raw);
    }
  } catch (_e) {
    /* non-fatal */
  }

  // Try to connect to task DB (optional — dashboard works without it)
  try {
    var Database = require("better-sqlite3");
    var dbPath = path.join(workspaceDir, "data", "tasks.db");
    if (fs.existsSync(dbPath)) {
      _taskDb = new Database(dbPath, { readonly: true });
      _data.dbOk = true;
    }
  } catch (_e) {
    _data.dbOk = false;
  }

  // Try to load cost tracker data
  try {
    _costTracker = require("./cost-tracker");
  } catch (_e) {
    _costTracker = null;
  }
}

// ---------------------------------------------------------------------------
// Data collection
// ---------------------------------------------------------------------------

function _refreshData() {
  _width = process.stdout.columns || 60;
  if (_width < 40) {_width = 40;}

  // Agent list from config
  _data.agents = [];
  if (_config && _config.agents && _config.agents.list) {
    for (var i = 0; i < _config.agents.list.length; i++) {
      var a = _config.agents.list[i];
      _data.agents.push({
        name: a.name || "unnamed",
        emoji: a.emoji || "\u2022",
        model: a.model || "default",
      });
    }
  }

  // Task stats from DB
  if (_taskDb) {
    try {
      var rows = _taskDb.prepare("SELECT status, COUNT(*) as cnt FROM tasks GROUP BY status").all();

      _data.taskStats = { backlog: 0, active: 0, done: 0, failed: 0 };
      for (var j = 0; j < rows.length; j++) {
        var r = rows[j];
        if (r.status === "backlog") {_data.taskStats.backlog += r.cnt;}
        else if (r.status === "in_progress" || r.status === "review")
          {_data.taskStats.active += r.cnt;}
        else if (r.status === "done") {_data.taskStats.done += r.cnt;}
        else if (r.status === "failed") {_data.taskStats.failed += r.cnt;}
      }
    } catch (_e) {
      /* non-fatal */
    }

    // Per-agent status from recent tasks
    try {
      var agentRows = _taskDb
        .prepare(
          "SELECT agent, status, title, updated_at FROM tasks WHERE status IN ('in_progress','backlog') ORDER BY updated_at DESC LIMIT 50",
        )
        .all();

      var agentTasks = {};
      for (var k = 0; k < agentRows.length; k++) {
        var ar = agentRows[k];
        if (!agentTasks[ar.agent]) {
          agentTasks[ar.agent] = { status: ar.status, task: ar.title };
        }
      }

      for (var m = 0; m < _data.agents.length; m++) {
        var ag = _data.agents[m];
        var at = agentTasks[ag.name];
        if (at) {
          ag.status = at.status === "in_progress" ? "active" : "idle";
          ag.task = at.task;
        } else {
          ag.status = "idle";
          ag.task = null;
        }
      }
    } catch (_e) {
      /* non-fatal */
    }

    // Recent activity from completed tasks
    try {
      var recentRows = _taskDb
        .prepare(
          "SELECT agent, title, completed_at FROM tasks WHERE status='done' AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 5",
        )
        .all();

      _data.activity = [];
      for (var n = 0; n < recentRows.length; n++) {
        var rr = recentRows[n];
        var time = rr.completed_at ? rr.completed_at.slice(11, 16) : "??:??";
        _data.activity.push({ time: time, agent: rr.agent, text: rr.title });
      }
    } catch (_e) {
      /* non-fatal */
    }

    // Per-agent 24h cost
    try {
      var costRows = _taskDb
        .prepare(
          "SELECT agent, SUM(cost_usd) as total FROM agent_costs WHERE date(created_at) = date('now') GROUP BY agent",
        )
        .all();

      var costMap = {};
      for (var p = 0; p < costRows.length; p++) {
        costMap[costRows[p].agent] = costRows[p].total || 0;
      }

      for (var q = 0; q < _data.agents.length; q++) {
        _data.agents[q].cost24h = costMap[_data.agents[q].name] || 0;
      }
    } catch (_e) {
      // agent_costs table might not exist
    }
  }

  // Cost summary
  if (_costTracker) {
    try {
      var summary = _costTracker.getSpendingSummary();
      _data.cost.daily = summary.dailyTotal || 0;
      _data.cost.cap = summary.cap || 15.0;
      _data.cost.pct = summary.pct || 0;
    } catch (_e) {
      /* non-fatal */
    }
  }

  // Health status — check key components
  _data.health = {};
  _data.health["DB"] = _data.dbOk ? "ok" : "err";

  // Check if data directory is writable
  try {
    var testPath = path.join(_workspaceDir, "data", ".health-check");
    fs.writeFileSync(testPath, "ok");
    fs.unlinkSync(testPath);
    _data.health["Disk"] = "ok";
  } catch (_e) {
    _data.health["Disk"] = "err";
  }

  // Disk usage percentage
  try {
    var { execFileSync } = require("child_process");
    var dfOut = execFileSync("df", ["-k", _workspaceDir], { encoding: "utf8", timeout: 3000 });
    var dfLines = dfOut.trim().split("\n");
    if (dfLines.length >= 2) {
      var parts = dfLines[1].trim().split(/\s+/);
      var cap = parseInt(parts[1], 10);
      var used = parseInt(parts[2], 10);
      if (cap > 0) {_data.health["Disk"] = Math.round((used / cap) * 100) + "%";}
    }
  } catch (_e) {
    /* non-fatal */
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function _render() {
  _refreshData();

  var lines = [];
  var w = _width;
  var inner = w - 2; // inside the box

  switch (_view) {
    case "status":
      _renderStatus(lines, w, inner);
      break;
    case "logs":
      _renderLogs(lines, w, inner);
      break;
    default:
      _renderMain(lines, w, inner);
      break;
  }

  process.stdout.write(C.clear + lines.join("\n") + "\n");
}

function _renderMain(lines, w, inner) {
  // Header
  lines.push(_box_top(inner));
  var title = "  \uD83E\uDD9E KLAWTY v" + VERSION;
  var right = "ai-agent-builder.ai   " + C.green + "LIVE" + C.reset;
  lines.push(_box_row(_pad(title, inner - 24) + right, inner));
  lines.push(_box_sep(inner));

  // Agents table
  var hdr =
    "  " +
    _padR("AGENTS", 18) +
    _padR("STATUS", 10) +
    _padR("TASK", inner - 48) +
    _padR("COST/24h", 10);
  lines.push(_box_row(C.bold + C.cyan + hdr + C.reset, inner));

  for (var i = 0; i < _data.agents.length; i++) {
    var a = _data.agents[i];
    var statusIcon =
      a.status === "active"
        ? C.green + "\u25cf active " + C.reset
        : C.dim + "\u25cb idle   " + C.reset;
    var taskText = a.task ? _truncate(a.task, inner - 48) : "\u2014";
    var costText = "$" + (a.cost24h || 0).toFixed(2);

    var row =
      "  " +
      _padR((a.emoji || "") + " " + _capitalize(a.name), 18) +
      _padR(statusIcon, 10 + 9) +
      _padR(taskText, inner - 48) +
      _padR(costText, 10);
    lines.push(_box_row(row, inner + 9)); // +9 for ANSI color codes in statusIcon
  }

  if (_data.agents.length === 0) {
    lines.push(_box_row(C.dim + "  No agents configured" + C.reset, inner));
  }

  // Task stats
  lines.push(_box_sep(inner));
  var ts = _data.taskStats;
  var taskLine =
    "  TASKS  backlog: " +
    ts.backlog +
    "  active: " +
    ts.active +
    "  done: " +
    ts.done +
    "  failed: " +
    (ts.failed > 0 ? C.red + ts.failed + C.reset : ts.failed);
  lines.push(_box_row(taskLine, inner + (ts.failed > 0 ? 9 : 0)));

  // Health
  lines.push(_box_sep(inner));
  var healthParts = [];
  var hkeys = Object.keys(_data.health);
  for (var j = 0; j < hkeys.length; j++) {
    var hk = hkeys[j];
    var hv = _data.health[hk];
    if (hv === "ok") {
      healthParts.push(hk + ": " + C.green + "\u2713" + C.reset);
    } else if (hv === "err") {
      healthParts.push(hk + ": " + C.red + "\u2717" + C.reset);
    } else {
      healthParts.push(hk + ": " + hv);
    }
  }
  lines.push(_box_row("  HEALTH  " + healthParts.join("  "), inner + hkeys.length * 9));

  // Cost bar
  lines.push(_box_sep(inner));
  var cost = _data.cost;
  var barLen = 20;
  var filled = Math.round((cost.pct / 100) * barLen);
  var empty = barLen - filled;
  var barColor = cost.pct >= 80 ? C.red : cost.pct >= 50 ? C.yellow : C.green;
  var bar = barColor + "\u2588".repeat(filled) + C.dim + "\u2591".repeat(empty) + C.reset;
  var costLine =
    "  COST TODAY  $" +
    cost.daily.toFixed(2) +
    " / $" +
    cost.cap.toFixed(2) +
    " cap  [" +
    bar +
    "] " +
    cost.pct +
    "%";
  lines.push(_box_row(costLine, inner + 18)); // account for ANSI codes

  // Recent activity
  lines.push(_box_sep(inner));
  lines.push(_box_row(C.bold + "  RECENT ACTIVITY" + C.reset, inner));

  if (_data.activity.length > 0) {
    for (var k = 0; k < _data.activity.length; k++) {
      var act = _data.activity[k];
      var aLine =
        "  " +
        C.dim +
        act.time +
        C.reset +
        " " +
        _capitalize(act.agent) +
        " \u2014 " +
        _truncate(act.text, inner - 25);
      lines.push(_box_row(aLine, inner + 8)); // ANSI color codes
    }
  } else {
    lines.push(_box_row(C.dim + "  No recent activity" + C.reset, inner));
  }

  // Footer
  lines.push(_box_sep(inner));
  var footer = "  [q] quit  [r] refresh  [s] status  [l] logs";
  lines.push(_box_row(C.dim + footer + C.reset, inner));
  lines.push(_box_bot(inner));
}

function _renderStatus(lines, w, inner) {
  lines.push(_box_top(inner));
  lines.push(_box_row(C.bold + C.cyan + "  DETAILED STATUS" + C.reset, inner));
  lines.push(_box_sep(inner));

  // Per-agent detail
  for (var i = 0; i < _data.agents.length; i++) {
    var a = _data.agents[i];
    lines.push(
      _box_row("  " + C.bold + (a.emoji || "") + " " + _capitalize(a.name) + C.reset, inner),
    );
    lines.push(_box_row("    Model:  " + (a.model || "default"), inner));
    lines.push(_box_row("    Status: " + (a.status || "unknown"), inner));
    lines.push(_box_row("    Task:   " + (a.task || "none"), inner));
    lines.push(_box_row("    Cost:   $" + (a.cost24h || 0).toFixed(4), inner));
    if (i < _data.agents.length - 1) {
      lines.push(_box_row("", inner));
    }
  }

  if (_data.agents.length === 0) {
    lines.push(_box_row(C.dim + "  No agents configured" + C.reset, inner));
  }

  // DB stats
  lines.push(_box_sep(inner));
  lines.push(
    _box_row(
      "  Database: " +
        (_data.dbOk ? C.green + "connected" + C.reset : C.red + "disconnected" + C.reset),
      inner + 9,
    ),
  );

  var ts = _data.taskStats;
  lines.push(
    _box_row(
      "  Tasks — backlog: " +
        ts.backlog +
        "  active: " +
        ts.active +
        "  done: " +
        ts.done +
        "  failed: " +
        ts.failed,
      inner,
    ),
  );

  // Footer
  lines.push(_box_sep(inner));
  lines.push(_box_row(C.dim + "  [q] quit  [r] refresh  [m] main  [l] logs" + C.reset, inner));
  lines.push(_box_bot(inner));
}

function _renderLogs(lines, w, inner) {
  lines.push(_box_top(inner));
  lines.push(_box_row(C.bold + C.cyan + "  RECENT LOGS" + C.reset, inner));
  lines.push(_box_sep(inner));

  // Read recent lines from log files
  var logLines = _readRecentLogs(15);
  if (logLines.length > 0) {
    for (var i = 0; i < logLines.length; i++) {
      var line = logLines[i];
      // Colorize based on level
      if (line.indexOf('"error"') !== -1 || line.indexOf("[ERROR]") !== -1) {
        line = C.red + _truncate(line, inner - 4) + C.reset;
      } else if (line.indexOf('"warn"') !== -1 || line.indexOf("[WARN]") !== -1) {
        line = C.yellow + _truncate(line, inner - 4) + C.reset;
      } else {
        line = C.dim + _truncate(line, inner - 4) + C.reset;
      }
      lines.push(_box_row("  " + line, inner + 9));
    }
  } else {
    lines.push(_box_row(C.dim + "  No log files found" + C.reset, inner));
  }

  // Footer
  lines.push(_box_sep(inner));
  lines.push(_box_row(C.dim + "  [q] quit  [r] refresh  [m] main  [s] status" + C.reset, inner));
  lines.push(_box_bot(inner));
}

// ---------------------------------------------------------------------------
// Log reading
// ---------------------------------------------------------------------------

function _readRecentLogs(maxLines) {
  var logDirs = [path.join(_workspaceDir, "logs"), path.join(_workspaceDir, "..", "logs")];

  for (var d = 0; d < logDirs.length; d++) {
    if (!fs.existsSync(logDirs[d])) {continue;}

    try {
      var logFiles = fs
        .readdirSync(logDirs[d])
        .filter(function (f) {
          return f.endsWith(".log");
        })
        .map(function (f) {
          var fp = path.join(logDirs[d], f);
          try {
            return { name: f, path: fp, mtime: fs.statSync(fp).mtimeMs };
          } catch (_e) {
            return null;
          }
        })
        .filter(Boolean)
        .toSorted(function (a, b) {
          return b.mtime - a.mtime;
        });

      if (logFiles.length === 0) {continue;}

      // Read tail of the most recently modified log file
      var target = logFiles[0].path;
      var content = _readTail(target, 4096);
      var allLines = content.split("\n").filter(function (l) {
        return l.trim().length > 0;
      });

      return allLines.slice(Math.max(0, allLines.length - maxLines));
    } catch (_e) {
      /* try next dir */
    }
  }

  return [];
}

function _readTail(filePath, bytes) {
  try {
    var stat = fs.statSync(filePath);
    var size = stat.size;
    if (size <= bytes) {return fs.readFileSync(filePath, "utf8");}

    var fd = fs.openSync(filePath, "r");
    var buf = Buffer.alloc(bytes);
    fs.readSync(fd, buf, 0, bytes, size - bytes);
    fs.closeSync(fd);
    return buf.toString("utf8");
  } catch (_e) {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Box drawing helpers
// ---------------------------------------------------------------------------

function _box_top(inner) {
  return B.tl + B.h.repeat(inner) + B.tr;
}
function _box_bot(inner) {
  return B.bl + B.h.repeat(inner) + B.br;
}
function _box_sep(inner) {
  return B.lt + B.h.repeat(inner) + B.rt;
}

function _box_row(content, inner) {
  // Strip ANSI codes for length calculation
  var visible = content.replace(/\x1b\[[0-9;]*m/g, "");
  var pad = inner - visible.length;
  if (pad < 0) {pad = 0;}
  return B.v + content + " ".repeat(pad) + B.v;
}

// ---------------------------------------------------------------------------
// String helpers
// ---------------------------------------------------------------------------

function _padR(str, len) {
  var visible = str.replace(/\x1b\[[0-9;]*m/g, "");
  if (visible.length >= len) {return str;}
  return str + " ".repeat(len - visible.length);
}

function _pad(str, len) {
  return _padR(str, len);
}

function _truncate(str, max) {
  if (!str) {return "";}
  if (str.length <= max) {return str;}
  return str.slice(0, max - 1) + "\u2026";
}

function _capitalize(str) {
  if (!str) {return "";}
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ---------------------------------------------------------------------------
// Keyboard input
// ---------------------------------------------------------------------------

function _setupInput() {
  if (!process.stdin.isTTY) {return;}

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  process.stdin.on("data", function (key) {
    switch (key) {
      case "q":
      case "\x03": // Ctrl+C
        _shutdown();
        break;
      case "r":
        _render();
        break;
      case "s":
        _view = _view === "status" ? "main" : "status";
        _render();
        break;
      case "l":
        _view = _view === "logs" ? "main" : "logs";
        _render();
        break;
      case "m":
        _view = "main";
        _render();
        break;
    }
  });
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

function start(workspaceDir) {
  init(workspaceDir);

  // Hide cursor
  process.stdout.write(C.hideCursor);

  _setupInput();
  _render();

  // Auto-refresh
  _refreshTimer = setInterval(_render, REFRESH_MS);
}

function _shutdown() {
  if (_refreshTimer) {
    clearInterval(_refreshTimer);
    _refreshTimer = null;
  }

  // Show cursor, clear screen
  process.stdout.write(C.showCursor);
  process.stdout.write(C.clear);

  // Close DB
  if (_taskDb) {
    try {
      _taskDb.close();
    } catch (_e) {
      /* ignore */
    }
    _taskDb = null;
  }

  process.exit(0);
}

// Handle clean exit
process.on("SIGTERM", _shutdown);
process.on("SIGINT", _shutdown);
process.on("exit", function () {
  process.stdout.write(C.showCursor);
});

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  var args = process.argv.slice(2);
  var workspaceArg = null;

  for (var i = 0; i < args.length; i++) {
    if (args[i] === "--workspace" && i + 1 < args.length) {
      workspaceArg = args[i + 1];
      break;
    }
  }

  var wsDir = workspaceArg ? path.resolve(workspaceArg) : path.resolve(process.cwd(), "workspace");

  if (!fs.existsSync(wsDir)) {
    process.stderr.write("[tui-dashboard] Workspace not found: " + wsDir + "\n");
    process.exit(1);
  }

  start(wsDir);
}

// ---------------------------------------------------------------------------
// Exports (for programmatic use)
// ---------------------------------------------------------------------------

module.exports = { init, start };
