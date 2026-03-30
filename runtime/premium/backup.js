/** OpenClaw Runtime — Backup Service (Premium) */

"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const https = require("https");

// ---------------------------------------------------------------------------
// Logger — lightweight, replaceable via init()
// ---------------------------------------------------------------------------

let _logger = {
  info: (msg, ctx) => console.log(`[backup] ${msg}`, ctx || ""),
  warn: (msg, ctx) => console.warn(`[backup] ${msg}`, ctx || ""),
  error: (msg, ctx) => console.error(`[backup] ${msg}`, ctx || ""),
};

// ---------------------------------------------------------------------------
// Alert adapter — configurable notification channel
// ---------------------------------------------------------------------------

let _alertAdapter = {
  sendAlert: async (msg) => _logger.info(`[alert] ${msg}`),
  sendCritical: async (msg) => _logger.error(`[critical] ${msg}`),
};

// ---------------------------------------------------------------------------
// Configuration — set via init()
// ---------------------------------------------------------------------------

let _basePath = "";
let _backupRoot = "";
let _dataDir = "";
let _agentsDir = "";
let _memoryDir = "";
let _retentionDays = 30;

/**
 * SQLite database files to back up.
 * Each entry: { file: 'name.db', verify: function(db) | null }
 * The verify function receives a better-sqlite3 Database instance and should return stats.
 * @type {Array<{file: string, verify: Function|null}>}
 */
let _dbFiles = [{ file: "tasks.db", verify: null }];

/**
 * Agent file names to back up from each agent directory.
 * @type {string[]}
 */
let _agentFiles = ["SOUL.md", "AGENT.md", "MEMORY.md"];

/**
 * Qdrant configuration (optional, for vector memory backup).
 * @type {{url: string, apiKey: string, collection: string}|null}
 */
let _qdrantConfig = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFileIfExists(src, dest) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    return true;
  }
  return false;
}

function getDateString() {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

// ---------------------------------------------------------------------------
// Backup functions
// ---------------------------------------------------------------------------

function backupSqlite(backupDir) {
  let allOk = true;

  for (const { file, verify } of _dbFiles) {
    const dbPath = path.join(_dataDir, file);
    const destPath = path.join(backupDir, file);

    if (!fs.existsSync(dbPath)) {
      _logger.warn("SQLite database not found, skipping", { path: dbPath });
      continue;
    }

    // Use SQLite backup command for consistency (WAL-safe)
    try {
      execFileSync("sqlite3", [dbPath, `.backup '${destPath}'`], { timeout: 30000 });
    } catch (err) {
      // Fallback: file copy
      _logger.warn(`sqlite3 CLI backup failed for ${file}, using file copy`, {
        error: err.message,
      });
      fs.copyFileSync(dbPath, destPath);
    }

    // Verification
    try {
      const Database = require("better-sqlite3");
      const testDb = new Database(destPath, { readonly: true });
      const stats = verify ? verify(testDb) : {};
      testDb.close();
      _logger.info(`SQLite backup verified: ${file}`, stats);
    } catch (err) {
      _logger.error(`SQLite backup verification FAILED: ${file}`, { error: err.message });
      // Mark as failed if this is the first (primary) database
      if (file === _dbFiles[0].file) allOk = false;
    }
  }

  return allOk;
}

function backupAgentFiles(backupDir) {
  const agentsBackup = path.join(backupDir, "agents");
  ensureDir(agentsBackup);

  // Auto-discover agent directories (any subdir with AGENT.md or SOUL.md)
  let agentDirs = [];
  try {
    const entries = fs.readdirSync(_agentsDir, { withFileTypes: true });
    agentDirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((name) => {
        return _agentFiles.some((f) => fs.existsSync(path.join(_agentsDir, name, f)));
      });
  } catch (err) {
    _logger.warn("Failed to scan agents directory", { error: err.message });
    return 0;
  }

  let count = 0;

  for (const agent of agentDirs) {
    const agentDir = path.join(_agentsDir, agent);
    const destDir = path.join(agentsBackup, agent);
    ensureDir(destDir);

    for (const file of _agentFiles) {
      if (copyFileIfExists(path.join(agentDir, file), path.join(destDir, file))) {
        count++;
      }
    }
  }

  _logger.info("Agent files backed up", { fileCount: count, agents: agentDirs.length });
  return count;
}

function backupMemoryFiles(backupDir) {
  const memBackup = path.join(backupDir, "memory");
  ensureDir(memBackup);

  if (!fs.existsSync(_memoryDir)) {
    _logger.warn("Memory directory not found", { path: _memoryDir });
    return 0;
  }

  const files = fs.readdirSync(_memoryDir).filter((f) => f.endsWith(".md"));
  let count = 0;

  for (const file of files) {
    copyFileIfExists(path.join(_memoryDir, file), path.join(memBackup, file));
    count++;
  }

  _logger.info("Memory files backed up", { fileCount: count });
  return count;
}

function backupQdrantSnapshot(backupDir) {
  if (!_qdrantConfig) {
    _logger.info("Qdrant backup skipped (not configured)");
    return Promise.resolve(false);
  }

  // Request a snapshot from Qdrant
  return new Promise((resolve) => {
    try {
      const qdrantUrl = new URL(
        `/collections/${_qdrantConfig.collection}/snapshots`,
        _qdrantConfig.url,
      );
      const isHttps = qdrantUrl.protocol === "https:";
      const transport = isHttps ? https : require("http");

      const options = {
        hostname: qdrantUrl.hostname,
        port: qdrantUrl.port || (isHttps ? 443 : 6333),
        path: qdrantUrl.pathname,
        method: "POST",
        headers: {
          "api-key": _qdrantConfig.apiKey || "",
          "Content-Type": "application/json",
        },
        timeout: 60000,
      };

      const req = transport.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode === 200) {
            const result = JSON.parse(body);
            const snapshotInfo = path.join(backupDir, "qdrant-snapshot-info.json");
            fs.writeFileSync(snapshotInfo, JSON.stringify(result, null, 2));
            _logger.info("Qdrant snapshot created", { result: result.result });
            resolve(true);
          } else {
            _logger.warn("Qdrant snapshot failed", {
              statusCode: res.statusCode,
              body: body.substring(0, 200),
            });
            resolve(false);
          }
        });
      });

      req.on("error", (err) => {
        _logger.warn("Qdrant snapshot request error", { error: err.message });
        resolve(false);
      });

      req.on("timeout", () => {
        req.destroy();
        _logger.warn("Qdrant snapshot timed out");
        resolve(false);
      });

      req.end();
    } catch (err) {
      _logger.warn("Qdrant snapshot skipped (config not available)", { error: err.message });
      resolve(false);
    }
  });
}

// ---------------------------------------------------------------------------
// Cleanup old backups
// ---------------------------------------------------------------------------

function cleanOldBackups() {
  if (!fs.existsSync(_backupRoot)) return;

  const cutoff = Date.now() - _retentionDays * 24 * 60 * 60 * 1000;
  const entries = fs.readdirSync(_backupRoot);
  let removed = 0;

  for (const entry of entries) {
    const entryPath = path.join(_backupRoot, entry);
    const stat = fs.statSync(entryPath);

    if (stat.isDirectory() && stat.mtimeMs < cutoff) {
      try {
        fs.rmSync(entryPath, { recursive: true, force: true });
        removed++;
        _logger.info("Old backup removed", { dir: entry });
      } catch (err) {
        _logger.warn("Failed to remove old backup", { dir: entry, error: err.message });
      }
    }
  }

  if (removed > 0) {
    _logger.info(`Cleaned ${removed} old backup(s)`);
  }
}

// ---------------------------------------------------------------------------
// Main backup routine
// ---------------------------------------------------------------------------

async function runBackup() {
  const date = getDateString();
  const backupDir = path.join(_backupRoot, date);

  _logger.info("Backup starting", { date, destination: backupDir });

  ensureDir(backupDir);

  const results = {
    date,
    sqlite: false,
    agentFiles: 0,
    memoryFiles: 0,
    qdrant: false,
  };

  try {
    // 1. SQLite databases
    results.sqlite = backupSqlite(backupDir);

    // 2. Agent files (SOUL.md, AGENT.md, MEMORY.md, etc.)
    results.agentFiles = backupAgentFiles(backupDir);

    // 3. Memory files (session logs)
    results.memoryFiles = backupMemoryFiles(backupDir);

    // 4. Qdrant snapshot (if configured)
    results.qdrant = await backupQdrantSnapshot(backupDir);

    // 5. Write manifest
    const manifest = {
      ...results,
      timestamp: new Date().toISOString(),
      backupDir,
    };
    fs.writeFileSync(path.join(backupDir, "manifest.json"), JSON.stringify(manifest, null, 2));

    // 6. Clean old backups
    cleanOldBackups();

    // Report
    const summary = `Backup ${date} complete: SQLite=${results.sqlite}, Agents=${results.agentFiles} files, Memory=${results.memoryFiles} files, Qdrant=${results.qdrant}`;
    _logger.info(summary);

    if (!results.sqlite) {
      await _alertAdapter.sendAlert(`Backup ${date}: SQLite backup failed`, "backup");
    }

    return results;
  } catch (err) {
    const msg = `Backup ${date} FAILED: ${err.message}`;
    _logger.error(msg, { error: err.stack });
    await _alertAdapter.sendCritical(msg, "backup");
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the backup service with workspace configuration.
 *
 * @param {Object} config
 * @param {string} config.basePath - Workspace root directory (project root)
 * @param {number} [config.retentionDays=30] - Number of days to retain backups
 * @param {Array<{file: string, verify?: Function}>} [config.dbFiles] - SQLite files to back up
 *   Default: [{ file: 'tasks.db', verify: null }]
 * @param {string[]} [config.agentFiles] - File names to back up from each agent directory
 *   Default: ['SOUL.md', 'AGENT.md', 'MEMORY.md']
 * @param {{url: string, apiKey: string, collection: string}} [config.qdrant] - Qdrant config for snapshot backup
 * @param {Object} [config.alertAdapter] - Alert adapter with sendAlert(msg, src) and sendCritical(msg, src)
 * @param {Object} [config.logger] - Logger with info/warn/error methods
 */
function init(config = {}) {
  if (!config.basePath) {
    throw new Error("backup service requires config.basePath (workspace root directory)");
  }

  _basePath = config.basePath;
  _backupRoot = path.join(_basePath, "backups");
  _dataDir = path.join(_basePath, "data");
  _agentsDir = path.join(_basePath, "agents");
  _memoryDir = path.join(_basePath, "memory");
  _retentionDays = config.retentionDays || 30;

  if (config.dbFiles) _dbFiles = config.dbFiles;
  if (config.agentFiles) _agentFiles = config.agentFiles;
  if (config.qdrant) _qdrantConfig = config.qdrant;
  if (config.alertAdapter) _alertAdapter = config.alertAdapter;
  if (config.logger) _logger = config.logger;
}

// ---------------------------------------------------------------------------
// Run if called directly
// ---------------------------------------------------------------------------
if (require.main === module) {
  // When run directly, expect basePath as CLI argument or WORKSPACE_DIR env
  const basePath = process.argv[2] || process.env.WORKSPACE_DIR;
  if (!basePath) {
    console.error("Usage: node backup.js <workspace-path>");
    console.error("  or set WORKSPACE_DIR environment variable");
    process.exit(1);
  }

  init({ basePath });
  runBackup()
    .then((results) => {
      console.log("Backup completed:", JSON.stringify(results, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error("Backup failed:", err);
      process.exit(1);
    });
}

module.exports = { init, runBackup };
