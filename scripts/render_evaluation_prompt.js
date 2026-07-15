#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const ALLOWED_FIELDS = Object.freeze(["base_commit", "problem_statement", "repo"]);

function validateTask(task) {
  if (!task || typeof task !== "object" || Array.isArray(task)) {
    throw new Error("Evaluation task must be an object");
  }
  const keys = Object.keys(task).sort();
  if (keys.join(",") !== ALLOWED_FIELDS.join(",")) {
    throw new Error(
      `Evaluation task must contain only ${ALLOWED_FIELDS.join(", ")}; found ${keys.join(", ")}`,
    );
  }
  for (const key of ALLOWED_FIELDS) {
    if (typeof task[key] !== "string" || task[key].length === 0) {
      throw new Error(`Evaluation task field ${key} must be a non-empty string`);
    }
  }
}

function renderPrompt(task) {
  validateTask(task);
  return [
    `Repository: ${task.repo}`,
    `Base commit: ${task.base_commit}`,
    "",
    "Problem statement:",
    task.problem_statement,
  ].join("\n");
}

function main(argv) {
  if (argv.length !== 2) {
    throw new Error("Usage: render_evaluation_prompt.js <manifest.json> <zero-based-index>");
  }
  const tasks = JSON.parse(fs.readFileSync(argv[0], "utf8"));
  if (!Array.isArray(tasks)) throw new Error("Evaluation manifest must be an array");
  const index = Number(argv[1]);
  if (!Number.isInteger(index) || index < 0 || index >= tasks.length) {
    throw new Error("Evaluation task index is out of range");
  }
  process.stdout.write(`${renderPrompt(tasks[index])}\n`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`render-evaluation-prompt: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { ALLOWED_FIELDS, renderPrompt, validateTask };
