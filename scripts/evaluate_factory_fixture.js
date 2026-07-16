#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { RUST_IMAGE } = require("./generate_factory_fixture");

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
}

function changedPaths(repo) {
  const tracked = run("git", ["diff", "--name-only", "HEAD"], { cwd: repo });
  const untracked = run("git", ["ls-files", "--others", "--exclude-standard"], { cwd: repo });
  if (tracked.status !== 0 || untracked.status !== 0) {
    throw new Error(`cannot inspect candidate paths: ${tracked.stderr || untracked.stderr}`);
  }
  return [...new Set(
    `${tracked.stdout}\n${untracked.stdout}`.split(/\r?\n/).filter(Boolean),
  )].sort();
}

function buildCandidate(repo, image) {
  return run("docker", [
    "run", "--rm", "--network", "none",
    "-v", `${repo}:/work`, "-w", "/work/port",
    image,
    "cargo", "build", "--offline", "--locked", "--release",
    "--target-dir", "/work/port/.factory-target",
  ]);
}

function executeCase(repo, image, testCase) {
  const result = run("docker", [
    "run", "--rm", "--network", "none", "-v", `${repo}:/work`,
    image, "/work/port/.factory-target/release/factory-port",
    testCase.op, ...testCase.args,
  ]);
  if (result.status !== 0) {
    return { ok: false, execution_error: (result.stderr || result.error?.message || "execution failed").trim() };
  }
  try {
    return { ok: true, value: JSON.parse(result.stdout) };
  } catch (error) {
    return { ok: false, execution_error: `invalid JSON: ${error.message}`, stdout: result.stdout };
  }
}

function evaluateCases(repo, image, cases, expected) {
  const records = cases.map((testCase, index) => {
    const execution = executeCase(repo, image, testCase);
    const passed = execution.ok
      && JSON.stringify(execution.value) === JSON.stringify(expected[index]);
    return {
      id: `${testCase.op}:${index + 1}`,
      operation: testCase.op,
      passed,
      expected: expected[index],
      ...(execution.ok ? { actual: execution.value } : execution),
    };
  });
  return {
    passed: records.filter((record) => record.passed).length,
    total: records.length,
    records,
  };
}

function evaluateFactoryFixture(repo, evaluator) {
  const metadata = JSON.parse(fs.readFileSync(path.join(evaluator, "metadata.json")));
  if (metadata.rust_image !== RUST_IMAGE) {
    throw new Error("fixture image does not match the evaluator pin");
  }
  const protectedHashes = JSON.parse(fs.readFileSync(path.join(evaluator, "protected.json")));
  const protectedFailures = Object.entries(protectedHashes)
    .filter(([relative, expected]) => {
      const file = path.join(repo, relative);
      return !fs.existsSync(file) || sha256(file) !== expected;
    })
    .map(([relative]) => relative);
  const paths = changedPaths(repo);
  const disallowedPaths = paths.filter((relative) => !relative.startsWith("port/src/"));
  const build = buildCandidate(repo, metadata.rust_image);

  let visible = { passed: 0, total: 0, records: [] };
  let hidden = { passed: 0, total: 0, records: [] };
  if (build.status === 0) {
    const visibleCases = JSON.parse(fs.readFileSync(path.join(evaluator, "visible.json")));
    const visibleGolden = JSON.parse(fs.readFileSync(path.join(evaluator, "visible-golden.json")));
    const hiddenCases = JSON.parse(fs.readFileSync(path.join(evaluator, "hidden.json")));
    const hiddenGolden = JSON.parse(fs.readFileSync(path.join(evaluator, "hidden-golden.json")));
    visible = evaluateCases(repo, metadata.rust_image, visibleCases, visibleGolden);
    hidden = evaluateCases(repo, metadata.rust_image, hiddenCases, hiddenGolden);
  }

  const backlogResolved = build.status === 0
    && protectedFailures.length === 0
    && disallowedPaths.length === 0
    && visible.passed === visible.total
    && hidden.passed === hidden.total;
  return {
    schema_version: 1,
    seed: metadata.seed,
    rust_image: metadata.rust_image,
    backlog_resolved: backlogResolved,
    build: {
      passed: build.status === 0,
      status: build.status,
      stdout: build.stdout,
      stderr: build.stderr,
    },
    candidate_paths: paths,
    disallowed_paths: disallowedPaths,
    protected_failures: protectedFailures,
    visible,
    hidden,
  };
}

function main(argv) {
  if (argv.length !== 3) {
    throw new Error("Usage: evaluate_factory_fixture.js <candidate-repo> <evaluator-dir> <report.json>");
  }
  const [repo, evaluator, output] = argv.map((value) => path.resolve(value));
  const report = evaluateFactoryFixture(repo, evaluator);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(
    `${report.seed}: build=${report.build.passed} visible=${report.visible.passed}/${report.visible.total} hidden=${report.hidden.passed}/${report.hidden.total} resolved=${report.backlog_resolved}\n`,
  );
  if (!report.backlog_resolved) process.exitCode = 1;
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`evaluate-factory-fixture: ${error.message}\n`); process.exitCode = 2; }
}

module.exports = { changedPaths, evaluateFactoryFixture };
