"use strict";

/**
 * Klawty Runtime — Credential Monitor
 *
 * Periodically validates that configured API credentials are working.
 * Checks OpenRouter, Discord, Telegram, Slack tokens and reports status.
 * Never logs actual credential values — only validity status.
 *
 * Usage:
 *   const credMon = require('./credential-monitor');
 *   credMon.init(workspaceDir, config, logger);
 *   credMon.startMonitoring();             // every 6 hours
 *   const status = await credMon.checkAll();
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const BALANCE_WARN_USD = 5.0;
const BALANCE_CRIT_USD = 1.0;
const REQUEST_TIMEOUT_MS = 10000;

let _workspaceDir = null;
let _config = null;
let _log = console;
let _timer = null;
let _credentials = {}; // name → { type, envKey, token }
let _status = {}; // name → { valid, lastChecked, error?, balance? }

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

/**
 * init(workspaceDir, config, logger) — reads .env and identifies credentials.
 */
function init(workspaceDir, config, logger) {
  _workspaceDir = workspaceDir;
  _config = config;
  if (logger) {_log = logger;}

  _credentials = {};
  _status = {};

  // Read .env to discover credentials
  var envVars = _loadEnvVars();

  // OpenRouter API key
  if (envVars.OPENROUTER_API_KEY) {
    _credentials.openrouter = {
      type: "openrouter",
      envKey: "OPENROUTER_API_KEY",
      token: envVars.OPENROUTER_API_KEY,
    };
  }

  // OpenAI API key (fallback for router)
  if (envVars.OPENAI_API_KEY) {
    _credentials.openai = {
      type: "openai",
      envKey: "OPENAI_API_KEY",
      token: envVars.OPENAI_API_KEY,
    };
  }

  // Discord bot tokens — look for all DISCORD_BOT_TOKEN* patterns
  var discordKeys = Object.keys(envVars).filter(function (k) {
    return k.startsWith("DISCORD_BOT_TOKEN");
  });
  for (var i = 0; i < discordKeys.length; i++) {
    var key = discordKeys[i];
    var name =
      "discord_" +
      key.replace("DISCORD_BOT_TOKEN_", "").replace("DISCORD_BOT_TOKEN", "default").toLowerCase();
    _credentials[name] = { type: "discord", envKey: key, token: envVars[key] };
  }

  // Telegram bot token
  if (envVars.TELEGRAM_BOT_TOKEN) {
    _credentials.telegram = {
      type: "telegram",
      envKey: "TELEGRAM_BOT_TOKEN",
      token: envVars.TELEGRAM_BOT_TOKEN,
    };
  }

  // Slack bot token
  if (envVars.SLACK_BOT_TOKEN) {
    _credentials.slack = {
      type: "slack",
      envKey: "SLACK_BOT_TOKEN",
      token: envVars.SLACK_BOT_TOKEN,
    };
  }

  if (_log.info)
    {_log.info("[credential-monitor] Initialized", {
      credentials: Object.keys(_credentials).length,
      types: _uniqueTypes(),
    });}
}

// ---------------------------------------------------------------------------
// Check all credentials
// ---------------------------------------------------------------------------

/**
 * checkAll() — validates every configured credential.
 * Returns a map of credential name → { valid, lastChecked, error?, balance? }.
 */
async function checkAll() {
  var names = Object.keys(_credentials);
  var results = {};

  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    var cred = _credentials[name];

    try {
      var result = await _checkCredential(cred);
      results[name] = result;
      _status[name] = result;
    } catch (err) {
      var errorResult = {
        valid: false,
        lastChecked: new Date().toISOString(),
        error: err.message,
      };
      results[name] = errorResult;
      _status[name] = errorResult;
    }
  }

  // Log warnings for invalid or low-balance credentials
  _logAlerts(results);

  return results;
}

// ---------------------------------------------------------------------------
// Individual credential checks
// ---------------------------------------------------------------------------

async function _checkCredential(cred) {
  switch (cred.type) {
    case "openrouter":
      return _checkOpenRouter(cred.token);
    case "openai":
      return _checkOpenAI(cred.token);
    case "discord":
      return _checkDiscord(cred.token);
    case "telegram":
      return _checkTelegram(cred.token);
    case "slack":
      return _checkSlack(cred.token);
    default:
      return {
        valid: true,
        lastChecked: new Date().toISOString(),
        note: "Unknown type — skipped validation",
      };
  }
}

async function _checkOpenRouter(token) {
  var result = { valid: false, lastChecked: new Date().toISOString() };

  // Check if token works by listing models
  try {
    await _httpsGet("https://openrouter.ai/api/v1/models", {
      Authorization: "Bearer " + token,
    });
    result.valid = true;
  } catch (err) {
    result.error = "Models endpoint: " + err.message;
    return result;
  }

  // Check balance/credits
  try {
    var data = await _httpsGetJson("https://openrouter.ai/api/v1/credits", {
      Authorization: "Bearer " + token,
    });
    if (data && data.data) {
      var remaining =
        typeof data.data.total_remaining === "number" ? data.data.total_remaining : null;
      if (remaining !== null) {
        result.balance = remaining;
      }
    }
  } catch (_e) {
    // Balance check failed — non-fatal, token still valid
    result.balanceError = "Could not retrieve balance";
  }

  return result;
}

async function _checkOpenAI(token) {
  var result = { valid: false, lastChecked: new Date().toISOString() };

  try {
    await _httpsGet("https://api.openai.com/v1/models", {
      Authorization: "Bearer " + token,
    });
    result.valid = true;
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

async function _checkDiscord(token) {
  var result = { valid: false, lastChecked: new Date().toISOString() };

  try {
    var data = await _httpsGetJson("https://discord.com/api/v10/users/@me", {
      Authorization: "Bot " + token,
    });
    result.valid = !!(data && data.id);
    result.username = data ? data.username : undefined;
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

async function _checkTelegram(token) {
  var result = { valid: false, lastChecked: new Date().toISOString() };

  try {
    var data = await _httpsGetJson("https://api.telegram.org/bot" + token + "/getMe", {});
    result.valid = !!(data && data.ok);
    result.username = data && data.result ? data.result.username : undefined;
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

async function _checkSlack(token) {
  var result = { valid: false, lastChecked: new Date().toISOString() };

  try {
    var data = await _httpsPostJson(
      "https://slack.com/api/auth.test",
      {},
      {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
    );
    result.valid = !!(data && data.ok);
    result.team = data ? data.team : undefined;
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Monitoring loop
// ---------------------------------------------------------------------------

/**
 * startMonitoring(intervalMs?) — runs checkAll on a schedule.
 * Default interval: 6 hours.
 */
function startMonitoring(intervalMs) {
  if (_timer) {return;}

  var interval = intervalMs || DEFAULT_INTERVAL_MS;

  _timer = setInterval(function () {
    checkAll().catch(function (err) {
      if (_log.warn)
        {_log.warn("[credential-monitor] Scheduled check failed", { error: err.message });}
    });
  }, interval);

  if (_timer.unref) {_timer.unref();} // Don't block process exit

  if (_log.info)
    {_log.info("[credential-monitor] Monitoring started", {
      intervalHours: Math.round(interval / (60 * 60 * 1000)),
      credentials: Object.keys(_credentials).length,
    });}

  // Run first check after a short delay (don't block boot)
  setTimeout(function () {
    checkAll().catch(function (_e) {
      /* non-fatal on boot */
    });
  }, 5000);
}

/**
 * stopMonitoring() — stops the scheduled checks.
 */
function stopMonitoring() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * getStatus() — returns the last-known status of all credentials.
 */
function getStatus() {
  return Object.assign({}, _status);
}

// ---------------------------------------------------------------------------
// Alert logging
// ---------------------------------------------------------------------------

function _logAlerts(results) {
  var names = Object.keys(results);
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    var r = results[name];

    if (!r.valid) {
      if (_log.warn)
        {_log.warn("[credential-monitor] INVALID credential", {
          name: name,
          type: _credentials[name] ? _credentials[name].type : "unknown",
          error: r.error || "validation failed",
        });}
    }

    if (r.balance !== undefined && r.balance !== null) {
      if (r.balance < BALANCE_CRIT_USD) {
        if (_log.error)
          {_log.error("[credential-monitor] CRITICAL — OpenRouter balance very low", {
            name: name,
            balance: "$" + r.balance.toFixed(2),
          });}
      } else if (r.balance < BALANCE_WARN_USD) {
        if (_log.warn)
          {_log.warn("[credential-monitor] WARNING — OpenRouter balance low", {
            name: name,
            balance: "$" + r.balance.toFixed(2),
          });}
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _loadEnvVars() {
  var vars = {};

  // Read from process.env first
  Object.assign(vars, process.env);

  // Also read .env file directly for tokens not yet in process.env
  var envPaths = [path.join(_workspaceDir, "..", ".env"), path.join(_workspaceDir, ".env")];

  for (var i = 0; i < envPaths.length; i++) {
    if (fs.existsSync(envPaths[i])) {
      try {
        var content = fs.readFileSync(envPaths[i], "utf8");
        var lines = content.split("\n");
        for (var j = 0; j < lines.length; j++) {
          var line = lines[j].trim();
          if (!line || line.startsWith("#")) {continue;}
          var eq = line.indexOf("=");
          if (eq === -1) {continue;}
          var key = line.slice(0, eq).trim();
          var val = line.slice(eq + 1).trim();
          // Strip quotes
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          if (!vars[key]) {vars[key] = val;}
        }
      } catch (_e) {
        /* non-fatal */
      }
    }
  }

  return vars;
}

function _uniqueTypes() {
  var types = {};
  var names = Object.keys(_credentials);
  for (var i = 0; i < names.length; i++) {
    types[_credentials[names[i]].type] = true;
  }
  return Object.keys(types);
}

function _httpsGet(url, headers) {
  return new Promise(function (resolve, reject) {
    var urlObj = new URL(url);
    var options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "GET",
      headers: headers || {},
      timeout: REQUEST_TIMEOUT_MS,
    };

    var req = https.request(options, function (res) {
      var body = "";
      res.on("data", function (chunk) {
        body += chunk;
      });
      res.on("end", function () {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error("HTTP " + res.statusCode));
        }
      });
    });

    req.on("error", function (err) {
      reject(err);
    });
    req.on("timeout", function () {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    req.end();
  });
}

function _httpsGetJson(url, headers) {
  return _httpsGet(url, headers).then(function (body) {
    return JSON.parse(body);
  });
}

function _httpsPostJson(url, data, headers) {
  return new Promise(function (resolve, reject) {
    var urlObj = new URL(url);
    var payload = JSON.stringify(data || {});
    var options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: Object.assign(
        {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        headers || {},
      ),
      timeout: REQUEST_TIMEOUT_MS,
    };

    var req = https.request(options, function (res) {
      var body = "";
      res.on("data", function (chunk) {
        body += chunk;
      });
      res.on("end", function () {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error("Invalid JSON: " + e.message));
        }
      });
    });

    req.on("error", function (err) {
      reject(err);
    });
    req.on("timeout", function () {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  init,
  checkAll,
  getStatus,
  startMonitoring,
  stopMonitoring,
};
