/**
 * OpenClaw Runtime — Channel Adapter
 * Unified interface for Discord, Slack, Telegram, and terminal.
 */

"use strict";

const https = require("https");

// ── Dedup ───────────────────────────────────────────────────────────────────

const DEDUP_WINDOW_MS = 4 * 60 * 60 * 1000;
const SIMILARITY_THRESHOLD = 0.7;
const recentPosts = {};

function normalize(text) {
  return text
    .replace(/\*\*/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isDuplicate(channelId, content) {
  const now = Date.now();
  const history = (recentPosts[channelId] || []).filter((h) => now - h.time < DEDUP_WINDOW_MS);
  recentPosts[channelId] = history;

  const norm = normalize(content);
  const words = norm.split(" ").filter((w) => w.length > 2);
  if (words.length < 3) return false;

  for (const post of history) {
    if (post.norm === norm) return true;
    const existing = post.norm.split(" ").filter((w) => w.length > 2);
    const overlap = words.filter((w) => existing.includes(w)).length;
    if (overlap / Math.max(words.length, existing.length) >= SIMILARITY_THRESHOLD) return true;
  }
  return false;
}

function recordPost(channelId, content) {
  if (!recentPosts[channelId]) recentPosts[channelId] = [];
  recentPosts[channelId].push({ norm: normalize(content), time: Date.now() });
}

// ── Sanitize ────────────────────────────────────────────────────────────────

function sanitize(text) {
  return text
    .replace(
      /<(use_mcp_tool|use_tool|server_name|tool_name|arguments|parameters|function_call)[^>]*>[\s\S]*?<\/\1>/gi,
      "",
    )
    .replace(
      /<\/?(use_mcp_tool|use_tool|server_name|tool_name|arguments|parameters|function_call)[^>]*>/gi,
      "",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Discord ─────────────────────────────────────────────────────────────────

function postDiscord(channelId, content, token) {
  if (!channelId || !token) return Promise.resolve(false);
  const cleaned = sanitize(content).slice(0, 2000);
  if (isDuplicate(channelId, cleaned)) return Promise.resolve(true);

  const body = JSON.stringify({ content: cleaned });
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "discord.com",
        path: `/api/v10/channels/${channelId}/messages`,
        method: "POST",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          const ok = res.statusCode < 300;
          if (ok) recordPost(channelId, cleaned);
          resolve(ok);
        });
      },
    );
    req.on("error", () => resolve(false));
    req.write(body);
    req.end();
  });
}

// ── Telegram ────────────────────────────────────────────────────────────────

function postTelegram(chatId, content, token) {
  if (!chatId || !token) return Promise.resolve(false);
  const body = JSON.stringify({
    chat_id: chatId,
    text: sanitize(content).slice(0, 4000),
    parse_mode: "Markdown",
  });
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "api.telegram.org",
        path: `/bot${token}/sendMessage`,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(res.statusCode < 300));
      },
    );
    req.on("error", () => resolve(false));
    req.write(body);
    req.end();
  });
}

// ── Terminal ────────────────────────────────────────────────────────────────

function postTerminal(_, content) {
  console.log(`\n${sanitize(content)}\n`);
  return Promise.resolve(true);
}

// ── Unified API ─────────────────────────────────────────────────────────────

const ADAPTERS = {
  discord: postDiscord,
  telegram: postTelegram,
  terminal: postTerminal,
};

async function post(type, channelId, content, token) {
  const adapter = ADAPTERS[type] || ADAPTERS.terminal;
  return adapter(channelId, content, token);
}

module.exports = { post, sanitize, isDuplicate, ADAPTERS };
