"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const result = require("../evaluation/blind-2026-07.json");
const artifactRoot = path.resolve(__dirname, "..", "evaluation", "blind-2026-07");

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

test("blind evaluation retains five unique paired tasks and the three-field boundary", () => {
  assert.deepEqual(result.prompt_fields, ["problem_statement", "repo", "base_commit"]);
  assert.equal(result.paired_tasks, 5);
  assert.equal(result.tasks.length, 5);
  assert.equal(new Set(result.tasks.map((task) => task.instance_id)).size, 5);
  assert.equal(new Set(result.tasks.map((task) => task.repo)).size, 5);
});

test("archived treatment wrappers are fixed and contain no evaluator fields", () => {
  const protocol = JSON.parse(fs.readFileSync(path.join(artifactRoot, "protocol.json")));
  assert.deepEqual(protocol.task_prompt_fields, result.prompt_fields);
  assert.match(protocol.bun_loop_prefix, /\$bun-loop-skill/);
  assert.match(protocol.single_agent_prefix, /one agent context/);
  for (const prefix of [protocol.bun_loop_prefix, protocol.single_agent_prefix]) {
    for (const forbidden of ["instance_id", "FAIL_TO_PASS", "PASS_TO_PASS", "test_patch", "hints_text"]) {
      assert.equal(prefix.includes(forbidden), false, forbidden);
    }
  }
});

test("blind evaluation aggregates match the per-task official and cost records", () => {
  for (const variant of ["bun_loop", "single_agent"]) {
    const expected = {
      resolved: 0,
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 0,
      reasoning_tokens: 0,
      contexts: 0,
    };
    for (const task of result.tasks) {
      const record = task[variant];
      expected.resolved += Number(record.resolved);
      expected.input_tokens += record.input_tokens;
      expected.cached_input_tokens += record.cached_input_tokens;
      expected.output_tokens += record.output_tokens;
      expected.reasoning_tokens += record.reasoning_tokens;
      expected.contexts += record.contexts;
      assert.equal(
        record.resolved,
        record.fail_to_pass.passed === record.fail_to_pass.total &&
          record.pass_to_pass.passed === record.pass_to_pass.total,
      );
    }
    for (const [metric, value] of Object.entries(expected)) {
      assert.equal(result.aggregate[variant][metric], value, `${variant}.${metric}`);
    }
  }
  assert.equal(
    result.aggregate.bun_loop.fix_rounds,
    result.tasks.reduce((sum, task) => sum + task.bun_loop.fix_rounds, 0),
  );
});

test("archived official reports and usage records produce the study summary", () => {
  for (const [summaryKey, artifactKey] of [
    ["bun_loop", "bun"],
    ["single_agent", "plain"],
  ]) {
    const aggregate = JSON.parse(
      fs.readFileSync(path.join(artifactRoot, "reports", artifactKey, "aggregate.json")),
    );
    assert.equal(aggregate.submitted_instances, 5);
    assert.equal(aggregate.completed_instances, 5);
    assert.equal(aggregate.empty_patch_instances, 0);
    assert.equal(aggregate.error_instances, 0);
    assert.equal(aggregate.resolved_instances, result.aggregate[summaryKey].resolved);

    for (const [index, task] of result.tasks.entries()) {
      const report = JSON.parse(
        fs.readFileSync(
          path.join(artifactRoot, "reports", artifactKey, `${task.instance_id}.json`),
        ),
      )[task.instance_id];
      const summary = task[summaryKey];
      assert.equal(report.patch_successfully_applied, true);
      assert.equal(report.resolved, summary.resolved);
      assert.equal(report.tests_status.FAIL_TO_PASS.success.length, summary.fail_to_pass.passed);
      assert.equal(
        report.tests_status.FAIL_TO_PASS.success.length +
          report.tests_status.FAIL_TO_PASS.failure.length,
        summary.fail_to_pass.total,
      );
      assert.equal(report.tests_status.PASS_TO_PASS.success.length, summary.pass_to_pass.passed);
      assert.equal(
        report.tests_status.PASS_TO_PASS.success.length +
          report.tests_status.PASS_TO_PASS.failure.length,
        summary.pass_to_pass.total,
      );

      const usage = JSON.parse(
        fs.readFileSync(
          path.join(artifactRoot, "patches", `case-${String(index + 1).padStart(2, "0")}`, `${artifactKey}-usage.json`),
        ),
      );
      assert.equal(usage.input_tokens, summary.input_tokens);
      assert.equal(usage.cached_input_tokens, summary.cached_input_tokens);
      assert.equal(usage.output_tokens, summary.output_tokens);
      assert.equal(usage.reasoning_output_tokens ?? usage.reasoning_tokens, summary.reasoning_tokens);
      assert.equal(usage.agent_contexts ?? usage.contexts, summary.contexts);
    }
  }
});

test("seal, clean manifest, predictions, and archived patches agree byte for byte", () => {
  const manifestPath = path.join(artifactRoot, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  const seal = JSON.parse(fs.readFileSync(path.join(artifactRoot, "seal.json")));
  assert.equal(seal.dataset, result.dataset);
  assert.equal(seal.dataset_revision, result.dataset_revision);
  assert.equal(seal.dataset_fingerprint, result.dataset_fingerprint);
  assert.equal(sha256(manifestPath), seal.manifest_sha256);
  assert.equal(sha256(manifestPath), result.manifest.sha256);
  assert.equal(manifest.length, result.tasks.length);

  for (const [index, task] of result.tasks.entries()) {
    assert.equal(manifest[index].repo, task.repo);
    assert.equal(manifest[index].base_commit, task.base_commit);
  }

  for (const variant of ["bun", "plain"]) {
    const predictions = fs
      .readFileSync(path.join(artifactRoot, "predictions", `${variant}.jsonl`), "utf8")
      .trim()
      .split("\n")
      .map(JSON.parse);
    assert.equal(predictions.length, result.tasks.length);
    predictions.forEach((prediction, index) => {
      const relative = `case-${String(index + 1).padStart(2, "0")}/${variant}.patch`;
      const patch = path.join(artifactRoot, "patches", relative);
      assert.equal(sha256(patch), seal.patches[relative]);
      assert.equal(prediction.instance_id, result.tasks[index].instance_id);
      assert.equal(prediction.model_patch, fs.readFileSync(patch, "utf8"));
    });
  }
});
