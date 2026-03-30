"use strict";

/**
 * Klawty Security Boot — initializes all security modules on gateway start.
 *
 * Called from the gateway entry point. Loads policy, integrity check,
 * credential monitor, and privacy router. Non-blocking — gateway starts
 * even if security modules have issues.
 */

const path = require("path");
const os = require("os");

let _log = console;
let _initialized = false;

function init(opts) {
  if (_initialized) {return;}
  opts = opts || {};

  if (opts.logger) {_log = opts.logger;}

  const homeDir = opts.homeDir || path.join(os.homedir(), ".klawty");
  const runtimeDir = opts.runtimeDir || path.join(__dirname);
  const workspaceDir = opts.workspaceDir || path.join(homeDir, "workspace");
  const policyPath = opts.policyPath || path.join(process.cwd(), "klawty-policy.yaml");

  if (_log.info) {_log.info("[klawty-security] Initializing security modules");}

  // 1. Runtime integrity check
  try {
    const integrity = require("./integrity-check");
    integrity.init(runtimeDir, _log);
    if (integrity.isIntegrityOk()) {
      if (_log.info) {_log.info("[klawty-security] Runtime integrity: OK");}
    } else {
      if (_log.warn) {_log.warn("[klawty-security] Runtime integrity: TAMPERED — degraded mode");}
    }
  } catch (err) {
    if (_log.warn)
      {_log.warn("[klawty-security] Integrity check unavailable", { error: err.message });}
  }

  // 2. Policy enforcer
  try {
    const policy = require("./policy-enforcer");
    policy.init(workspaceDir, _log);
    var p = policy.getPolicy();
    if (p) {
      if (_log.info) {_log.info("[klawty-security] Policy engine: loaded", { file: policyPath });}
    } else {
      if (_log.info) {_log.info("[klawty-security] Policy engine: no policy file (permissive mode)");}
    }
  } catch (err) {
    if (_log.warn)
      {_log.warn("[klawty-security] Policy enforcer unavailable", { error: err.message });}
  }

  // 3. Privacy router
  try {
    var privacyConfig = null;
    try {
      var policyMod = require("./policy-enforcer");
      var pol = policyMod.getPolicy();
      if (pol && pol.privacy) {privacyConfig = pol.privacy;}
    } catch (_e) {
      /* policy not loaded */
    }

    var privacy = require("./privacy-router");
    privacy.init(privacyConfig, _log);
    if (privacy.isEnabled()) {
      if (_log.info) {_log.info("[klawty-security] Privacy router: enabled");}
    } else {
      if (_log.info)
        {_log.info("[klawty-security] Privacy router: disabled (enable in klawty-policy.yaml)");}
    }
  } catch (err) {
    if (_log.warn)
      {_log.warn("[klawty-security] Privacy router unavailable", { error: err.message });}
  }

  // 4. Credential monitor (async, non-blocking)
  try {
    var creds = require("./credential-monitor");
    creds.init(workspaceDir, {}, _log);
    creds.startMonitoring(6 * 60 * 60 * 1000); // 6 hours
    if (_log.info) {_log.info("[klawty-security] Credential monitor: started (6h cycle)");}
  } catch (err) {
    if (_log.warn)
      {_log.warn("[klawty-security] Credential monitor unavailable", { error: err.message });}
  }

  _initialized = true;
  if (_log.info) {_log.info("[klawty-security] All security modules initialized");}
}

function isInitialized() {
  return _initialized;
}

module.exports = { init, isInitialized };
