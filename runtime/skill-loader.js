/** OpenClaw Runtime — Skill Loader */

/**
 * Loads and injects specialized skills into agent prompts based on:
 *   1. Agent's assigned skill set (permanent skills loaded every cycle)
 *   2. Task-context matching (dynamic skills loaded when task keywords match)
 *
 * Skills are stored as SKILL.md files in {skillsDir}/{name}/SKILL.md
 * Each has YAML frontmatter with name, description, and metadata.
 *
 * Configuration is declarative — agent skill mappings and keyword maps
 * are passed in at init() time from the main config (klawty.json).
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ─── State (initialized via init()) ────────────────────────────────────────
let SKILLS_DIR = "";
let AGENT_SKILLS = {}; // { agentId: { core: [...], extended: [...] } }
let KEYWORD_SKILL_MAP = []; // [{ keywords: [...], skills: [...] }]

// ─── Skill Cache ─────────────────────────────────────────────────────────────
const skillCache = new Map();

/**
 * Initialize the skill loader.
 *
 * @param {object} opts
 * @param {string} opts.skillsDir        - Absolute path to the skills directory
 * @param {object} opts.agentSkills      - Agent-to-skill mapping:
 *   { agentId: { core: ['skill-a'], extended: ['skill-b', 'skill-c'] } }
 * @param {Array}  opts.keywordSkillMap  - Keyword-to-skill mapping:
 *   [{ keywords: ['seo', 'ranking'], skills: ['seo-audit'] }]
 */
function init(opts) {
  if (!opts || !opts.skillsDir) {
    throw new Error("skill-loader.init() requires opts.skillsDir");
  }
  SKILLS_DIR = opts.skillsDir;
  AGENT_SKILLS = opts.agentSkills || {};
  KEYWORD_SKILL_MAP = opts.keywordSkillMap || [];
  skillCache.clear();
}

/**
 * Read and cache a skill file.
 * Returns the skill content (everything after YAML frontmatter) or null.
 */
function loadSkillContent(skillName) {
  if (skillCache.has(skillName)) return skillCache.get(skillName);

  const skillPath = path.join(SKILLS_DIR, skillName, "SKILL.md");
  try {
    const raw = fs.readFileSync(skillPath, "utf8");
    // Strip YAML frontmatter (between --- delimiters)
    const stripped = raw.replace(/^---[\s\S]*?---\s*/, "");
    // Limit skill size to 3000 chars to control prompt budget
    const content =
      stripped.length > 3000 ? stripped.slice(0, 3000) + "\n...(truncated)" : stripped;
    skillCache.set(skillName, content);
    return content;
  } catch {
    skillCache.set(skillName, null);
    return null;
  }
}

/**
 * Clear the skill cache (call when skills are updated on disk).
 */
function clearCache() {
  skillCache.clear();
}

/**
 * Determine which extended skills to load based on task title + description.
 */
function matchTaskSkills(agentName, taskTitle, taskDescription) {
  const config = AGENT_SKILLS[agentName];
  if (!config) return [];

  const text = `${taskTitle || ""} ${taskDescription || ""}`.toLowerCase();
  const matched = new Set();

  for (const mapping of KEYWORD_SKILL_MAP) {
    if (mapping.keywords.some((kw) => text.includes(kw))) {
      for (const skill of mapping.skills) {
        // Only load if it's in the agent's extended set
        if (config.extended.includes(skill)) {
          matched.add(skill);
        }
      }
    }
  }

  return [...matched];
}

/**
 * Build the skills block for injection into an agent's system prompt.
 *
 * Returns a formatted string with core + task-matched extended skills.
 * Respects a total budget of ~16000 chars for all skills combined.
 *
 * @param {string} agentName - Agent identifier
 * @param {object} task - Task object with title and description
 * @param {object} [budgetOpts] - Optional budget overrides
 * @param {number} [budgetOpts.coreBudget=10000] - Max chars for core skills
 * @param {number} [budgetOpts.extendedBudget=6000] - Max chars for extended skills
 * @returns {string} Formatted skills block or empty string
 */
function buildSkillsBlock(agentName, task, budgetOpts) {
  const config = AGENT_SKILLS[agentName];
  if (!config) return "";

  const CORE_BUDGET = (budgetOpts && budgetOpts.coreBudget) || 10000;
  const EXTENDED_BUDGET = (budgetOpts && budgetOpts.extendedBudget) || 6000;
  let coreChars = 0;
  let extChars = 0;
  const sections = [];

  // 1. Load core skills (always loaded -- never dropped)
  for (const skillName of config.core) {
    const content = loadSkillContent(skillName);
    if (content && coreChars + content.length <= CORE_BUDGET) {
      sections.push(`### [SKILL: ${skillName}]\n${content}`);
      coreChars += content.length;
    }
  }

  // 2. Load task-matched extended skills
  const dynamicSkills = matchTaskSkills(agentName, task.title, task.description);
  for (const skillName of dynamicSkills) {
    if (config.core.includes(skillName)) continue; // Already loaded
    const content = loadSkillContent(skillName);
    if (content && extChars + content.length <= EXTENDED_BUDGET) {
      sections.push(`### [SKILL: ${skillName}] (task-matched)\n${content}`);
      extChars += content.length;
    }
  }

  if (sections.length === 0) return "";

  return `
## SPECIALIZED SKILLS
The following skills provide domain expertise for your current task. Apply their guidance when relevant.

${sections.join("\n\n---\n\n")}
`;
}

/**
 * Get the full list of skills assigned to an agent (core + extended).
 */
function getAgentSkills(agentName) {
  return AGENT_SKILLS[agentName] || { core: [], extended: [] };
}

/**
 * List all available skills from the skills directory.
 */
function listAllSkills() {
  try {
    return fs
      .readdirSync(SKILLS_DIR)
      .filter((d) => fs.existsSync(path.join(SKILLS_DIR, d, "SKILL.md")));
  } catch {
    return [];
  }
}

module.exports = {
  init,
  buildSkillsBlock,
  matchTaskSkills,
  getAgentSkills,
  loadSkillContent,
  listAllSkills,
  clearCache,
};
