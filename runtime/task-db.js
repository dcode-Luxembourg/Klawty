/**
 * OpenClaw Runtime — Task Database
 * SQLite-backed task queue, proposals, messages, cost tracking.
 * WAL mode for concurrent reads.
 *
 * Usage:
 *   const db = require('./task-db');
 *   const task = db.createTask({ agent: 'atlas', title: 'Check inbox', priority: 'high' });
 */

"use strict";

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const DATA_DIR = path.resolve(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "tasks.db");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

// ── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    agent TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'backlog'
      CHECK(status IN ('backlog','in_progress','review','done','failed',
                       'proposed','pending_approval','testing','pending_validation')),
    priority TEXT DEFAULT 'medium'
      CHECK(priority IN ('critical','high','medium','low')),
    tier TEXT CHECK(tier IN ('AUTO','AUTO+','PROPOSE','CONFIRM','BLOCK')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    evidence TEXT,
    metadata TEXT
  );

  CREATE TABLE IF NOT EXISTS proposals (
    id TEXT PRIMARY KEY,
    agent TEXT NOT NULL,
    action TEXT NOT NULL,
    tier TEXT NOT NULL,
    status TEXT DEFAULT 'pending'
      CHECK(status IN ('pending','sentinel_approved','sentinel_blocked','executing',
                       'awaiting_human','approved','rejected','blocked','expired',
                       'completed','failed')),
    details TEXT,
    discord_message_id TEXT,
    rollback_snapshot TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    resolved_by TEXT
  );

  CREATE TABLE IF NOT EXISTS agent_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_agent TEXT NOT NULL,
    to_agent TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('task_handoff','data_request','alert','notification')),
    payload TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','read','processed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS agent_costs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent TEXT NOT NULL,
    model_id TEXT NOT NULL,
    task_id TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent);
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_agent_status ON tasks(agent, status);
  CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
  CREATE INDEX IF NOT EXISTS idx_proposals_agent ON proposals(agent);
  CREATE INDEX IF NOT EXISTS idx_messages_to ON agent_messages(to_agent, status);
  CREATE INDEX IF NOT EXISTS idx_costs_date ON agent_costs(created_at);
`);

// ── Prepared Statements ─────────────────────────────────────────────────────

const _insertTask = db.prepare(
  `INSERT INTO tasks (id, agent, title, description, priority, tier, status, metadata)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
);

const _findSimilar = db.prepare(
  `SELECT id FROM tasks WHERE agent = ? AND title = ? AND status NOT IN ('done','failed')
   AND created_at > datetime('now', '-2 days') LIMIT 1`,
);

// ── Tasks ───────────────────────────────────────────────────────────────────

function createTask({ agent, title, description, priority, tier, status, metadata, dedup }) {
  if (dedup) {
    const existing = _findSimilar.get(agent, title);
    if (existing) return null;
  }
  const id = crypto.randomUUID();
  const meta = metadata
    ? typeof metadata === "string"
      ? metadata
      : JSON.stringify(metadata)
    : null;
  _insertTask.run(
    id,
    agent,
    title,
    description || null,
    priority || "medium",
    tier || "AUTO",
    status || "backlog",
    meta,
  );
  return { id, agent, title, status: status || "backlog" };
}

function getTask(id) {
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
}

function updateTask(id, updates) {
  const sets = [];
  const vals = [];
  for (const [key, val] of Object.entries(updates)) {
    if (key === "metadata" && typeof val === "object") {
      sets.push("metadata = ?");
      vals.push(JSON.stringify(val));
    } else {
      sets.push(`${key} = ?`);
      vals.push(val);
    }
  }
  sets.push("updated_at = CURRENT_TIMESTAMP");
  vals.push(id);
  db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  return getTask(id);
}

function completeTask(id, evidence) {
  db.prepare(
    `UPDATE tasks SET status='done', evidence=?, completed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
  ).run(evidence || null, id);
  return getTask(id);
}

function failTask(id, reason) {
  db.prepare(
    `UPDATE tasks SET status='failed', evidence=?, completed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
  ).run(reason || null, id);
  return getTask(id);
}

function getAgentTasks(agent, status) {
  return db
    .prepare("SELECT * FROM tasks WHERE agent = ? AND status = ? ORDER BY priority, created_at")
    .all(agent, status);
}

function getNextTasks(agent, limit) {
  const n = limit || 3;
  return db
    .prepare(
      `SELECT * FROM tasks WHERE agent = ? AND status = 'backlog'
     ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, created_at
     LIMIT ?`,
    )
    .all(agent, n);
}

function getRecentTasks(agent, days) {
  const d = days || 2;
  return db
    .prepare(
      `SELECT * FROM tasks WHERE agent = ? AND created_at > datetime('now', '-' || ? || ' days') ORDER BY created_at DESC LIMIT 20`,
    )
    .all(agent, d);
}

function getActiveTasks() {
  return db
    .prepare(
      `SELECT * FROM tasks WHERE status IN ('backlog','in_progress','review') ORDER BY created_at DESC`,
    )
    .all();
}

function getTaskByProposal(proposalId) {
  return db
    .prepare(`SELECT * FROM tasks WHERE json_extract(metadata, '$.pending_proposal') = ? LIMIT 1`)
    .get(proposalId);
}

function resetStuckTasks() {
  return db
    .prepare(
      `UPDATE tasks SET status='backlog', updated_at=CURRENT_TIMESTAMP WHERE status='in_progress' AND updated_at < datetime('now', '-2 hours')`,
    )
    .run().changes;
}

// ── Proposals ───────────────────────────────────────────────────────────────

function createProposal({ agent, action, tier, details }) {
  const existing = db
    .prepare(
      `SELECT id FROM proposals WHERE agent = ? AND action = ? AND status IN ('pending','executing','sentinel_approved','awaiting_human') LIMIT 1`,
    )
    .get(agent, action);
  if (existing) return existing;

  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO proposals (id, agent, action, tier, details) VALUES (?, ?, ?, ?, ?)`).run(
    id,
    agent,
    action,
    tier,
    typeof details === "string" ? details : JSON.stringify(details),
  );
  return { id, agent, action, tier, status: "pending" };
}

function getProposal(id) {
  return db.prepare("SELECT * FROM proposals WHERE id = ?").get(id);
}

function resolveProposal(id, opts) {
  const sets = ["status = ?", "resolved_at = CURRENT_TIMESTAMP"];
  const vals = [opts.status];
  if (opts.resolvedBy) {
    sets.push("resolved_by = ?");
    vals.push(opts.resolvedBy);
  }
  if (opts.rollbackSnapshot) {
    sets.push("rollback_snapshot = ?");
    vals.push(JSON.stringify(opts.rollbackSnapshot));
  }
  vals.push(id);
  db.prepare(`UPDATE proposals SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
}

function getPendingProposals(agent) {
  const where = agent
    ? `agent = '${agent}' AND status IN ('pending','executing','sentinel_approved','awaiting_human')`
    : `status IN ('pending','executing','sentinel_approved','awaiting_human')`;
  return db.prepare(`SELECT * FROM proposals WHERE ${where} ORDER BY created_at`).all();
}

function getExpiredProposals(hoursOld) {
  const h = hoursOld || 24;
  return db
    .prepare(
      `SELECT * FROM proposals WHERE status IN ('pending','executing','sentinel_approved','awaiting_human') AND created_at < datetime('now', '-' || ? || ' hours')`,
    )
    .all(h);
}

// ── Messages ────────────────────────────────────────────────────────────────

function sendMessage({ fromAgent, toAgent, type, payload }) {
  const result = db
    .prepare(`INSERT INTO agent_messages (from_agent, to_agent, type, payload) VALUES (?, ?, ?, ?)`)
    .run(fromAgent, toAgent, type, typeof payload === "string" ? payload : JSON.stringify(payload));
  return result.lastInsertRowid;
}

function getMessages(agent, unreadOnly) {
  const where = unreadOnly ? `to_agent = ? AND status = 'pending'` : `to_agent = ?`;
  return db
    .prepare(`SELECT * FROM agent_messages WHERE ${where} ORDER BY created_at DESC LIMIT 20`)
    .all(agent);
}

function markMessageProcessed(id) {
  db.prepare(
    `UPDATE agent_messages SET status='processed', processed_at=CURRENT_TIMESTAMP WHERE id=?`,
  ).run(id);
}

// ── Cost Tracking ───────────────────────────────────────────────────────────

function recordLLMCost({ agent, modelId, taskId, inputTokens, outputTokens, costUSD }) {
  db.prepare(
    `INSERT INTO agent_costs (agent, model_id, task_id, input_tokens, output_tokens, cost_usd) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(agent, modelId, taskId || null, inputTokens || 0, outputTokens || 0, costUSD || 0);
}

function getDailySpend(date) {
  const d = date || new Date().toISOString().slice(0, 10);
  return db
    .prepare(
      `SELECT COALESCE(SUM(cost_usd), 0) as total FROM agent_costs WHERE DATE(created_at) = ?`,
    )
    .get(d).total;
}

function getDailySpendByAgent(date) {
  const d = date || new Date().toISOString().slice(0, 10);
  return db
    .prepare(
      `SELECT agent, SUM(cost_usd) as total, COUNT(*) as calls FROM agent_costs WHERE DATE(created_at) = ? GROUP BY agent ORDER BY total DESC`,
    )
    .all(d);
}

function getStats() {
  return {
    tasks: db.prepare(`SELECT status, COUNT(*) as count FROM tasks GROUP BY status`).all(),
    proposals: db.prepare(`SELECT status, COUNT(*) as count FROM proposals GROUP BY status`).all(),
    dailyCostUSD: getDailySpend(),
  };
}

module.exports = {
  createTask,
  getTask,
  updateTask,
  completeTask,
  failTask,
  getAgentTasks,
  getNextTasks,
  getActiveTasks,
  getRecentTasks,
  getTaskByProposal,
  resetStuckTasks,
  createProposal,
  getProposal,
  resolveProposal,
  getPendingProposals,
  getExpiredProposals,
  sendMessage,
  getMessages,
  markMessageProcessed,
  recordLLMCost,
  getDailySpend,
  getDailySpendByAgent,
  getStats,
  db,
};
