"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const {
  SEEDS,
  casesFor,
  generateAll,
  operationNames,
  referenceResult,
} = require("../scripts/generate_factory_fixture");
const { createSeal, verifySeal } = require("../scripts/seal_factory_evaluation");
const { prepareFactoryEvaluation } = require("../scripts/prepare_factory_evaluation");
const { summarizeFactoryEvaluation } = require("../scripts/summarize_factory_evaluation");

function tempFixture(context, prefix) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test("generates three deterministic history-free fixtures", (context) => {
  const first = tempFixture(context, "bun-loop-factory-a-");
  const second = tempFixture(context, "bun-loop-factory-b-");
  assert.deepEqual(generateAll(first), generateAll(second));
  const manifest = JSON.parse(fs.readFileSync(path.join(first, "manifest.json")));
  assert.equal(manifest.length, 3);
  assert.equal(new Set(manifest.map((task) => task.base_commit)).size, 3);
  for (const task of manifest) {
    assert.deepEqual(Object.keys(task).sort(), ["base_commit", "problem_statement", "repo"]);
  }
});

test("keeps hidden cases and evaluator metadata outside candidate repositories", (context) => {
  const directory = tempFixture(context, "bun-loop-factory-hidden-");
  generateAll(directory);
  for (const seed of SEEDS) {
    const repo = path.join(directory, seed.id, "repo");
    assert.equal(fs.existsSync(path.join(repo, "hidden.json")), false);
    assert.equal(fs.existsSync(path.join(repo, "evaluator")), false);
    assert.equal(fs.readdirSync(path.join(repo, "port", "src", "ops")).length, 9);
    assert.equal(JSON.parse(fs.readFileSync(path.join(repo, "cases", "visible.json"))).length, 8);
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, seed.id, "evaluator", "hidden.json"))).length, 16);
  }
});

test("reference goldens cover four recurring error classes across eight modules", () => {
  for (const seed of SEEDS) {
    const names = operationNames(seed);
    const { visible, hidden } = casesFor(seed);
    assert.equal(new Set(visible.map((item) => item.op)).size, 8);
    assert.equal(hidden.length, 16);
    for (const item of [...visible, ...hidden]) {
      assert.doesNotThrow(() => referenceResult(names, item));
    }
  }
});

test("reference CLI reproduces every visible golden", (context) => {
  const directory = tempFixture(context, "bun-loop-factory-reference-");
  generateAll(directory);
  for (const seed of SEEDS) {
    const repo = path.join(directory, seed.id, "repo");
    const cases = JSON.parse(fs.readFileSync(path.join(repo, "cases", "visible.json")));
    const goldens = JSON.parse(fs.readFileSync(path.join(repo, "cases", "visible-golden.json")));
    cases.forEach((item, index) => {
      const run = spawnSync(
        process.execPath,
        [path.join(repo, "reference", "cli.mjs"), item.op, ...item.args],
        { encoding: "utf8" },
      );
      assert.equal(run.status, 0, run.stderr);
      assert.deepEqual(JSON.parse(run.stdout), goldens[index]);
    });
  }
});

test("factory seal requires all nine patch, usage, and trace triplets", (context) => {
  const directory = tempFixture(context, "bun-loop-factory-seal-");
  const fixtureRoot = path.join(directory, "fixtures");
  const manifest = generateAll(fixtureRoot);
  const manifestFile = path.join(fixtureRoot, "manifest.json");
  const candidates = path.join(directory, "candidates");
  const protocol = path.resolve(__dirname, "..", "evaluation", "factory-fixture-v1", "protocol.json");
  for (const task of manifest) {
    const seed = task.repo.split("/").at(-1);
    fs.mkdirSync(path.join(candidates, seed), { recursive: true });
    for (const variant of ["factory", "single", "multi"]) {
      fs.writeFileSync(path.join(candidates, seed, `${variant}.patch`), `patch-${seed}-${variant}\n`);
      fs.writeFileSync(path.join(candidates, seed, `${variant}.usage.json`), "{}\n");
      fs.writeFileSync(path.join(candidates, seed, `${variant}.trace.json`), "{}\n");
    }
  }
  const seal = createSeal(manifestFile, candidates, protocol);
  assert.equal(Object.keys(seal.artifacts).length, 27);
  const sealFile = path.join(directory, "seal.json");
  fs.writeFileSync(sealFile, `${JSON.stringify(seal, null, 2)}\n`);
  assert.doesNotThrow(() => verifySeal(sealFile, manifestFile, candidates, protocol));
  fs.appendFileSync(path.join(candidates, "amber", "factory.patch"), "mutation\n");
  assert.throws(
    () => verifySeal(sealFile, manifestFile, candidates, protocol),
    /changed after sealing/,
  );
});

test("prepares nine separate candidate roots from only the three-field tasks", (context) => {
  const directory = tempFixture(context, "bun-loop-factory-prepare-");
  const manifest = prepareFactoryEvaluation(path.join(directory, "study"));
  assert.equal(manifest.length, 3);
  for (const seed of SEEDS) {
    for (const variant of ["factory", "single", "multi"]) {
      const root = path.join(directory, "study", "coding", seed.id, variant);
      assert.equal(fs.existsSync(path.join(root, "repo", "evaluator")), false);
      const prompt = fs.readFileSync(
        path.join(directory, "study", "prompts", seed.id, `${variant}.txt`),
        "utf8",
      );
      assert.match(prompt, /Repository: bun-loop-factory\//);
      assert.match(prompt, /Base commit: [a-f0-9]{40}/);
      for (const forbidden of ["hidden-golden", "protected.json", "error_classes", "gold patch"]) {
        assert.equal(prompt.includes(forbidden), false, forbidden);
      }
    }
  }
});

test("archived Factory study is sealed, complete, and reproducible from reports", () => {
  const study = path.resolve(__dirname, "..", "evaluation", "factory-2026-07");
  const fixtureProtocol = path.resolve(
    __dirname,
    "..",
    "evaluation",
    "factory-fixture-v1",
    "protocol.json",
  );
  assert.doesNotThrow(() => verifySeal(
    path.join(study, "seal.json"),
    path.join(study, "manifest.json"),
    path.join(study, "candidates"),
    fixtureProtocol,
  ));
  const archived = JSON.parse(fs.readFileSync(path.join(study, "aggregate.json")));
  assert.deepEqual(summarizeFactoryEvaluation(study), archived);
  assert.equal(archived.records.length, 9);
  assert.equal(archived.aggregate.factory.backlogs_resolved, 3);
  assert.equal(archived.aggregate.single.backlogs_resolved, 3);
  assert.equal(archived.aggregate.multi.backlogs_resolved, 3);
  assert.equal(archived.accuracy_claim_gate.passed, false);
  const factoryRecords = archived.records.filter((record) => record.variant === "factory");
  assert.equal(factoryRecords.length, 3);
  assert.ok(factoryRecords.every((record) => record.contexts <= 40));
  assert.ok(factoryRecords.every((record) => record.workflow_revisions > 0));
  assert.ok(factoryRecords.every((record) => record.requeues > 0));
});
