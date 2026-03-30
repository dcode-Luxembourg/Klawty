/**
 * OpenClaw Runtime — LLM Router
 * 5-tier model routing with pattern-based escalation/downgrade.
 * Reads config from klawty.json.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

// ── Load config ─────────────────────────────────────────────────────────────

const CONFIG_PATH = path.resolve(__dirname, "..", "klawty.json");
let config = {};
try {
  const raw = fs.readFileSync(CONFIG_PATH, "utf8");
  // Strip JSON5 comments but preserve URLs (// inside strings)
  const stripped = raw.replace(/("(?:[^"\\]|\\.)*")|\/\/.*$/gm, (m, str) => str || "");
  config = JSON.parse(stripped.replace(/,\s*([\]}])/g, "$1"));
} catch (e) {
  console.error("[router] Failed to load klawty.json:", e.message);
}

const TIERS = config.models?.tiers || {
  nano: { slug: "qwen/qwen3.5-flash", costIn: 0.1, costOut: 0.4 },
  workhorse: { slug: "deepseek/deepseek-v3.2", costIn: 0.32, costOut: 0.89 },
  capable: { slug: "google/gemini-3-flash", costIn: 0.5, costOut: 3.0 },
  power: { slug: "moonshotai/kimi-k2.5", costIn: 0.55, costOut: 2.2 },
  premium: { slug: "anthropic/claude-sonnet-4.6", costIn: 3.0, costOut: 15.0 },
};

const DAILY_CAP = config.models?.dailyCap || 15;
const BUDGET = config.models?.budget || "balanced";

// ── Escalation / downgrade patterns ─────────────────────────────────────────

const DEEP_PATTERNS = [
  /\bweekly\s+(report|summary|briefing)\b/i,
  /\bdaily\s+briefing\b/i,
  /\bcode\s+review\b/i,
  /\bsecurity\s+(audit|review)\b/i,
  /\btrend\s+analysis\b/i,
  /\bcomprehensive\b/i,
];

const NANO_PATTERNS = [
  /^(check|verify)\s+(system|service|health|status)\b/i,
  /^(read|fetch|get|list)\s+(emails?|inbox|calendar)\b/i,
  /\bhealth\s+check\b/i,
  /\bstatus\s+check\b/i,
];

// ── Budget → tier mapping ───────────────────────────────────────────────────

const BUDGET_MAP = {
  economy: {
    nano: "nano",
    workhorse: "nano",
    capable: "workhorse",
    power: "workhorse",
    premium: "capable",
  },
  balanced: {
    nano: "nano",
    workhorse: "workhorse",
    capable: "capable",
    power: "power",
    premium: "premium",
  },
  performance: {
    nano: "workhorse",
    workhorse: "capable",
    capable: "power",
    power: "power",
    premium: "premium",
  },
};

const TIER_ORDER = { nano: 1, workhorse: 2, capable: 3, power: 4, premium: 5 };

// ── Model health tracking ───────────────────────────────────────────────────

const modelHealth = {};
const MODEL_RECOVERY_MS = 10 * 60 * 1000;

function markModelDown(tierName, error) {
  modelHealth[tierName] = { down: true, since: Date.now(), error };
  console.log(`[router] Model ${tierName} DOWN: ${error}`);
}

function isModelDown(tierName) {
  const state = modelHealth[tierName];
  if (!state || !state.down) return false;
  if (Date.now() - state.since > MODEL_RECOVERY_MS) {
    modelHealth[tierName] = null;
    console.log(`[router] Model ${tierName} auto-recovered`);
    return false;
  }
  return true;
}

// ── OpenAI client cache ─────────────────────────────────────────────────────

let _client = null;
function getClient() {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY || "",
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://ai-agent-builder.ai",
        "X-Title": "OpenClaw Agent",
      },
    });
  }
  return _client;
}

// ── Core routing function ───────────────────────────────────────────────────

function inferModelTier(agentConfig, task) {
  const baseTier = agentConfig?.modelTier || "workhorse";
  const budgetMap = BUDGET_MAP[BUDGET] || BUDGET_MAP.balanced;
  let resolved = budgetMap[baseTier] || baseTier;

  const text = `${task.title || ""} ${task.description || ""}`.toLowerCase();

  // Escalate cheap agents for deep tasks
  if (TIER_ORDER[resolved] <= 2 && DEEP_PATTERNS.some((p) => p.test(text))) {
    resolved = "power";
  }

  // Downgrade expensive agents for simple tasks (AUTO tier only)
  const tier = (task.tier || "AUTO").toUpperCase();
  if (
    tier === "AUTO" &&
    TIER_ORDER[resolved] >= 3 &&
    NANO_PATTERNS.some((p) => p.test(task.title || ""))
  ) {
    resolved = "workhorse";
  }

  // CONFIRM/BLOCK tasks stay at base — never downgrade
  if (tier === "CONFIRM" || tier === "BLOCK") {
    resolved = budgetMap[baseTier] || baseTier;
  }

  return resolved;
}

function getModelSlug(tierName) {
  const tier = TIERS[tierName];
  return tier ? tier.slug : TIERS.workhorse.slug;
}

function estimateCost(tierName, inputTokens, outputTokens) {
  const tier = TIERS[tierName];
  if (!tier) return 0;
  return (inputTokens / 1_000_000) * tier.costIn + (outputTokens / 1_000_000) * tier.costOut;
}

// ── Fallback chain ──────────────────────────────────────────────────────────

const FALLBACK = {
  premium: ["premium", "power", "capable"],
  power: ["power", "capable", "workhorse"],
  capable: ["capable", "power", "workhorse"],
  workhorse: ["workhorse", "capable", "nano"],
  nano: ["nano", "workhorse"],
};

function getAvailableModel(tierName) {
  const chain = FALLBACK[tierName] || [tierName, "workhorse"];
  for (const t of chain) {
    if (!isModelDown(t)) return t;
  }
  return chain[chain.length - 1]; // Last resort
}

module.exports = {
  inferModelTier,
  getModelSlug,
  getClient,
  estimateCost,
  getAvailableModel,
  markModelDown,
  isModelDown,
  TIERS,
  DAILY_CAP,
  BUDGET,
};
