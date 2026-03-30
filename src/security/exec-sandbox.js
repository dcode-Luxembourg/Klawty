"use strict";

/**
 * Klawty Runtime — Exec Sandbox
 *
 * Wraps the `exec` tool in a restricted Docker container.
 * When Docker is available, shell commands run inside an isolated
 * container with no network, limited filesystem, and a timeout.
 * When Docker is unavailable, falls back to native execution with
 * policy-enforcer checks.
 *
 * Security model:
 *   - No network access (--network none)
 *   - Workspace mounted read-write, everything else read-only
 *   - 30-second timeout (configurable)
 *   - 512MB memory limit
 *   - No privilege escalation (--security-opt no-new-privileges)
 *   - Output truncated to 1MB
 *   - Uses execFileSync (not exec) to prevent shell injection
 */

const { execFileSync } = require("child_process");
const path = require("path");
const os = require("os");

const SANDBOX_IMAGE = "node:20-alpine";
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_OUTPUT_BYTES = 1024 * 1024; // 1MB
const MEM_LIMIT = "512m";

let _log = console;
let _workspaceDir = null;
let _dockerOk = false;
let _policyEnforcer = null;
let _config = {};

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function init(workspaceDir, config, logger, policyEnforcer) {
  _workspaceDir = workspaceDir;
  if (logger) {_log = logger;}
  if (config && config.execution) {_config = config.execution;}
  if (policyEnforcer) {_policyEnforcer = policyEnforcer;}

  // Check Docker availability (non-blocking)
  try {
    execFileSync("docker", ["info"], { stdio: "ignore", timeout: 5000 });
    _dockerOk = true;
    if (_log.info) {_log.info("[exec-sandbox] Docker available — commands will run in sandbox");}
  } catch (_e) {
    _dockerOk = false;
    if (_log.info)
      {_log.info("[exec-sandbox] Docker not available — using native execution with policy checks");}
  }
}

// ---------------------------------------------------------------------------
// Execute command
// ---------------------------------------------------------------------------

/**
 * execute(command, options) — run a shell command, sandboxed if Docker available.
 *
 * @param {string} command — the shell command to run
 * @param {object} options — { timeout }
 * @returns {{ success, output, sandboxed, duration }}
 */
function execute(command, options) {
  options = options || {};
  var timeout = options.timeout || (_config.max_execution_time || 30) * 1000 || DEFAULT_TIMEOUT;
  var startTime = Date.now();

  // Policy check first (regardless of sandbox mode)
  if (_policyEnforcer) {
    var check = _policyEnforcer.checkExecution(command);
    if (!check.allowed) {
      return {
        success: false,
        output: "Policy blocked: " + (check.reason || "command not allowed"),
        sandboxed: false,
        duration: 0,
      };
    }
  }

  if (_dockerOk) {
    return _executeInDocker(command, timeout, startTime);
  }

  return _executeNative(command, timeout, startTime);
}

// ---------------------------------------------------------------------------
// Docker sandbox execution — uses execFileSync('docker', [...]) for safety
// ---------------------------------------------------------------------------

function _executeInDocker(command, timeout, startTime) {
  var wsAbs = path.resolve(_workspaceDir);

  // All args passed as array to execFileSync — no shell injection possible
  var dockerArgs = [
    "run",
    "--rm",
    "--network",
    "none",
    "--memory",
    MEM_LIMIT,
    "--security-opt",
    "no-new-privileges",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=64m",
    "-v",
    wsAbs + ":/workspace:rw",
    "-w",
    "/workspace",
    "-e",
    "HOME=/tmp",
    "-e",
    "NODE_ENV=production",
    SANDBOX_IMAGE,
    "sh",
    "-c",
    command, // command runs inside container's sh — isolated from host
  ];

  try {
    var output = execFileSync("docker", dockerArgs, {
      timeout: timeout,
      maxBuffer: MAX_OUTPUT_BYTES,
      encoding: "utf-8",
    });

    return {
      success: true,
      output: _truncate(output),
      sandboxed: true,
      duration: Date.now() - startTime,
    };
  } catch (err) {
    var errOutput = "";
    if (err.stderr) {errOutput += err.stderr.toString().slice(0, 2000);}
    if (err.stdout) {errOutput = err.stdout.toString().slice(0, 2000) + "\n" + errOutput;}
    errOutput = errOutput.trim();

    if (err.killed || err.signal === "SIGTERM") {
      return {
        success: false,
        output: "Command timed out after " + timeout / 1000 + "s (sandboxed)",
        sandboxed: true,
        duration: Date.now() - startTime,
      };
    }

    return {
      success: false,
      output: _truncate(errOutput || err.message),
      sandboxed: true,
      duration: Date.now() - startTime,
    };
  }
}

// ---------------------------------------------------------------------------
// Native execution (fallback — uses execFileSync with sh -c for safety)
// ---------------------------------------------------------------------------

function _executeNative(command, timeout, startTime) {
  // Use execFileSync with explicit shell — avoids direct shell injection on host
  var shell = process.platform === "win32" ? "cmd" : "sh";
  var shellArgs = process.platform === "win32" ? ["/c", command] : ["-c", command];

  try {
    var output = execFileSync(shell, shellArgs, {
      timeout: timeout,
      maxBuffer: MAX_OUTPUT_BYTES,
      encoding: "utf-8",
      cwd: _workspaceDir,
      env: Object.assign({}, process.env, {
        HOME: os.homedir(),
        NODE_ENV: "production",
      }),
    });

    return {
      success: true,
      output: _truncate(output),
      sandboxed: false,
      duration: Date.now() - startTime,
    };
  } catch (err) {
    var errOutput = "";
    if (err.stderr) {errOutput += err.stderr.toString().slice(0, 2000);}
    if (err.stdout) {errOutput = err.stdout.toString().slice(0, 2000) + "\n" + errOutput;}
    errOutput = errOutput.trim();

    if (err.killed) {
      return {
        success: false,
        output: "Command timed out after " + timeout / 1000 + "s",
        sandboxed: false,
        duration: Date.now() - startTime,
      };
    }

    return {
      success: false,
      output: _truncate(errOutput || err.message),
      sandboxed: false,
      duration: Date.now() - startTime,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _truncate(str) {
  if (!str) {return "";}
  if (str.length > MAX_OUTPUT_BYTES) {
    return str.slice(0, MAX_OUTPUT_BYTES) + "\n... [output truncated at 1MB]";
  }
  return str;
}

function isDockerAvailable() {
  return _dockerOk;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  init,
  execute,
  isDockerAvailable,
};
