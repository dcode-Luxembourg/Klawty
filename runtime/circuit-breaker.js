/**
 * OpenClaw Runtime — Circuit Breaker
 * Single source of truth for agent health.
 * Exponential backoff: 1h → 2h → 4h → 8h max.
 */

"use strict";

const THRESHOLD = 5;
const BASE_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const MAX_COOLDOWN_MS = 8 * 60 * 60 * 1000; // 8 hours

const agents = {}; // agentName → { failures, status, pausedAt, tripCount }

function getAgent(name) {
  if (!agents[name]) {
    agents[name] = { failures: 0, status: "active", pausedAt: null, tripCount: 0 };
  }
  return agents[name];
}

function recordSuccess(name) {
  const agent = getAgent(name);
  agent.failures = 0;
  agent.tripCount = 0;
  if (agent.status === "paused") {
    agent.status = "active";
    agent.pausedAt = null;
  }
}

function recordFailure(name, error) {
  const agent = getAgent(name);
  agent.failures++;

  if (agent.failures >= THRESHOLD) {
    agent.status = "paused";
    agent.pausedAt = Date.now();
    agent.tripCount++;
    const cooldown = Math.min(BASE_COOLDOWN_MS * Math.pow(2, agent.tripCount - 1), MAX_COOLDOWN_MS);
    console.log(
      `[circuit-breaker] ${name} PAUSED after ${THRESHOLD} failures (trip #${agent.tripCount}, cooldown: ${Math.round(cooldown / 60000)}min). Error: ${error}`,
    );
  }
}

function isActive(name) {
  const agent = getAgent(name);
  if (agent.status !== "paused") return true;

  // Check auto-reset
  const cooldown = Math.min(
    BASE_COOLDOWN_MS * Math.pow(2, (agent.tripCount || 1) - 1),
    MAX_COOLDOWN_MS,
  );
  if (Date.now() - agent.pausedAt >= cooldown) {
    agent.status = "active";
    agent.failures = 0;
    agent.pausedAt = null;
    console.log(`[circuit-breaker] ${name} auto-reset after cooldown`);
    return true;
  }
  return false;
}

function reset(name) {
  const agent = getAgent(name);
  agent.status = "active";
  agent.failures = 0;
  agent.pausedAt = null;
}

function getStatus() {
  return { ...agents };
}

module.exports = { recordSuccess, recordFailure, isActive, reset, getStatus };
