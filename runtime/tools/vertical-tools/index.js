"use strict";

const fs = require("fs");
const path = require("path");

const VERTICAL_TOOL_FILES = {
  restaurants: "./restaurants.js",
  "real-estate": "./real-estate.js",
  construction: "./construction.js",
  resellers: "./resellers.js",
  accounting: "./accounting.js",
  "law-firms": "./law-firms.js",
};

function loadVerticalTools(verticalId) {
  const toolFile = VERTICAL_TOOL_FILES[verticalId];
  if (!toolFile) return {};
  const fullPath = path.join(__dirname, toolFile);
  if (!fs.existsSync(fullPath)) return {};
  return require(fullPath);
}

module.exports = { loadVerticalTools };
