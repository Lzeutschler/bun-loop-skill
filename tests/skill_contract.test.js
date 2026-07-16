"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const skill = fs.readFileSync(
  path.join(root, "skills", "bun-loop-skill", "SKILL.md"),
  "utf8",
);
const rubrics = fs.readFileSync(
  path.join(root, "skills", "bun-loop-skill", "references", "review-rubrics.md"),
  "utf8",
);
const routingSmoke = JSON.parse(fs.readFileSync(
  path.join(root, "evaluation", "routing-2026-07", "record.json"),
  "utf8",
));
const patchSmoke = JSON.parse(fs.readFileSync(
  path.join(root, "evaluation", "patch-loop-2026-07", "trace.json"),
  "utf8",
));

test("routes explicit factory, patch, and plain invocations with four factory gates", () => {
  assert.match(skill, /\$bun-loop-skill factory/);
  assert.match(skill, /\$bun-loop-skill patch/);
  assert.match(skill, /multiple structurally similar work items/);
  assert.match(skill, /repeatable executable oracle/);
  assert.match(skill, /improve remaining items/);
  assert.match(skill, /no more than one\s+quarter of the total engineering effort/);
  assert.match(skill, /Otherwise choose Patch Mode/);
  assert.match(skill, /trivial edit or a\s+read-only question/);
  assert.match(skill, /explicitly requests Factory Mode[\s\S]*mark the run `blocked`/);
});

test("keeps Factory Mode oracle-driven and non-recursive", () => {
  assert.match(skill, /Run a three-item trial/);
  assert.match(skill, /up to four concurrent writer lanes/);
  assert.match(skill, /same failure class occurs in at least two\s+items/);
  assert.match(skill, /leave this installed skill unchanged/);
  assert.match(skill, /Do not recursively launch another reviewer pair/);
  assert.match(skill, /Do not require an additional global pair of `CLEAN` reviews/);
  assert.match(skill, /Review cannot substitute for an unavailable or failing full oracle/);
});

test("bounds Patch Mode without Factory ceremony", () => {
  assert.match(skill, /standard budget of four fresh role\s+contexts/);
  assert.match(skill, /at or below seven/);
  assert.match(skill, /Do not create Factory artifacts, a\s+bulk queue, a trial, or a global final review/);
});

test("loads specialized rubrics conditionally and retains false-progress gates", () => {
  assert.match(skill, /Read \[references\/review-rubrics\.md\]/);
  assert.match(skill, /Do not load every rubric by default/);
  for (const heading of [
    "State transitions and invariants",
    "Exact structural semantics",
    "Parsers and compatibility boundaries",
    "Async, concurrency, and lifetimes",
    "Ports and migrations",
  ]) {
    assert.match(rubrics, new RegExp(heading));
  }
  assert.match(skill, /stubs, placeholder returns, new unresolved TODOs/);
  assert.match(skill, /paragraph-length comment/);
});

test("archives a fresh-context smoke test for every routing branch", () => {
  assert.match(
    routingSmoke.qualification,
    /smoke test, not a deterministic runtime conformance test/,
  );
  assert.equal(routingSmoke.records.length, 7);
  assert.deepEqual(
    Object.fromEntries(routingSmoke.records.map((record) => [record.id, record.actual])),
    {
      A: "FACTORY",
      B: "PATCH",
      C: "NOT_SUITABLE",
      D: "NOT_SUITABLE",
      E: "BLOCKED_FACTORY",
      F: "PATCH",
      G: "PATCH",
    },
  );
  for (const record of routingSmoke.records) {
    assert.equal(record.actual, record.expected);
    assert.ok(record.scenario.length > 20);
    assert.ok(record.evidence.length > 10);
  }
});

test("archives a four-context Patch execution without unjustified re-entry", () => {
  assert.equal(patchSmoke.mode, "PATCH");
  assert.equal(patchSmoke.contexts, 4);
  assert.deepEqual(patchSmoke.roles, { implementer: 1, reviewers: 2, fixer: 1 });
  assert.equal(patchSmoke.reviewers_concurrent, true);
  assert.equal(patchSmoke.reviewers_read_only, true);
  assert.equal(patchSmoke.accepted_findings, 1);
  assert.equal(patchSmoke.reentry, false);
  assert.equal(patchSmoke.fixer_materially_expanded_boundary, false);
  assert.deepEqual(patchSmoke.oracle, {
    command: "npm test",
    passed: 4,
    failed: 0,
    skipped: 0,
    independently_rerun: true,
  });
  assert.deepEqual(patchSmoke.modified_paths, ["src/parse-list.js"]);
});
