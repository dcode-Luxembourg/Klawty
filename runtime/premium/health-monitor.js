/** OpenClaw Runtime — Health Monitor (Premium) */

"use strict";

const https = require("https");
const http = require("http");
const { execFileSync } = require("child_process");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const LOCAL_CHECK_INTERVAL_MS = 60 * 1000; // 60 seconds
const REMOTE_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const CONSECUTIVE_THRESHOLD = 3; // Alert after N consecutive failures
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 1 alert per service per 5 minutes

const DISK_THRESHOLD_PERCENT = 85;
const MEMORY_THRESHOLD_PERCENT = 90;

// ---------------------------------------------------------------------------
// State tracking per service
// ---------------------------------------------------------------------------
// { ok: boolean, failures: number, downSince: timestamp|null, lastCheck: timestamp|null, lastAlert: timestamp|null }
const state = new Map();

function getState(service) {
  if (!state.has(service)) {
    state.set(service, {
      ok: true,
      failures: 0,
      downSince: null,
      lastCheck: null,
      lastAlert: null,
    });
  }
  return state.get(service);
}

// ---------------------------------------------------------------------------
// Logger — lightweight, replaceable via config
// ---------------------------------------------------------------------------

let _logger = {
  info: (msg, ctx) => console.log(`[health-monitor] ${msg}`, ctx || ""),
  warn: (msg, ctx) => console.warn(`[health-monitor] ${msg}`, ctx || ""),
  error: (msg, ctx) => console.error(`[health-monitor] ${msg}`, ctx || ""),
  debug: (msg, ctx) => {},
};

// ---------------------------------------------------------------------------
// Alert adapter — configurable notification channel
// ---------------------------------------------------------------------------

let _alertAdapter = {
  /**
   * Send a critical alert.
   * @param {string} message
   * @param {string} service
   */
  sendCritical: async (message, service) => {
    _logger.warn(`[CRITICAL] ${message}`, { service });
  },
  /**
   * Send a recovery notification.
   * @param {string} message
   * @param {string} service
   */
  sendRecovery: async (message, service) => {
    _logger.info(`[RECOVERY] ${message}`, { service });
  },
};

/**
 * Record a check result for a service. Handles alert/recovery logic.
 * @param {string} service - Service name
 * @param {boolean} ok - Whether the check passed
 * @param {string} [detail] - Additional detail for the alert
 */
async function recordCheck(service, ok, detail) {
  const s = getState(service);
  s.lastCheck = Date.now();

  if (ok) {
    if (!s.ok && s.downSince) {
      // Service recovered — send recovery notification
      const downtimeMs = Date.now() - s.downSince;
      const downtimeStr = formatDuration(downtimeMs);
      const msg = `${service} recovered after ${downtimeStr} downtime`;
      _logger.info(msg, { service, downtimeMs });
      await safeAlertSend("recovery", service, msg);
    }
    s.ok = true;
    s.failures = 0;
    s.downSince = null;
  } else {
    s.failures++;
    if (s.ok) {
      // First failure — mark downSince
      s.downSince = Date.now();
    }
    s.ok = false;

    const msg = `${service} — ${detail || "check failed"} (${s.failures} consecutive failure${s.failures > 1 ? "s" : ""})`;
    _logger.warn(msg, { service, failures: s.failures });

    if (s.failures >= CONSECUTIVE_THRESHOLD) {
      await safeAlertSend("critical", service, msg);
    }
  }
}

/**
 * Send an alert with per-service rate limiting.
 * @param {'critical'|'recovery'} type
 * @param {string} service
 * @param {string} message
 */
async function safeAlertSend(type, service, message) {
  const s = getState(service);
  const now = Date.now();

  if (s.lastAlert && now - s.lastAlert < ALERT_COOLDOWN_MS) {
    _logger.debug("Alert rate-limited", { service, type });
    return;
  }

  s.lastAlert = now;

  try {
    if (type === "critical") {
      await _alertAdapter.sendCritical(message, service);
    } else {
      await _alertAdapter.sendRecovery(message, service);
    }
  } catch (err) {
    _logger.error("Failed to send alert", { service, type, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

// ---------------------------------------------------------------------------
// Local checks
// ---------------------------------------------------------------------------

/**
 * Check an HTTP(S) endpoint for readiness.
 * Used for local services like Qdrant or any custom health endpoints.
 * @param {string} name - Service name
 * @param {string} url - Full URL to check (e.g. http://localhost:6333/readyz)
 * @param {number} [timeoutMs=5000]
 */
async function checkEndpoint(name, url, timeoutMs = 5000) {
  try {
    const ok = await httpGet(url, timeoutMs);
    await recordCheck(name, ok, `${name} not ready`);
  } catch (err) {
    await recordCheck(name, false, `${name} unreachable: ${err.message}`);
  }
}

/**
 * Check disk usage via df. Alert if usage > DISK_THRESHOLD_PERCENT.
 */
async function checkDisk() {
  const service = "disk";
  try {
    const output = execFileSync("df", ["-h", "/"], { encoding: "utf8", timeout: 5000 });
    const lines = output.trim().split("\n");
    if (lines.length < 2) {
      await recordCheck(service, false, "Could not parse df output");
      return;
    }

    // df -h output: Filesystem  Size  Used  Avail  Use%  Mounted
    // The Use% column contains something like "42%"
    const columns = lines[1].split(/\s+/);
    const usePercentStr = columns.find((col) => col.endsWith("%"));
    if (!usePercentStr) {
      await recordCheck(service, false, "Could not find usage percentage in df output");
      return;
    }

    const usePercent = parseInt(usePercentStr, 10);
    if (isNaN(usePercent)) {
      await recordCheck(service, false, `Invalid disk usage value: ${usePercentStr}`);
      return;
    }

    const ok = usePercent < DISK_THRESHOLD_PERCENT;
    if (!ok) {
      await recordCheck(
        service,
        false,
        `Disk usage at ${usePercent}% (threshold: ${DISK_THRESHOLD_PERCENT}%)`,
      );
    } else {
      await recordCheck(service, true);
    }

    _logger.debug("Disk check", { usePercent });
  } catch (err) {
    await recordCheck(service, false, `Disk check error: ${err.message}`);
  }
}

/**
 * Check memory usage via free -m. Alert if usage > MEMORY_THRESHOLD_PERCENT.
 * Note: `free` is a Linux command — on macOS this will gracefully fail.
 */
async function checkMemory() {
  const service = "memory";
  try {
    const output = execFileSync("free", ["-m"], { encoding: "utf8", timeout: 5000 });
    const lines = output.trim().split("\n");

    // Find the "Mem:" line
    const memLine = lines.find((line) => line.startsWith("Mem:"));
    if (!memLine) {
      await recordCheck(service, false, "Could not find Mem: line in free output");
      return;
    }

    // Mem:  total  used  free  shared  buff/cache  available
    const parts = memLine.split(/\s+/);
    const total = parseInt(parts[1], 10);
    const available = parseInt(parts[6], 10); // "available" column (most accurate)

    if (isNaN(total) || isNaN(available) || total === 0) {
      await recordCheck(service, false, "Could not parse memory values");
      return;
    }

    const usedPercent = Math.round(((total - available) / total) * 100);
    const ok = usedPercent < MEMORY_THRESHOLD_PERCENT;

    if (!ok) {
      await recordCheck(
        service,
        false,
        `Memory usage at ${usedPercent}% (threshold: ${MEMORY_THRESHOLD_PERCENT}%) — ${available}MB available of ${total}MB`,
      );
    } else {
      await recordCheck(service, true);
    }

    _logger.debug("Memory check", { usedPercent, total, available });
  } catch (err) {
    // On macOS, `free` doesn't exist — log and skip (non-critical)
    if (err.code === "ENOENT") {
      _logger.debug("free command not found (likely macOS) — skipping memory check");
      // Don't record as failure — this is expected on macOS dev machines
      return;
    }
    await recordCheck(service, false, `Memory check error: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Remote site checks
// ---------------------------------------------------------------------------

/**
 * Check a remote site by issuing an HTTPS GET and verifying a 2xx/3xx response.
 * @param {Object} site - { name, url, critical }
 */
async function checkSite(site) {
  try {
    const ok = await httpGet(site.url, 10000);
    await recordCheck(site.name, ok, `${site.name} returned non-OK status`);
  } catch (err) {
    await recordCheck(site.name, false, `${site.name} unreachable: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// HTTP GET helper — supports both http and https
// ---------------------------------------------------------------------------

/**
 * Perform an HTTP(S) GET request. Returns true if status is 2xx or 3xx.
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
function httpGet(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;

    const req = mod.get(url, { timeout: timeoutMs }, (res) => {
      // Consume the body to free up the socket
      res.on("data", () => {});
      res.on("end", () => {
        const ok = res.statusCode >= 200 && res.statusCode < 400;
        resolve(ok);
      });
    });

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    });
  });
}

// ---------------------------------------------------------------------------
// Main loops
// ---------------------------------------------------------------------------

/** @type {Array<{name: string, url: string, critical?: boolean}>} */
let _localEndpoints = [];
/** @type {Array<{name: string, url: string, critical?: boolean}>} */
let _remoteSites = [];

async function runLocalChecks() {
  _logger.debug("Running local health checks");
  for (const ep of _localEndpoints) {
    await checkEndpoint(ep.name, ep.url);
  }
  await checkDisk();
  await checkMemory();
}

async function runRemoteChecks() {
  _logger.debug("Running remote site checks");
  for (const site of _remoteSites) {
    await checkSite(site);
  }
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

/**
 * Start the health monitor with the given configuration.
 *
 * @param {Object} config
 * @param {Array<{name: string, url: string, critical?: boolean}>} [config.localEndpoints]
 *   Local services to health-check every 60s. Example:
 *   [{ name: 'qdrant', url: 'http://localhost:6333/readyz' }]
 * @param {Array<{name: string, url: string, critical?: boolean}>} [config.remoteSites]
 *   Remote sites to check every 5 minutes. Example:
 *   [{ name: 'my-app.com', url: 'https://my-app.com', critical: true }]
 * @param {Object} [config.alertAdapter]
 *   Alert notification adapter. Must implement sendCritical(msg, service) and sendRecovery(msg, service).
 *   Defaults to console logging.
 * @param {Object} [config.logger]
 *   Logger instance with info/warn/error/debug methods. Defaults to console.
 */
function start(config = {}) {
  _localEndpoints = config.localEndpoints || [];
  _remoteSites = config.remoteSites || [];

  if (config.alertAdapter) {
    _alertAdapter = config.alertAdapter;
  }
  if (config.logger) {
    _logger = config.logger;
  }

  _logger.info("Health monitor starting", {
    localIntervalMs: LOCAL_CHECK_INTERVAL_MS,
    remoteIntervalMs: REMOTE_CHECK_INTERVAL_MS,
    consecutiveThreshold: CONSECUTIVE_THRESHOLD,
    localEndpoints: _localEndpoints.map((e) => e.name),
    remoteSites: _remoteSites.map((s) => s.name),
  });

  // Run checks immediately on start
  runLocalChecks().catch((err) => {
    _logger.error("Local check loop error", { error: err.message });
  });

  if (_remoteSites.length > 0) {
    runRemoteChecks().catch((err) => {
      _logger.error("Remote check loop error", { error: err.message });
    });
  }

  // Schedule recurring checks
  const localTimer = setInterval(() => {
    runLocalChecks().catch((err) => {
      _logger.error("Local check loop error", { error: err.message });
    });
  }, LOCAL_CHECK_INTERVAL_MS);

  let remoteTimer = null;
  if (_remoteSites.length > 0) {
    remoteTimer = setInterval(() => {
      runRemoteChecks().catch((err) => {
        _logger.error("Remote check loop error", { error: err.message });
      });
    }, REMOTE_CHECK_INTERVAL_MS);
  }

  return { localTimer, remoteTimer };
}

/**
 * Get all current service states for dashboard/API consumption.
 * @returns {Object} Map of service name to state object
 */
function getAllStates() {
  const result = {};
  for (const [name, s] of state) {
    result[name] = { ...s };
  }
  return result;
}

module.exports = { start, getState, getAllStates, runLocalChecks, runRemoteChecks, httpGet };
