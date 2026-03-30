"use strict";

/**
 * Klawty Runtime — Privacy Router
 *
 * Scans task content for PII patterns. When detected, routes inference
 * to a local model (Ollama) instead of cloud, or redacts sensitive data.
 */

const os = require("os");

let _config = null;
let _log = console;
let _enabled = false;

// Built-in PII patterns — extended by config
const DEFAULT_PATTERNS = [
  { type: "email", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { type: "phone", regex: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g },
  { type: "credit_card", regex: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g },
  { type: "ssn", regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: "iban", regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g },
];

let _patterns = [];
let _keywords = [];
let _action = "local_inference"; // "local_inference" | "redact" | "block"
let _localModel = null;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

/**
 * init(privacyConfig, logger) — load privacy section from policy.
 * privacyConfig should be the `privacy` object from klawty-policy.yaml.
 */
function init(privacyConfig, logger) {
  if (logger) {_log = logger;}

  _config = privacyConfig || {};
  _enabled = _config.enabled === true;

  if (!_enabled) {
    if (_log.info) {_log.info("[privacy-router] Disabled — all inference routes to cloud");}
    return;
  }

  // Local model
  _localModel = _config.local_model || null;
  if (!_localModel) {
    if (_log.warn)
      {_log.warn(
        "[privacy-router] Enabled but no local_model configured — PII detection active, local routing unavailable",
      );}
  }

  // Action mode
  _action = _config.action || "local_inference";

  // Build pattern list: start with defaults, overlay config patterns
  _patterns = DEFAULT_PATTERNS.slice();

  if (Array.isArray(_config.pii_patterns)) {
    for (var i = 0; i < _config.pii_patterns.length; i++) {
      var p = _config.pii_patterns[i];
      if (p.pattern && p.name) {
        try {
          // Don't duplicate a built-in type — replace it
          var existingIdx = -1;
          for (var j = 0; j < _patterns.length; j++) {
            if (_patterns[j].type === p.name) {
              existingIdx = j;
              break;
            }
          }
          var compiled = { type: p.name, regex: new RegExp(p.pattern, "g") };
          if (existingIdx !== -1) {
            _patterns[existingIdx] = compiled;
          } else {
            _patterns.push(compiled);
          }
        } catch (err) {
          if (_log.warn)
            {_log.warn("[privacy-router] Invalid PII pattern", { name: p.name, error: err.message });}
        }
      }
    }
  }

  // Keywords
  _keywords = Array.isArray(_config.pii_keywords) ? _config.pii_keywords : [];

  if (_log.info)
    {_log.info("[privacy-router] Initialized", {
      enabled: _enabled,
      action: _action,
      localModel: _localModel || "(none)",
      patterns: _patterns.length,
      keywords: _keywords.length,
      hostname: os.hostname(),
    });}
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

/**
 * scanForPII(text) — scan text for PII patterns and keywords.
 * Returns { hasPII: boolean, matches: [{ type, match }] }.
 */
function scanForPII(text) {
  if (!text || typeof text !== "string") {
    return { hasPII: false, matches: [] };
  }

  var matches = [];

  // Regex patterns
  for (var i = 0; i < _patterns.length; i++) {
    var p = _patterns[i];
    // Reset lastIndex for global regex
    p.regex.lastIndex = 0;
    var m;
    while ((m = p.regex.exec(text)) !== null) {
      matches.push({ type: p.type, match: m[0] });
    }
  }

  // Keyword scan (case-insensitive)
  var lower = text.toLowerCase();
  for (var k = 0; k < _keywords.length; k++) {
    if (lower.indexOf(_keywords[k].toLowerCase()) !== -1) {
      matches.push({ type: "keyword", match: _keywords[k] });
    }
  }

  return { hasPII: matches.length > 0, matches: matches };
}

/**
 * shouldRouteLocal(taskTitle, taskDescription) — determine if this task
 * should use a local model due to PII.
 * Returns { local: boolean, reason: string, matches: Array }.
 */
function shouldRouteLocal(taskTitle, taskDescription) {
  if (!_enabled) {
    return { local: false, reason: "privacy routing disabled", matches: [] };
  }

  var combined = (taskTitle || "") + "\n" + (taskDescription || "");
  var result = scanForPII(combined);

  if (!result.hasPII) {
    return { local: false, reason: "no PII detected", matches: [] };
  }

  // Log detection if configured
  if (_config.log_detections) {
    if (_log.info)
      {_log.info("[privacy-router] PII detected in task", {
        types: result.matches.map(function (m) {
          return m.type;
        }),
        count: result.matches.length,
        action: _action,
      });}
  }

  if (_action === "block") {
    return {
      local: false,
      reason: "PII detected — task blocked by policy",
      matches: result.matches,
      blocked: true,
    };
  }

  if (_action === "local_inference" && _localModel) {
    return {
      local: true,
      reason: "PII detected — routing to local model",
      matches: result.matches,
    };
  }

  if (_action === "redact") {
    return {
      local: false,
      reason: "PII detected — will be redacted before cloud inference",
      matches: result.matches,
      redact: true,
    };
  }

  // Fallback: local inference requested but no local model available
  return {
    local: false,
    reason: "PII detected but no local model configured",
    matches: result.matches,
  };
}

/**
 * redactPII(text) — replace all detected PII with [REDACTED:type] placeholders.
 */
function redactPII(text) {
  if (!text || typeof text !== "string") {return text;}

  var result = text;

  // Apply regex-based redaction
  for (var i = 0; i < _patterns.length; i++) {
    var p = _patterns[i];
    p.regex.lastIndex = 0;
    var placeholder = (_config && _config.redaction_placeholder) || "[REDACTED]";
    var tag = placeholder.replace("]", ":" + p.type + "]");
    result = result.replace(p.regex, tag);
  }

  return result;
}

/**
 * getLocalModel() — returns configured local model name or null.
 */
function getLocalModel() {
  if (!_enabled || !_localModel) {return null;}
  return _localModel;
}

/**
 * isEnabled() — whether privacy routing is active.
 */
function isEnabled() {
  return _enabled;
}

module.exports = { init, scanForPII, shouldRouteLocal, redactPII, getLocalModel, isEnabled };
