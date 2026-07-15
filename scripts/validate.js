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
  "LICENSE",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CHANGELOG.md",
  "package.json",
  "skills/bun-loop-skill/SKILL.md",
  "skills/bun-loop-skill/agents/openai.yaml",
  ".claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
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
  "allow_implicit_invocation: true",
]) {
  if (!openaiYaml.includes(expected)) fail(`agents/openai.yaml is missing: ${expected}`);
}

const packageJson = parseJson("package.json");
const plugin = parseJson(".claude-plugin/plugin.json");
const marketplace = parseJson(".claude-plugin/marketplace.json");
if (plugin.version !== packageJson.version) fail("plugin.json version is out of sync");
if (marketplace.plugins?.[0]?.version !== packageJson.version) {
  fail("marketplace.json version is out of sync");
}
if (plugin.skills !== "./skills/") fail("Claude plugin must expose ./skills/");
if (!fs.existsSync(path.join(skillDir, "SKILL.md"))) fail("Canonical skill source is missing");

const readme = read("README.md");
for (const runtime of ["Claude", "Codex", "Cursor", "Copilot", "OpenCode", "Kilo", "Kimi", "Cline"]) {
  if (!readme.includes(runtime)) fail(`README compatibility matrix is missing ${runtime}`);
}
if (!readme.includes("npx github:Lzeutschler/bun-loop-skill")) {
  fail("README is missing the install-from-GitHub command");
}

process.stdout.write("Repository validation passed\n");
