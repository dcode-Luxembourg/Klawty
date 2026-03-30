/**
 * OpenClaw Runtime — Tool Runner
 * LLM-agnostic tool-calling loop.
 * Supports OpenAI-compatible APIs (via OpenRouter).
 */

"use strict";

const router = require("./router");
const taskDb = require("./task-db");

const DEFAULT_MAX_ROUNDS = 15;
const AI_TIMEOUT_MS = 30000;

// ── Tool tracking ───────────────────────────────────────────────────────────

const _toolsUsed = new Map(); // taskId → Set<toolName>

function trackTool(taskId, toolName) {
  if (!_toolsUsed.has(taskId)) _toolsUsed.set(taskId, new Set());
  _toolsUsed.get(taskId).add(toolName);
}

function getToolsUsed(taskId) {
  return _toolsUsed.get(taskId) || new Set();
}

function clearTracking(taskId) {
  _toolsUsed.delete(taskId);
}

// ── Proposal handling for PROPOSE/CONFIRM tools ─────────────────────────────

function handleProposalTool(agentName, toolName, params, taskId) {
  const proposal = taskDb.createProposal({
    agent: agentName,
    action: toolName,
    tier: "PROPOSE",
    details: JSON.stringify(params),
  });
  trackTool(taskId, `__proposal__${toolName}`);
  return `__PROPOSAL_PENDING__:${proposal?.id || "unknown"}:${toolName}`;
}

// ── Main execution function ─────────────────────────────────────────────────

async function execute({
  agentName,
  taskId,
  systemPrompt,
  userMessage,
  toolDefs, // Array of { type: 'function', function: { name, description, parameters }, riskLevel, isWriteTool }
  toolExecutor, // async (toolName, params) => result
  modelTier, // e.g. 'power'
  maxRounds,
}) {
  const rounds = maxRounds || DEFAULT_MAX_ROUNDS;
  const tier = router.getAvailableModel(modelTier || "workhorse");
  const slug = router.getModelSlug(tier);
  const client = router.getClient();

  // Build OpenAI-format tool defs (strip our custom fields)
  const oaiTools = (toolDefs || []).map((t) => ({
    type: "function",
    function: t.function,
  }));

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  let result = "";
  let iterations = 0;
  let toolsExecuted = 0;

  while (iterations < rounds) {
    iterations++;

    let response;
    try {
      response = await client.chat.completions.create({
        model: slug,
        max_tokens: 2048,
        messages,
        ...(oaiTools.length > 0 ? { tools: oaiTools, tool_choice: "auto" } : {}),
      });
    } catch (err) {
      // Mark model as down, try fallback
      router.markModelDown(tier, err.message);
      const fallback = router.getAvailableModel(modelTier || "workhorse");
      if (fallback === tier) throw err; // No fallback available

      console.log(`[tool-runner] Falling back from ${tier} to ${fallback}`);
      const fallbackSlug = router.getModelSlug(fallback);
      response = await client.chat.completions.create({
        model: fallbackSlug,
        max_tokens: 2048,
        messages,
        ...(oaiTools.length > 0 ? { tools: oaiTools, tool_choice: "auto" } : {}),
      });
    }

    // Track cost
    if (response.usage) {
      const cost = router.estimateCost(
        tier,
        response.usage.prompt_tokens || 0,
        response.usage.completion_tokens || 0,
      );
      taskDb.recordLLMCost({
        agent: agentName,
        modelId: tier,
        taskId,
        inputTokens: response.usage.prompt_tokens || 0,
        outputTokens: response.usage.completion_tokens || 0,
        costUSD: cost,
      });
    }

    const msg = response.choices[0].message;
    messages.push(msg);

    // No tool calls — final response
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      result = msg.content || "";
      break;
    }

    // Execute tool calls
    for (const call of msg.tool_calls) {
      const toolName = call.function.name;
      let params;
      try {
        params = JSON.parse(call.function.arguments || "{}");
      } catch {
        params = {};
      }

      // Check risk level
      const toolDef = (toolDefs || []).find((t) => t.function.name === toolName);
      const riskLevel = toolDef?.riskLevel || "auto";

      let toolResult;

      if (riskLevel === "propose" || riskLevel === "confirm") {
        // Create proposal instead of executing
        return handleProposalTool(agentName, toolName, params, taskId);
      }

      try {
        toolResult = await toolExecutor(toolName, params);
        toolsExecuted++;
        trackTool(taskId, toolName);
      } catch (e) {
        toolResult = { error: e.message };
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult),
      });
    }
  }

  if (!result && toolsExecuted > 0) {
    result = `Task completed (${toolsExecuted} tool calls across ${iterations} rounds).`;
  } else if (!result) {
    throw new Error("INCOMPLETE: Max rounds reached without producing a result.");
  }

  return result;
}

module.exports = { execute, trackTool, getToolsUsed, clearTracking };
