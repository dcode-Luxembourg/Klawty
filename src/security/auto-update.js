"use strict";

/**
 * Klawty Runtime — Auto-Update Manager
 *
 * Checks for new Klawty versions, downloads updates with backup + rollback.
 * Safety: never auto-applies. User must explicitly run `klawty update --apply`.
 *
 * Usage:
 *   const updater = require('./auto-update');
 *   updater.init(workspaceDir, config, logger);
 *
 *   const info = await updater.checkForUpdate();
 *   if (info.available) await updater.applyUpdate(info.latestVersion);
 *   // If something breaks:
 *   updater.rollback();
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const LICENSE_CHECK_URL = "https://ai-agent-builder.ai/api/license/check";
const RELEASE_BASE_URL = "https://klawty.ai/releases";
const UPDATE_LOG_FILE = "update-log.json";

let _workspaceDir = null;
let _config = null;
let _log = console;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function init(workspaceDir, config, logger) {
  _workspaceDir = workspaceDir;
  _config = config;
  if (logger) {_log = logger;}
}

// ---------------------------------------------------------------------------
// Version helpers
// ---------------------------------------------------------------------------

/**
 * _currentVersion() — reads version from runtime/package.json.
 */
function _currentVersion() {
  try {
    var pkgPath = path.join(__dirname, "package.json");
    var pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    return pkg.version || "0.0.0";
  } catch (_e) {
    return "0.0.0";
  }
}

/**
 * _parseSemver(str) — returns [major, minor, patch] or null.
 */
function _parseSemver(str) {
  if (!str || typeof str !== "string") {return null;}
  var m = str.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) {return null;}
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

/**
 * _isNewer(a, b) — true if version a is strictly newer than version b.
 */
function _isNewer(a, b) {
  var sa = _parseSemver(a);
  var sb = _parseSemver(b);
  if (!sa || !sb) {return false;}
  if (sa[0] !== sb[0]) {return sa[0] > sb[0];}
  if (sa[1] !== sb[1]) {return sa[1] > sb[1];}
  return sa[2] > sb[2];
}

// ---------------------------------------------------------------------------
// Update log
// ---------------------------------------------------------------------------

function _updateLogPath() {
  var obsDir = path.join(_workspaceDir, "observability");
  if (!fs.existsSync(obsDir)) {fs.mkdirSync(obsDir, { recursive: true });}
  return path.join(obsDir, UPDATE_LOG_FILE);
}

function _readUpdateLog() {
  var logPath = _updateLogPath();
  if (!fs.existsSync(logPath)) {return [];}
  try {
    return JSON.parse(fs.readFileSync(logPath, "utf8"));
  } catch (_e) {
    return [];
  }
}

function _appendUpdateLog(entry) {
  var log = _readUpdateLog();
  log.push(entry);
  // Keep last 50 entries
  if (log.length > 50) {log = log.slice(log.length - 50);}
  fs.writeFileSync(_updateLogPath(), JSON.stringify(log, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// Check for update
// ---------------------------------------------------------------------------

/**
 * checkForUpdate() — calls the license/check API to see if a newer version exists.
 * Returns { available, currentVersion, latestVersion, error? }.
 */
async function checkForUpdate() {
  var current = _currentVersion();

  try {
    var url = LICENSE_CHECK_URL + "?v=" + encodeURIComponent(current);
    var data = await _httpsGetJson(url, 10000);

    var latest = data.latestVersion || current;
    var available = _isNewer(latest, current);

    if (_log.info)
      {_log.info("[auto-update] Version check", {
        current: current,
        latest: latest,
        available: available,
      });}

    return {
      available: available,
      currentVersion: current,
      latestVersion: latest,
    };
  } catch (err) {
    if (_log.warn) {_log.warn("[auto-update] Version check failed", { error: err.message });}
    return {
      available: false,
      currentVersion: current,
      latestVersion: current,
      error: err.message,
    };
  }
}

// ---------------------------------------------------------------------------
// Apply update
// ---------------------------------------------------------------------------

/**
 * applyUpdate(targetVersion) — downloads the update bundle, backs up current
 * runtime/, extracts new runtime/, verifies integrity, and signals restart.
 *
 * Returns { success, fromVersion, toVersion, backupDir?, error? }.
 */
async function applyUpdate(targetVersion) {
  var current = _currentVersion();

  if (!_isNewer(targetVersion, current)) {
    return {
      success: false,
      fromVersion: current,
      toVersion: targetVersion,
      error: "Target version is not newer than current",
    };
  }

  var logEntry = {
    timestamp: new Date().toISOString(),
    fromVersion: current,
    toVersion: targetVersion,
    status: "started",
  };

  if (_log.info) {_log.info("[auto-update] Starting update", { from: current, to: targetVersion });}

  // Step 1: Create backup of current runtime/ via backup.js
  var backupDir = null;
  try {
    var backup = require("./backup");
    if (!backup._initialized) {backup.init(_workspaceDir, _log);}
    var result = backup.runBackup();
    backupDir = result.backupDir;

    // Also create a specific runtime/ backup for rollback
    var runtimeBackupDir = path.join(_workspaceDir, "backups", "pre-update-" + current);
    if (!fs.existsSync(runtimeBackupDir)) {fs.mkdirSync(runtimeBackupDir, { recursive: true });}
    _copyDirSync(__dirname, runtimeBackupDir);

    logEntry.backupDir = runtimeBackupDir;
    if (_log.info) {_log.info("[auto-update] Backup created", { dir: runtimeBackupDir });}
  } catch (err) {
    logEntry.status = "failed";
    logEntry.error = "Backup failed: " + err.message;
    _appendUpdateLog(logEntry);
    return {
      success: false,
      fromVersion: current,
      toVersion: targetVersion,
      error: logEntry.error,
    };
  }

  // Step 2: Download update bundle
  var bundlePath = path.join(_workspaceDir, "tmp", "update-" + targetVersion + ".tar.gz");
  try {
    var tmpDir = path.join(_workspaceDir, "tmp");
    if (!fs.existsSync(tmpDir)) {fs.mkdirSync(tmpDir, { recursive: true });}

    var bundleUrl = RELEASE_BASE_URL + "/" + targetVersion + ".tar.gz";
    await _httpsDownload(bundleUrl, bundlePath, 120000);

    if (_log.info) {_log.info("[auto-update] Bundle downloaded", { path: bundlePath });}
  } catch (err) {
    logEntry.status = "failed";
    logEntry.error = "Download failed: " + err.message;
    _appendUpdateLog(logEntry);
    _cleanup(bundlePath);
    return {
      success: false,
      fromVersion: current,
      toVersion: targetVersion,
      error: logEntry.error,
    };
  }

  // Step 3: Extract to a staging directory, then swap
  var stagingDir = path.join(_workspaceDir, "tmp", "update-staging-" + targetVersion);
  try {
    if (fs.existsSync(stagingDir)) {_rmrfSafe(stagingDir);}
    fs.mkdirSync(stagingDir, { recursive: true });

    execFileSync("tar", ["-xzf", bundlePath, "-C", stagingDir], { timeout: 30000 });

    if (_log.info) {_log.info("[auto-update] Bundle extracted", { dir: stagingDir });}
  } catch (err) {
    logEntry.status = "failed";
    logEntry.error = "Extraction failed: " + err.message;
    _appendUpdateLog(logEntry);
    _cleanup(bundlePath);
    _cleanup(stagingDir);
    return {
      success: false,
      fromVersion: current,
      toVersion: targetVersion,
      error: logEntry.error,
    };
  }

  // Step 4: Verify integrity of new runtime
  try {
    var integrityCheck = require("./integrity-check");
    var runtimeSrc = _findRuntimeDir(stagingDir);
    var verification = integrityCheck.verify(runtimeSrc);

    if (!verification.ok && verification.tampered.length > 0) {
      throw new Error(
        "Integrity check failed — tampered files: " + verification.tampered.join(", "),
      );
    }

    if (_log.info) {_log.info("[auto-update] Integrity verified");}
  } catch (err) {
    logEntry.status = "failed";
    logEntry.error = "Integrity check failed: " + err.message;
    _appendUpdateLog(logEntry);
    _cleanup(bundlePath);
    _cleanup(stagingDir);
    return {
      success: false,
      fromVersion: current,
      toVersion: targetVersion,
      error: logEntry.error,
    };
  }

  // Step 5: Swap runtime/ — copy staging into current runtime dir
  try {
    var runtimeSrc2 = _findRuntimeDir(stagingDir);
    _copyDirSync(runtimeSrc2, __dirname);
    if (_log.info) {_log.info("[auto-update] Runtime files updated");}
  } catch (err) {
    logEntry.status = "failed";
    logEntry.error = "File swap failed: " + err.message;
    _appendUpdateLog(logEntry);
    // Attempt rollback since we partially wrote files
    try {
      rollback();
    } catch (_e) {
      /* best effort */
    }
    return {
      success: false,
      fromVersion: current,
      toVersion: targetVersion,
      error: logEntry.error,
    };
  }

  // Step 6: Cleanup temp files
  _cleanup(bundlePath);
  _cleanup(stagingDir);

  // Step 7: Log success
  logEntry.status = "success";
  _appendUpdateLog(logEntry);

  if (_log.info) {_log.info("[auto-update] Update complete", { from: current, to: targetVersion });}

  return {
    success: true,
    fromVersion: current,
    toVersion: targetVersion,
    backupDir: logEntry.backupDir,
  };
}

// ---------------------------------------------------------------------------
// Rollback
// ---------------------------------------------------------------------------

/**
 * rollback() — restores runtime/ from the most recent pre-update backup.
 * Returns { success, restoredFrom, error? }.
 */
function rollback() {
  var backupsDir = path.join(_workspaceDir, "backups");
  if (!fs.existsSync(backupsDir)) {
    return { success: false, error: "No backups directory found" };
  }

  // Find the most recent pre-update backup
  var entries = fs
    .readdirSync(backupsDir)
    .filter(function (d) {
      return d.startsWith("pre-update-");
    })
    .toSorted()
    .toReversed();

  if (entries.length === 0) {
    return { success: false, error: "No pre-update backups found" };
  }

  var backupName = entries[0];
  var backupPath = path.join(backupsDir, backupName);

  if (_log.info) {_log.info("[auto-update] Rolling back from", { backup: backupName });}

  try {
    _copyDirSync(backupPath, __dirname);

    // Log the rollback
    _appendUpdateLog({
      timestamp: new Date().toISOString(),
      action: "rollback",
      from: backupName,
      status: "rolled-back",
    });

    if (_log.info) {_log.info("[auto-update] Rollback complete", { from: backupName });}
    return { success: true, restoredFrom: backupName };
  } catch (err) {
    if (_log.error) {_log.error("[auto-update] Rollback failed", { error: err.message });}
    return { success: false, restoredFrom: backupName, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Update history
// ---------------------------------------------------------------------------

/**
 * getUpdateHistory() — returns the update log entries.
 */
function getUpdateHistory() {
  return _readUpdateLog();
}

// ---------------------------------------------------------------------------
// HTTP helpers (Node.js built-in https)
// ---------------------------------------------------------------------------

function _httpsGetJson(url, timeoutMs) {
  return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () {
      reject(new Error("Request timed out"));
    }, timeoutMs || 10000);

    https
      .get(url, function (res) {
        var body = "";
        res.on("data", function (chunk) {
          body += chunk;
        });
        res.on("end", function () {
          clearTimeout(timer);
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error("HTTP " + res.statusCode + ": " + body.slice(0, 200)));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error("Invalid JSON: " + e.message));
          }
        });
      })
      .on("error", function (err) {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function _httpsDownload(url, destPath, timeoutMs) {
  return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () {
      reject(new Error("Download timed out"));
    }, timeoutMs || 120000);

    https
      .get(url, function (res) {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          clearTimeout(timer);
          resolve(_httpsDownload(res.headers.location, destPath, timeoutMs));
          return;
        }

        if (res.statusCode !== 200) {
          clearTimeout(timer);
          reject(new Error("Download failed: HTTP " + res.statusCode));
          return;
        }

        var stream = fs.createWriteStream(destPath);
        res.pipe(stream);
        stream.on("finish", function () {
          clearTimeout(timer);
          stream.close();
          resolve();
        });
        stream.on("error", function (err) {
          clearTimeout(timer);
          reject(err);
        });
      })
      .on("error", function (err) {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

function _copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {fs.mkdirSync(dest, { recursive: true });}

  var entries = fs.readdirSync(src, { withFileTypes: true });
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    var srcPath = path.join(src, entry.name);
    var destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules") {continue;} // skip node_modules
      _copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function _findRuntimeDir(stagingDir) {
  // Look for a runtime/ subdirectory in the extracted bundle
  var runtimeDir = path.join(stagingDir, "runtime");
  if (fs.existsSync(runtimeDir)) {return runtimeDir;}

  // If the bundle extracts flat, use staging dir itself
  if (fs.existsSync(path.join(stagingDir, "engine.js"))) {return stagingDir;}

  // Check one level deep for a named directory
  var dirs = fs.readdirSync(stagingDir, { withFileTypes: true }).filter(function (d) {
    return d.isDirectory();
  });
  for (var i = 0; i < dirs.length; i++) {
    var candidate = path.join(stagingDir, dirs[i].name, "runtime");
    if (fs.existsSync(candidate)) {return candidate;}
    if (fs.existsSync(path.join(stagingDir, dirs[i].name, "engine.js"))) {
      return path.join(stagingDir, dirs[i].name);
    }
  }

  return stagingDir; // fallback
}

function _rmrfSafe(dirPath) {
  // Safety: only delete within workspace tmp or backups
  if (!dirPath.includes("/tmp/") && !dirPath.includes("/backups/")) {
    throw new Error("Refusing to delete outside safe directories: " + dirPath);
  }
  if (!fs.existsSync(dirPath)) {return;}
  fs.rmSync(dirPath, { recursive: true, force: true });
}

function _cleanup(filePath) {
  try {
    if (!fs.existsSync(filePath)) {return;}
    var stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      _rmrfSafe(filePath);
    } else {
      fs.unlinkSync(filePath);
    }
  } catch (_e) {
    /* best effort cleanup */
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  init,
  checkForUpdate,
  applyUpdate,
  rollback,
  getUpdateHistory,
};
