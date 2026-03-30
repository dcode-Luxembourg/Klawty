"use strict";

/**
 * Klawty Runtime — Integrity Check
 *
 * Verifies runtime module hashes on boot. Detects tampering with
 * engine.js, prompt-builder.js, tool-runner.js, router.js, and other
 * core modules. If tampered, system degrades to read-only mode.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MANIFEST_FILE = "runtime-manifest.json";

// Core files that MUST pass integrity check — tampering = read-only mode
const CRITICAL_FILES = [
  "engine.js",
  "prompt-builder.js",
  "tool-runner.js",
  "router.js",
  "task-db.js",
  "circuit-breaker.js",
];

let _log = console;
let _integrityOk = true;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _sha256(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

function _collectFiles(dir, prefix) {
  const results = [];
  if (!fs.existsSync(dir)) {return results;}

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".js")) {
      const rel = prefix ? prefix + "/" + entry.name : entry.name;
      results.push({ rel: rel, abs: path.join(dir, entry.name) });
    } else if (entry.isDirectory() && entry.name !== "node_modules") {
      const sub = prefix ? prefix + "/" + entry.name : entry.name;
      results.push.apply(results, _collectFiles(path.join(dir, entry.name), sub));
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * generateManifest(runtimeDir) — compute SHA-256 for all .js files in
 * runtime/ and runtime/tools/, write runtime-manifest.json.
 */
function generateManifest(runtimeDir) {
  const files = _collectFiles(runtimeDir, "");
  const hashes = {};

  for (const f of files) {
    // Skip the manifest itself if it exists as a .js file (it won't, but guard)
    if (f.rel === MANIFEST_FILE) {continue;}
    hashes[f.rel] = _sha256(f.abs);
  }

  const manifest = {
    version: 1,
    generated: new Date().toISOString(),
    files: hashes,
  };

  const manifestPath = path.join(runtimeDir, MANIFEST_FILE);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  if (_log.info)
    {_log.info("[integrity-check] Manifest generated", {
      files: Object.keys(hashes).length,
      path: manifestPath,
    });}

  return manifest;
}

/**
 * verify(runtimeDir) — check every file against the manifest.
 * Returns { ok: boolean, tampered: string[], missing: string[], extra: string[] }.
 */
function verify(runtimeDir) {
  const manifestPath = path.join(runtimeDir, MANIFEST_FILE);

  if (!fs.existsSync(manifestPath)) {
    if (_log.info) {_log.info("[integrity-check] No manifest found — first run, generating");}
    generateManifest(runtimeDir);
    return { ok: true, tampered: [], missing: [], extra: [] };
  }

  var manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (err) {
    if (_log.error) {_log.error("[integrity-check] Corrupt manifest", { error: err.message });}
    _integrityOk = false;
    return { ok: false, tampered: [], missing: ["(manifest corrupt)"], extra: [] };
  }

  const expectedFiles = manifest.files || {};
  const currentFiles = _collectFiles(runtimeDir, "");
  const currentMap = {};

  for (const f of currentFiles) {
    currentMap[f.rel] = _sha256(f.abs);
  }

  const tampered = [];
  const missing = [];
  const extra = [];

  // Check expected files
  for (const rel of Object.keys(expectedFiles)) {
    if (!currentMap[rel]) {
      missing.push(rel);
    } else if (currentMap[rel] !== expectedFiles[rel]) {
      tampered.push(rel);
    }
  }

  // Check for unexpected new files
  for (const rel of Object.keys(currentMap)) {
    if (!expectedFiles[rel]) {
      extra.push(rel);
    }
  }

  // Determine if any critical file was tampered or missing
  var criticalBreach = false;
  for (var i = 0; i < CRITICAL_FILES.length; i++) {
    if (tampered.indexOf(CRITICAL_FILES[i]) !== -1 || missing.indexOf(CRITICAL_FILES[i]) !== -1) {
      criticalBreach = true;
      break;
    }
  }

  if (criticalBreach) {
    _integrityOk = false;
    if (_log.error)
      {_log.error(
        "[integrity-check] CRITICAL — tampered core files detected, degrading to read-only",
        {
          tampered: tampered,
          missing: missing,
        },
      );}
  } else if (tampered.length > 0 || missing.length > 0) {
    if (_log.warn)
      {_log.warn("[integrity-check] Non-critical files changed", {
        tampered: tampered,
        missing: missing,
        extra: extra,
      });}
  } else {
    if (_log.info)
      {_log.info("[integrity-check] All files verified", {
        checked: Object.keys(expectedFiles).length,
      });}
  }

  var ok = tampered.length === 0 && missing.length === 0;
  return { ok: ok, tampered: tampered, missing: missing, extra: extra };
}

/**
 * init(runtimeDir, logger) — run verification on boot.
 */
function init(runtimeDir, logger) {
  if (logger) {_log = logger;}
  _integrityOk = true; // reset before check
  return verify(runtimeDir);
}

/**
 * isIntegrityOk() — used by engine to gate write operations.
 */
function isIntegrityOk() {
  return _integrityOk;
}

module.exports = { init, generateManifest, verify, isIntegrityOk };
