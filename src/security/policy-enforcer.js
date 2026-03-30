"use strict";

/**
 * Klawty Runtime — Policy Enforcer
 *
 * Reads klawty-policy.yaml and enforces filesystem, network, and
 * execution policies before any tool action. Deny-by-default.
 */

const fs = require("fs");
const path = require("path");

let _policy = null;
let _log = console;
let _workspaceDir = null;
let _policyPath = null;
let _policyMtime = 0;

// ---------------------------------------------------------------------------
// Minimal YAML parser (no external deps)
// ---------------------------------------------------------------------------
// Handles: scalars, arrays (- item), nested maps (indentation-based),
// inline arrays ([a, b]), comments (#), quoted strings.

function _parseYaml(text) {
  var lines = text.split("\n");
  return _parseBlock(lines, 0, 0).value;
}

function _parseBlock(lines, start, minIndent) {
  var result = {};
  var i = start;

  while (i < lines.length) {
    var raw = lines[i];
    var stripped = raw.replace(/#(?=(?:[^"]*"[^"]*")*[^"]*$).*$/, ""); // strip comments
    var trimmed = stripped.trimEnd();

    if (trimmed.length === 0) {
      i++;
      continue;
    }

    var indent = raw.search(/\S/);
    if (indent < minIndent) {break;}

    // Array item at current level
    if (trimmed.trimStart().startsWith("- ")) {
      // This is an array — find the key that owns it by backtracking
      // Actually, arrays are parsed when we detect them under a key
      break;
    }

    var colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) {
      i++;
      continue;
    }

    var key = trimmed.substring(indent, colonIdx).trim();
    var valPart = trimmed.substring(colonIdx + 1).trim();

    if (valPart.length > 0) {
      // Inline value
      result[key] = _parseScalar(valPart);
      i++;
    } else {
      // Check next line for array or nested map
      var nextNonEmpty = _nextNonEmptyLine(lines, i + 1);
      if (nextNonEmpty < lines.length) {
        var nextIndent = lines[nextNonEmpty].search(/\S/);
        var nextTrimmed = lines[nextNonEmpty].trimStart();

        if (nextIndent > indent && nextTrimmed.startsWith("- ")) {
          // Array
          var arrResult = _parseArray(lines, i + 1, nextIndent);
          result[key] = arrResult.value;
          i = arrResult.next;
        } else if (nextIndent > indent) {
          // Nested map
          var mapResult = _parseBlock(lines, i + 1, nextIndent);
          result[key] = mapResult.value;
          i = mapResult.next;
        } else {
          result[key] = null;
          i++;
        }
      } else {
        result[key] = null;
        i++;
      }
    }
  }

  return { value: result, next: i };
}

function _parseArray(lines, start, minIndent) {
  var arr = [];
  var i = start;

  while (i < lines.length) {
    var raw = lines[i];
    var stripped = raw.replace(/#(?=(?:[^"]*"[^"]*")*[^"]*$).*$/, "");
    var trimmed = stripped.trimEnd();

    if (trimmed.length === 0) {
      i++;
      continue;
    }

    var indent = raw.search(/\S/);
    if (indent < minIndent) {break;}

    var line = trimmed.trimStart();
    if (!line.startsWith("- ")) {break;}

    var itemVal = line.substring(2).trim();

    // Check if this array item has nested keys (map item)
    var colonIdx = itemVal.indexOf(":");
    if (colonIdx !== -1) {
      // Inline map start — e.g., "- host: foo"
      var itemKey = itemVal.substring(0, colonIdx).trim();
      var itemRest = itemVal.substring(colonIdx + 1).trim();
      var obj = {};
      obj[itemKey] = _parseScalar(itemRest);

      // Read continuation lines at deeper indent
      var contIndent = indent + 2;
      var j = i + 1;
      while (j < lines.length) {
        var cRaw = lines[j];
        var cStripped = cRaw.replace(/#(?=(?:[^"]*"[^"]*")*[^"]*$).*$/, "");
        var cTrimmed = cStripped.trimEnd();
        if (cTrimmed.length === 0) {
          j++;
          continue;
        }
        var cIndent = cRaw.search(/\S/);
        if (cIndent < contIndent) {break;}
        var cLine = cTrimmed.trimStart();
        var cColon = cLine.indexOf(":");
        if (cColon !== -1) {
          var cKey = cLine.substring(0, cColon).trim();
          var cVal = cLine.substring(cColon + 1).trim();
          obj[cKey] = _parseScalar(cVal);
        }
        j++;
      }
      arr.push(obj);
      i = j;
    } else {
      arr.push(_parseScalar(itemVal));
      i++;
    }
  }

  return { value: arr, next: i };
}

function _parseScalar(val) {
  if (val === "" || val === "null" || val === "~") {return null;}
  if (val === "true") {return true;}
  if (val === "false") {return false;}

  // Inline array: [a, b, c]
  if (val.startsWith("[") && val.endsWith("]")) {
    var inner = val.substring(1, val.length - 1);
    return inner.split(",").map(function (s) {
      return _parseScalar(s.trim());
    });
  }

  // Quoted string
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.substring(1, val.length - 1);
  }

  // Number
  var num = Number(val);
  if (!isNaN(num) && val.length > 0) {return num;}

  return val;
}

function _nextNonEmptyLine(lines, start) {
  for (var i = start; i < lines.length; i++) {
    var t = lines[i].replace(/#(?=(?:[^"]*"[^"]*")*[^"]*$).*$/, "").trim();
    if (t.length > 0) {return i;}
  }
  return lines.length;
}

// ---------------------------------------------------------------------------
// Policy loading
// ---------------------------------------------------------------------------

function _loadPolicy() {
  if (!_policyPath || !fs.existsSync(_policyPath)) {
    _policy = null;
    return;
  }

  try {
    var stat = fs.statSync(_policyPath);
    var mtime = stat.mtimeMs;

    // Cache — only re-parse if file changed
    if (_policy && mtime === _policyMtime) {return;}

    var raw = fs.readFileSync(_policyPath, "utf8");
    _policy = _parseYaml(raw);
    _policyMtime = mtime;

    if (_log.info)
      {_log.info("[policy-enforcer] Policy loaded", {
        version: _policy.version,
        path: _policyPath,
      });}
  } catch (err) {
    if (_log.error) {_log.error("[policy-enforcer] Failed to load policy", { error: err.message });}
    _policy = null;
  }
}

function _ensurePolicy() {
  _loadPolicy();
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function _normalizePath(p) {
  return path.resolve(p).replace(/\\/g, "/");
}

function _matchesPathPattern(filePath, pattern) {
  var norm = _normalizePath(filePath);

  // Glob pattern (*.ext)
  if (pattern.startsWith("*")) {
    return norm.endsWith(pattern.substring(1));
  }

  // Absolute path pattern
  if (pattern.startsWith("/")) {
    return norm.startsWith(pattern);
  }

  // Relative to workspace
  if (_workspaceDir) {
    var resolved = _normalizePath(path.join(_workspaceDir, "..", pattern));
    return norm.startsWith(resolved);
  }

  return norm.indexOf(pattern) !== -1;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * init(workspaceDir, logger) — load klawty-policy.yaml from parent of workspace.
 */
function init(workspaceDir, logger) {
  _workspaceDir = workspaceDir;
  if (logger) {_log = logger;}

  // Policy lives next to klawty.json, one level up from workspace/
  _policyPath = path.join(workspaceDir, "..", "klawty-policy.yaml");
  _policyMtime = 0;
  _policy = null;

  _loadPolicy();
}

/**
 * checkFileWrite(filePath) — verify write is allowed by policy.
 */
function checkFileWrite(filePath) {
  _ensurePolicy();
  if (!_policy || !_policy.filesystem) {return { allowed: true, reason: "no policy loaded" };}

  var fs_policy = _policy.filesystem;

  // Check blocked paths first
  if (fs_policy.blocked && Array.isArray(fs_policy.blocked)) {
    for (var i = 0; i < fs_policy.blocked.length; i++) {
      var entry = fs_policy.blocked[i];
      var p = typeof entry === "string" ? entry : entry.path || "";
      if (_matchesPathPattern(filePath, p)) {
        return { allowed: false, reason: "blocked path: " + p };
      }
    }
  }

  // Check read-only paths
  if (fs_policy.read_only && Array.isArray(fs_policy.read_only)) {
    for (var j = 0; j < fs_policy.read_only.length; j++) {
      var roEntry = fs_policy.read_only[j];
      var roPath = typeof roEntry === "string" ? roEntry : roEntry.path || "";
      if (_matchesPathPattern(filePath, roPath)) {
        return { allowed: false, reason: "read-only path: " + roPath };
      }
    }
  }

  // Check allowed write paths
  if (fs_policy.write && Array.isArray(fs_policy.write)) {
    for (var k = 0; k < fs_policy.write.length; k++) {
      var wEntry = fs_policy.write[k];
      var wPath = typeof wEntry === "string" ? wEntry : wEntry.path || "";
      if (_matchesPathPattern(filePath, wPath)) {
        return { allowed: true, reason: "allowed write path: " + wPath };
      }
    }
  }

  // Deny by default for writes
  return { allowed: false, reason: "not in any allowed write path" };
}

/**
 * checkFileRead(filePath) — verify read is allowed (only blocked paths denied).
 */
function checkFileRead(filePath) {
  _ensurePolicy();
  if (!_policy || !_policy.filesystem) {return { allowed: true, reason: "no policy loaded" };}

  var fs_policy = _policy.filesystem;

  if (fs_policy.blocked && Array.isArray(fs_policy.blocked)) {
    for (var i = 0; i < fs_policy.blocked.length; i++) {
      var entry = fs_policy.blocked[i];
      var p = typeof entry === "string" ? entry : entry.path || "";
      if (_matchesPathPattern(filePath, p)) {
        return { allowed: false, reason: "blocked path: " + p };
      }
    }
  }

  return { allowed: true, reason: "read allowed" };
}

/**
 * checkNetwork(host, port) — verify network access is allowed.
 */
function checkNetwork(host, port) {
  _ensurePolicy();
  if (!_policy || !_policy.network) {return { allowed: true, reason: "no policy loaded" };}

  var net = _policy.network;
  var allow = net.allow;

  if (Array.isArray(allow)) {
    for (var i = 0; i < allow.length; i++) {
      var rule = allow[i];
      if (rule.host === host && (rule.port === port || rule.port === "*" || !rule.port)) {
        return { allowed: true, reason: "allowed: " + (rule.reason || rule.host) };
      }
    }
  }

  if (net.deny_all_others === true || net.deny_all_others === "true") {
    return {
      allowed: false,
      reason: "deny_all_others — host not in allow list: " + host + ":" + port,
    };
  }

  return { allowed: true, reason: "no deny_all_others rule" };
}

/**
 * checkExecution(command) — verify command execution is allowed.
 */
function checkExecution(command) {
  _ensurePolicy();
  if (!_policy || !_policy.execution) {return { allowed: true, reason: "no policy loaded" };}

  var exec = _policy.execution;

  // Check blocked patterns first
  if (exec.blocked_patterns && Array.isArray(exec.blocked_patterns)) {
    for (var i = 0; i < exec.blocked_patterns.length; i++) {
      var pattern = exec.blocked_patterns[i];
      // Skip non-string entries (YAML parse artifacts from special chars)
      if (typeof pattern !== "string") {continue;}
      // Use glob-style matching: * matches any characters
      var regex;
      try {
        var escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        escaped = escaped.replace(/\\\*/g, ".*");
        regex = new RegExp(escaped, "i");
      } catch (_e) {
        // Fallback to literal substring match
        if (command.toLowerCase().indexOf(pattern.toLowerCase()) !== -1) {
          return { allowed: false, reason: "blocked pattern: " + pattern };
        }
        continue;
      }
      if (regex.test(command)) {
        return { allowed: false, reason: "blocked pattern: " + pattern };
      }
    }
  }

  // Check allowed commands (first word)
  if (exec.allowed_commands && Array.isArray(exec.allowed_commands)) {
    var firstWord = command.trim().split(/\s+/)[0];
    // Strip path prefix to get base command
    var baseName = firstWord.split("/").pop();

    var found = false;
    for (var j = 0; j < exec.allowed_commands.length; j++) {
      if (baseName === exec.allowed_commands[j] || firstWord === exec.allowed_commands[j]) {
        found = true;
        break;
      }
    }

    if (!found) {
      return { allowed: false, reason: "command not in allowed list: " + baseName };
    }
  }

  return {
    allowed: true,
    reason: "allowed command",
    max_execution_time: exec.max_execution_time || 30,
  };
}

/**
 * checkResourceLimit(type, value) — check value against resource limits.
 * type: 'file_size', 'disk_usage', 'concurrent_tools', 'llm_calls', 'tool_rounds'
 */
function checkResourceLimit(type, value) {
  _ensurePolicy();
  if (!_policy || !_policy.resources) {return { allowed: true, reason: "no policy loaded" };}

  var res = _policy.resources;
  var limit;

  switch (type) {
    case "file_size":
      limit = _parseSizeBytes(res.max_file_size);
      break;
    case "disk_usage":
      limit = _parseSizeBytes(res.max_disk_usage);
      break;
    case "concurrent_tools":
      limit = res.max_concurrent_tools;
      break;
    case "llm_calls":
      limit = res.max_llm_calls_per_cycle;
      break;
    case "tool_rounds":
      limit = res.max_tool_rounds;
      break;
    default:
      return { allowed: true, reason: "unknown resource type: " + type };
  }

  if (limit == null) {return { allowed: true, reason: "no limit configured for: " + type };}

  if (value > limit) {
    return { allowed: false, reason: type + " exceeds limit: " + value + " > " + limit };
  }

  return { allowed: true, reason: type + " within limit: " + value + " <= " + limit };
}

/**
 * getPolicy() — returns current parsed policy object (or null).
 */
function getPolicy() {
  _ensurePolicy();
  return _policy;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _parseSizeBytes(val) {
  if (typeof val === "number") {return val;}
  if (typeof val !== "string") {return null;}

  var match = val.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)$/i);
  if (!match) {return null;}

  var num = parseFloat(match[1]);
  var unit = match[2].toUpperCase();
  var multipliers = { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776 };
  return Math.floor(num * (multipliers[unit] || 1));
}

module.exports = {
  init,
  checkFileWrite,
  checkFileRead,
  checkNetwork,
  checkExecution,
  checkResourceLimit,
  getPolicy,
};
