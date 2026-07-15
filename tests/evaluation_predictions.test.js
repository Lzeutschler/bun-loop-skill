"use strict";

const assert = require("node:assert/strict");
const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const python = process.platform === "win32" ? "python" : "python3";
const pythonAvailable = !spawnSync(python, ["--version"], { encoding: "utf8" }).error;

function runPython(source, args = []) {
  const result = spawnSync(python, ["-c", source, root, ...args], {
    encoding: "utf8",
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

test("post-seal prediction builder rejects evaluator metadata in the clean manifest", (t) => {
  if (!pythonAvailable) return t.skip("Python is optional for npm consumers");
  const directory = mkdtempSync(path.join(os.tmpdir(), "bun-loop-manifest-"));
  const manifest = path.join(directory, "manifest.json");
  writeFileSync(
    manifest,
    JSON.stringify([
      {
        problem_statement: "Fix it",
        repo: "example/project",
        base_commit: "abc123",
        instance_id: "must-not-cross-the-boundary",
      },
    ]),
  );
  try {
    const output = runPython(
      [
        "import importlib.util, pathlib, sys",
        "spec = importlib.util.spec_from_file_location('builder', pathlib.Path(sys.argv[1]) / 'scripts' / 'build_evaluation_predictions.py')",
        "module = importlib.util.module_from_spec(spec)",
        "spec.loader.exec_module(module)",
        "try:",
        "    module.load_clean_manifest(pathlib.Path(sys.argv[2]))",
        "except ValueError as error:",
        "    print(error)",
        "else:",
        "    raise SystemExit('metadata was accepted')",
      ].join("\n"),
      [manifest],
    );
    assert.match(output, /evaluator-only fields/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("prediction records combine mapped IDs with candidate patch bytes", (t) => {
  if (!pythonAvailable) return t.skip("Python is optional for npm consumers");
  const directory = mkdtempSync(path.join(os.tmpdir(), "bun-loop-predictions-"));
  const sealed = path.join(directory, "sealed");
  mkdirSync(path.join(sealed, "case-01"), { recursive: true });
  writeFileSync(path.join(sealed, "case-01", "bun.patch"), "diff --git a/a b/a\n");
  writeFileSync(path.join(sealed, "case-01", "plain.patch"), "diff --git a/b b/b\n");
  try {
    const output = runPython(
      [
        "import importlib.util, json, pathlib, sys",
        "spec = importlib.util.spec_from_file_location('builder', pathlib.Path(sys.argv[1]) / 'scripts' / 'build_evaluation_predictions.py')",
        "module = importlib.util.module_from_spec(spec)",
        "spec.loader.exec_module(module)",
        "tasks = [{'problem_statement': 'Fix it', 'repo': 'example/project', 'base_commit': 'abc123'}]",
        "rows = [{'instance_id': 'example__project-1', 'repo': 'example/project', 'base_commit': 'abc123'}]",
        "ids = module.map_instance_ids(tasks, rows)",
        "patches = {'case-01/bun.patch': (pathlib.Path(sys.argv[2]) / 'case-01' / 'bun.patch').read_text()}",
        "print(json.dumps(module.build_predictions(ids, patches, 'bun'))) ",
      ].join("\n"),
      [sealed],
    );
    const records = JSON.parse(output);
    assert.equal(records[0].instance_id, "example__project-1");
    assert.equal(records[0].model_name_or_path, "bun-loop-study/bun");
    assert.match(records[0].model_patch, /^diff --git/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("deterministic selection reproduces the archived clean-manifest order", (t) => {
  if (!pythonAvailable) return t.skip("Python is optional for npm consumers");
  const output = runPython(
    [
      "import importlib.util, json, pathlib, sys",
      "root = pathlib.Path(sys.argv[1])",
      "spec = importlib.util.spec_from_file_location('selector', root / 'scripts' / 'select_evaluation_tasks.py')",
      "selector = importlib.util.module_from_spec(spec)",
      "spec.loader.exec_module(selector)",
      "manifest = json.loads((root / 'evaluation' / 'blind-2026-07' / 'manifest.json').read_text())",
      "summary = json.loads((root / 'evaluation' / 'blind-2026-07.json').read_text())",
      "difficulty = {task['repo']: task['difficulty'] for task in summary['tasks']}",
      "rows = [dict(task, difficulty=difficulty[task['repo']]) for task in manifest]",
      "selected = selector.select_tasks(list(reversed(rows)), 5)",
      "print(json.dumps(selected))",
    ].join("\n"),
  );
  assert.deepEqual(JSON.parse(output), require("../evaluation/blind-2026-07/manifest.json"));
});

test("post-seal verification rejects a candidate changed after hashing", (t) => {
  if (!pythonAvailable) return t.skip("Python is optional for npm consumers");
  const directory = mkdtempSync(path.join(os.tmpdir(), "bun-loop-seal-"));
  const manifest = path.join(directory, "manifest.json");
  const sealed = path.join(directory, "sealed");
  const seal = path.join(directory, "seal.json");
  mkdirSync(path.join(sealed, "case-01"), { recursive: true });
  writeFileSync(manifest, JSON.stringify([{ problem_statement: "Fix it", repo: "example/project", base_commit: "abc123" }]));
  writeFileSync(path.join(sealed, "case-01", "bun.patch"), "original bun patch\n");
  writeFileSync(path.join(sealed, "case-01", "plain.patch"), "original plain patch\n");
  try {
    const output = runPython(
      [
        "import importlib.util, json, pathlib, sys",
        "root, manifest, sealed, seal = map(pathlib.Path, sys.argv[1:5])",
        "seal_spec = importlib.util.spec_from_file_location('sealer', root / 'scripts' / 'seal_evaluation.py')",
        "sealer = importlib.util.module_from_spec(seal_spec)",
        "seal_spec.loader.exec_module(sealer)",
        "seal.write_text(json.dumps(sealer.create_seal(manifest, sealed)))",
        "builder_spec = importlib.util.spec_from_file_location('builder', root / 'scripts' / 'build_evaluation_predictions.py')",
        "builder = importlib.util.module_from_spec(builder_spec)",
        "builder_spec.loader.exec_module(builder)",
        "(sealed / 'case-01' / 'bun.patch').write_text('mutated patch\\n')",
        "try:",
        "    builder.verify_seal(seal, manifest.read_bytes(), sealed, 1)",
        "except ValueError as error:",
        "    print(error)",
        "else:",
        "    raise SystemExit('mutated patch was accepted')",
      ].join("\n"),
      [manifest, sealed, seal],
    );
    assert.match(output, /changed after sealing/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
