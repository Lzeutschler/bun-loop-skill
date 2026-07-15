#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const skillDir = path.join(root, "skills", "bun-loop-skill");

function fail(message) {
  throw new Error(message);
}

function read(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) fail(`Missing required file: ${relativePath}`);
  return fs.readFileSync(filePath, "utf8");
}

function parseJson(relativePath) {
  try {
    return JSON.parse(read(relativePath));
  } catch (error) {
    fail(`Invalid JSON in ${relativePath}: ${error.message}`);
  }
}

const requiredFiles = [
  "README.md",
  "EVALUATION.md",
  "LICENSE",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CHANGELOG.md",
  "package.json",
  "skills/bun-loop-skill/SKILL.md",
  "skills/bun-loop-skill/agents/openai.yaml",
  ".claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
  "scripts/select_evaluation_tasks.py",
  "scripts/render_evaluation_prompt.js",
  "scripts/build_evaluation_predictions.py",
  "scripts/seal_evaluation.py",
  "evaluation/blind-2026-07.json",
  "evaluation/blind-2026-07/manifest.json",
  "evaluation/blind-2026-07/protocol.json",
  "evaluation/blind-2026-07/seal.json",
  "evaluation/blind-2026-07/reports/bun/aggregate.json",
  "evaluation/blind-2026-07/reports/plain/aggregate.json",
];
requiredFiles.forEach(read);

const skill = read("skills/bun-loop-skill/SKILL.md");
const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/);
if (!frontmatter) fail("SKILL.md has invalid YAML frontmatter boundaries");
const keys = frontmatter[1]
  .split(/\r?\n/)
  .filter((line) => line.length > 0 && !/^\s/.test(line))
  .map((line) => line.match(/^([a-z0-9-]+):/)?.[1])
  .filter(Boolean);
if (keys.join(",") !== "name,description") {
  fail(`SKILL.md frontmatter must contain only name and description; found ${keys.join(", ")}`);
}
if (!/^name: bun-loop-skill$/m.test(frontmatter[1])) {
  fail("SKILL.md name must match its bun-loop-skill directory");
}
if (skill.split(/\r?\n/).length >= 500) fail("SKILL.md must stay below 500 lines");
if (/\[TODO|TODO:|PLACEHOLDER|Structuring This Skill|Resources \(optional\)/.test(skill)) {
  fail("SKILL.md still contains scaffold placeholders");
}

const openaiYaml = read("skills/bun-loop-skill/agents/openai.yaml");
for (const expected of [
  'display_name: "Bun Loop"',
  'short_description: "Run adversarial multi-agent engineering loops"',
  "$bun-loop-skill",
  "allow_implicit_invocation: false",
]) {
  if (!openaiYaml.includes(expected)) fail(`agents/openai.yaml is missing: ${expected}`);
}

const packageJson = parseJson("package.json");
const evaluation = parseJson("evaluation/blind-2026-07.json");
const plugin = parseJson(".claude-plugin/plugin.json");
const marketplace = parseJson(".claude-plugin/marketplace.json");
if (plugin.version !== packageJson.version) fail("plugin.json version is out of sync");
if (marketplace.plugins?.[0]?.version !== packageJson.version) {
  fail("marketplace.json version is out of sync");
}
if (plugin.skills !== "./skills/") fail("Claude plugin must expose ./skills/");
if (!fs.existsSync(path.join(skillDir, "SKILL.md"))) fail("Canonical skill source is missing");
if (evaluation.prompt_fields?.join(",") !== "problem_statement,repo,base_commit") {
  fail("Blind evaluation prompt fields are not the declared three-field boundary");
}
if (evaluation.paired_tasks !== 5 || evaluation.tasks?.length !== 5) {
  fail("Blind evaluation must retain all five paired tasks");
}
if (evaluation.aggregate?.bun_loop?.resolved !== 0 || evaluation.aggregate?.single_agent?.resolved !== 1) {
  fail("Blind evaluation aggregate is inconsistent with the official result");
}

const readme = read("README.md");
for (const runtime of ["Claude", "Codex", "Cursor", "Copilot", "OpenCode", "Kilo", "Kimi", "Cline"]) {
  if (!readme.includes(runtime)) fail(`README compatibility matrix is missing ${runtime}`);
}
if (!readme.includes("npx github:Lzeutschler/bun-loop-skill")) {
  fail("README is missing the install-from-GitHub command");
}
if (!readme.includes(".bun-loop-install.json")) {
  fail("README is missing the managed-install marker behavior");
}
if (!readme.includes("Full-loop capability status")) {
  fail("README must separate installer mappings from runtime capability evidence");
}
if (!readme.includes("resolved 0/5 tasks versus 1/5")) {
  fail("README must disclose the current blind evaluation result");
}

const promptRenderer = read("scripts/render_evaluation_prompt.js");
for (const allowed of ["problem_statement", "repo", "base_commit"]) {
  if (!promptRenderer.includes(allowed)) {
    fail(`Evaluation prompt renderer is missing allowed field: ${allowed}`);
  }
}

process.stdout.write("Repository validation passed\n");
