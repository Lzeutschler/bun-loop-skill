"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { renderPrompt, validateTask } = require("../scripts/render_evaluation_prompt");

const cleanTask = {
  problem_statement: "Repair the observable behavior without unrelated changes.",
  repo: "example/project",
  base_commit: "0123456789abcdef",
};

test("renders a prompt from the three allowed task fields", () => {
  assert.equal(
    renderPrompt(cleanTask),
    [
      "Repository: example/project",
      "Base commit: 0123456789abcdef",
      "",
      "Problem statement:",
      "Repair the observable behavior without unrelated changes.",
    ].join("\n"),
  );
});

test("preserves a multiline problem statement verbatim", () => {
  const task = { ...cleanTask, problem_statement: "Line one.\n\n- Line two." };
  assert.equal(
    renderPrompt(task),
    "Repository: example/project\nBase commit: 0123456789abcdef\n\nProblem statement:\nLine one.\n\n- Line two.",
  );
});

test("rejects evaluator metadata even when the three allowed fields exist", () => {
  for (const forbidden of [
    "instance_id",
    "difficulty",
    "hints_text",
    "FAIL_TO_PASS",
    "PASS_TO_PASS",
    "patch",
    "test_patch",
  ]) {
    assert.throws(
      () => validateTask({ ...cleanTask, [forbidden]: "hidden" }),
      /must contain only/,
    );
  }
});
