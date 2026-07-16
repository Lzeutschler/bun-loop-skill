#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const RUST_IMAGE = "docker.io/library/rust:1.88.0-slim-bookworm@sha256:38bc5a86d998772d4aec2348656ed21438d20fcdce2795b56ca434cf21430d89";
const SEEDS = Object.freeze([
  { id: "amber", date: "2026-07-16T00:00:01Z", salt: 3 },
  { id: "cobalt", date: "2026-07-16T00:00:02Z", salt: 5 },
  { id: "jade", date: "2026-07-16T00:00:03Z", salt: 7 },
]);

function fail(message) {
  throw new Error(message);
}

function write(file, contents, mode) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, "utf8");
  if (mode) fs.chmodSync(file, mode);
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function operationNames(seed) {
  return {
    window: `${seed.id}_window`,
    tail: `${seed.id}_tail`,
    floor: `${seed.id}_floor_bucket`,
    wrap: `${seed.id}_wrap_index`,
    fields: `${seed.id}_escaped_fields`,
    pairs: `${seed.id}_escaped_pairs`,
    unique: `${seed.id}_stable_unique`,
    merge: `${seed.id}_stable_merge`,
  };
}

function splitEscaped(input, delimiter) {
  const result = [];
  let current = "";
  let escaped = false;
  for (const char of input) {
    if (escaped) {
      current += char;
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === delimiter) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (escaped) current += "\\";
  result.push(current);
  return result;
}

function referenceResult(names, testCase) {
  const [op, ...args] = [testCase.op, ...testCase.args];
  switch (op) {
    case names.window: {
      const chars = Array.from(args[0]);
      const start = Number(args[1]);
      return chars.slice(start, start + Number(args[2])).join("");
    }
    case names.tail:
      return Array.from(args[0]).slice(-Number(args[1])).join("");
    case names.floor:
      return Math.floor(Number(args[0]) / Number(args[1]));
    case names.wrap: {
      const size = Number(args[1]);
      return ((Number(args[0]) % size) + size) % size;
    }
    case names.fields:
      return splitEscaped(args[0], args[1]);
    case names.pairs:
      return splitEscaped(args[0], ";").map((entry) => {
        const pair = splitEscaped(entry, "=");
        const key = pair.shift() ?? "";
        return `${key}:${pair.join("=")}`;
      });
    case names.unique:
      return [...new Set(args)];
    case names.merge: {
      const separator = args.indexOf("--");
      return [...new Set([...args.slice(0, separator), ...args.slice(separator + 1)])];
    }
    default:
      fail(`unknown operation: ${op}`);
  }
}

function casesFor(seed) {
  const n = operationNames(seed);
  const s = seed.salt;
  const visible = [
    { op: n.window, args: [`A🙂Bé${seed.id}`, "1", "3"] },
    { op: n.tail, args: [`naïve-${seed.id}-🚀`, "3"] },
    { op: n.floor, args: [String(-(s * 3 + 1)), String(s)] },
    { op: n.wrap, args: [String(-(s + 2)), String(s + 4)] },
    { op: n.fields, args: [`one|two\\|inner|${seed.id}`, "|"] },
    { op: n.pairs, args: [`name=${seed.id};note=left\\=right;empty=`, "unused"] },
    { op: n.unique, args: ["pear", seed.id, "pear", "apple", seed.id] },
    { op: n.merge, args: ["zeta", seed.id, "--", "alpha", "zeta", seed.id] },
  ];
  const hidden = [
    { op: n.window, args: [`é🙂漢字-${seed.id}`, "-4", "3"] },
    { op: n.window, args: [`🙂${seed.id}`, "0", "1"] },
    { op: n.tail, args: [`x🙂yé${seed.id}`, "0"] },
    { op: n.tail, args: [`x🙂yé${seed.id}`, "2"] },
    { op: n.floor, args: [String(-(s * 4)), String(s)] },
    { op: n.floor, args: [String(-(s * 4 + 1)), String(s)] },
    { op: n.wrap, args: [String(-(s * 5)), String(s + 2)] },
    { op: n.wrap, args: [String(s * 9 + 1), String(s + 2)] },
    { op: n.fields, args: [`a||b\\|c|trail\\`, "|"] },
    { op: n.fields, args: [`${seed.id}\\\\|x`, "|"] },
    { op: n.pairs, args: [`a=1;b=two\\;parts;c=three\\=parts`, "unused"] },
    { op: n.pairs, args: [`=empty-key;empty-value=;slash=tail\\`, "unused"] },
    { op: n.unique, args: [seed.id, "β", seed.id, "alpha", "β", ""] },
    { op: n.unique, args: ["10", "2", "10", "1"] },
    { op: n.merge, args: [seed.id, "β", "--", "β", "alpha", seed.id, ""] },
    { op: n.merge, args: ["10", "2", "--", "1", "10"] },
  ];
  return { visible, hidden };
}

function referenceCli(seed) {
  const n = operationNames(seed);
  return `#!/usr/bin/env node
const [op, ...args] = process.argv.slice(2);

function splitEscaped(input, delimiter) {
  const result = [];
  let current = "";
  let escaped = false;
  for (const char of input) {
    if (escaped) { current += char; escaped = false; }
    else if (char === "\\\\") escaped = true;
    else if (char === delimiter) { result.push(current); current = ""; }
    else current += char;
  }
  if (escaped) current += "\\\\";
  result.push(current);
  return result;
}

let output;
switch (op) {
  case ${JSON.stringify(n.window)}: {
    const chars = Array.from(args[0]);
    const start = Number(args[1]);
    output = chars.slice(start, start + Number(args[2])).join("");
    break;
  }
  case ${JSON.stringify(n.tail)}:
    output = Array.from(args[0]).slice(-Number(args[1])).join("");
    break;
  case ${JSON.stringify(n.floor)}:
    output = Math.floor(Number(args[0]) / Number(args[1]));
    break;
  case ${JSON.stringify(n.wrap)}: {
    const size = Number(args[1]);
    output = ((Number(args[0]) % size) + size) % size;
    break;
  }
  case ${JSON.stringify(n.fields)}:
    output = splitEscaped(args[0], args[1]);
    break;
  case ${JSON.stringify(n.pairs)}:
    output = splitEscaped(args[0], ";").map((entry) => {
      const pair = splitEscaped(entry, "=");
      const key = pair.shift() ?? "";
      return \`\${key}:\${pair.join("=")}\`;
    });
    break;
  case ${JSON.stringify(n.unique)}:
    output = [...new Set(args)];
    break;
  case ${JSON.stringify(n.merge)}: {
    const separator = args.indexOf("--");
    output = [...new Set([...args.slice(0, separator), ...args.slice(separator + 1)])];
    break;
  }
  default:
    throw new Error(\`unknown operation: \${op}\`);
}
process.stdout.write(JSON.stringify(output) + "\\n");
`;
}

function rustMain(seed) {
  const n = operationNames(seed);
  return `mod ops;

enum Output { Text(String), Number(i64), Texts(Vec<String>) }

fn escape_json(value: &str) -> String {
    let mut out = String::from("\\\"");
    for ch in value.chars() {
        match ch {
            '\\\\' => out.push_str("\\\\\\\\"),
            '\"' => out.push_str("\\\\\\\""),
            '\\n' => out.push_str("\\\\n"),
            '\\r' => out.push_str("\\\\r"),
            '\\t' => out.push_str("\\\\t"),
            c => out.push(c),
        }
    }
    out.push('\"');
    out
}

fn render(output: Output) -> String {
    match output {
        Output::Text(value) => escape_json(&value),
        Output::Number(value) => value.to_string(),
        Output::Texts(values) => format!("[{}]", values.iter().map(|v| escape_json(v)).collect::<Vec<_>>().join(",")),
    }
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let op = args.first().expect("operation").as_str();
    let values = &args[1..];
    let output = match op {
        ${JSON.stringify(n.window)} => Output::Text(ops::window::run(&values[0], values[1].parse().unwrap(), values[2].parse().unwrap())),
        ${JSON.stringify(n.tail)} => Output::Text(ops::tail::run(&values[0], values[1].parse().unwrap())),
        ${JSON.stringify(n.floor)} => Output::Number(ops::floor_bucket::run(values[0].parse().unwrap(), values[1].parse().unwrap())),
        ${JSON.stringify(n.wrap)} => Output::Number(ops::wrap_index::run(values[0].parse().unwrap(), values[1].parse().unwrap())),
        ${JSON.stringify(n.fields)} => Output::Texts(ops::escaped_fields::run(&values[0], values[1].chars().next().unwrap())),
        ${JSON.stringify(n.pairs)} => Output::Texts(ops::escaped_pairs::run(&values[0])),
        ${JSON.stringify(n.unique)} => Output::Texts(ops::stable_unique::run(values)),
        ${JSON.stringify(n.merge)} => Output::Texts(ops::stable_merge::run(values)),
        _ => panic!("unknown operation: {op}"),
    };
    println!("{}", render(output));
}
`;
}

const RUST_MODULES = Object.freeze({
  "window.rs": `pub fn run(input: &str, start: isize, count: usize) -> String {
    let bytes = input.as_bytes();
    let begin = if start < 0 { bytes.len().saturating_sub((-start) as usize) } else { start as usize };
    String::from_utf8_lossy(&bytes[begin.min(bytes.len())..(begin + count).min(bytes.len())]).into_owned()
}
`,
  "tail.rs": `pub fn run(input: &str, count: usize) -> String {
    let bytes = input.as_bytes();
    String::from_utf8_lossy(&bytes[bytes.len().saturating_sub(count)..]).into_owned()
}
`,
  "floor_bucket.rs": `pub fn run(value: i64, width: i64) -> i64 { value / width }
`,
  "wrap_index.rs": `pub fn run(value: i64, size: i64) -> i64 { value % size }
`,
  "escaped_fields.rs": `pub fn run(input: &str, delimiter: char) -> Vec<String> {
    input.split(delimiter).map(str::to_owned).collect()
}
`,
  "escaped_pairs.rs": `pub fn run(input: &str) -> Vec<String> {
    input.split(';').map(|entry| {
        let (key, value) = entry.split_once('=').unwrap_or((entry, ""));
        format!("{key}:{value}")
    }).collect()
}
`,
  "stable_unique.rs": `pub fn run(values: &[String]) -> Vec<String> {
    let mut result = values.to_vec();
    result.sort();
    result.dedup();
    result
}
`,
  "stable_merge.rs": `pub fn run(values: &[String]) -> Vec<String> {
    let split = values.iter().position(|v| v == "--").unwrap_or(values.len());
    let mut result = values[..split].iter().chain(values.get(split + 1..).unwrap_or(&[])).cloned().collect::<Vec<_>>();
    result.sort();
    result.dedup();
    result
}
`,
});

const CORRECT_RUST_MODULES = Object.freeze({
  "window.rs": `fn normalize(index: isize, len: isize) -> usize {
    if index < 0 { (len + index).max(0) as usize } else { index.min(len) as usize }
}

pub fn run(input: &str, start: isize, count: usize) -> String {
    let chars: Vec<char> = input.chars().collect();
    let begin = normalize(start, chars.len() as isize);
    let end = normalize(start.saturating_add(count as isize), chars.len() as isize);
    chars[begin.min(end)..end].iter().collect()
}
`,
  "tail.rs": `pub fn run(input: &str, count: usize) -> String {
    if count == 0 { return input.to_owned(); }
    let chars: Vec<char> = input.chars().collect();
    chars[chars.len().saturating_sub(count)..].iter().collect()
}
`,
  "floor_bucket.rs": `pub fn run(value: i64, width: i64) -> i64 { value.div_euclid(width) }
`,
  "wrap_index.rs": `pub fn run(value: i64, size: i64) -> i64 { value.rem_euclid(size) }
`,
  "escaped_fields.rs": `pub fn split_escaped(input: &str, delimiter: char) -> Vec<String> {
    let mut result = Vec::new();
    let mut current = String::new();
    let mut escaped = false;
    for ch in input.chars() {
        if escaped { current.push(ch); escaped = false; }
        else if ch == '\\\\' { escaped = true; }
        else if ch == delimiter { result.push(std::mem::take(&mut current)); }
        else { current.push(ch); }
    }
    if escaped { current.push('\\\\'); }
    result.push(current);
    result
}

pub fn run(input: &str, delimiter: char) -> Vec<String> { split_escaped(input, delimiter) }
`,
  "escaped_pairs.rs": `use super::escaped_fields::split_escaped;

pub fn run(input: &str) -> Vec<String> {
    split_escaped(input, ';').into_iter().map(|entry| {
        let mut pair = split_escaped(&entry, '=');
        let key = if pair.is_empty() { String::new() } else { pair.remove(0) };
        format!("{key}:{}", pair.join("="))
    }).collect()
}
`,
  "stable_unique.rs": `use std::collections::HashSet;

pub fn run(values: &[String]) -> Vec<String> {
    let mut seen = HashSet::new();
    values.iter().filter(|value| seen.insert((*value).clone())).cloned().collect()
}
`,
  "stable_merge.rs": `use std::collections::HashSet;

pub fn run(values: &[String]) -> Vec<String> {
    let split = values.iter().position(|value| value == "--").unwrap_or(values.len());
    let mut seen = HashSet::new();
    values[..split].iter().chain(values.get(split + 1..).unwrap_or(&[]))
        .filter(|value| seen.insert((*value).clone())).cloned().collect()
}
`,
});

function applyGold(repo) {
  for (const [file, source] of Object.entries(CORRECT_RUST_MODULES)) {
    write(path.join(repo, "port", "src", "ops", file), source);
  }
}

function visibleOracleScript() {
  return `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const cases = JSON.parse(fs.readFileSync(path.join(root, "cases", "visible.json")));
const expected = JSON.parse(fs.readFileSync(path.join(root, "cases", "visible-golden.json")));
const binary = path.join(root, "port", ".factory-target", "release", "factory-port");
const image = ${JSON.stringify(RUST_IMAGE)};
let passed = 0;
for (let i = 0; i < cases.length; i += 1) {
  const item = cases[i];
  const run = spawnSync("docker", [
    "run", "--rm", "--network", "none", "-v", \`${"${root}"}:/work\`,
    image, "/work/port/.factory-target/release/factory-port", item.op, ...item.args,
  ], { encoding: "utf8" });
  let actual;
  try { actual = run.status === 0 ? JSON.parse(run.stdout) : { error: (run.stderr || run.error?.message || "execution failed").trim() }; }
  catch (error) { actual = { error: error.message, stdout: run.stdout }; }
  const ok = JSON.stringify(actual) === JSON.stringify(expected[i]);
  if (ok) passed += 1;
  process.stdout.write(\`${"${ok ? \"PASS\" : \"FAIL\"}"} ${"${item.op}"}\\n\`);
  if (!ok) process.stdout.write(\`  expected ${"${JSON.stringify(expected[i])}"}\\n  actual   ${"${JSON.stringify(actual)}"}\\n\`);
}
process.stdout.write(\`${"${passed}"}/${"${cases.length}"} visible cases passed\\n\`);
process.exitCode = passed === cases.length ? 0 : 1;
`;
}

function oracleShell() {
  return `#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
docker run --rm --network none -v "$ROOT:/work" -w /work/port \\
  ${RUST_IMAGE} \\
  cargo build --offline --locked --release --target-dir /work/port/.factory-target
node "$ROOT/scripts/visible-oracle.cjs"
`;
}

function problemStatement(seed) {
  const names = Object.values(operationNames(seed)).map((name) => `- \`${name}\``).join("\n");
  return `Complete the Rust port of eight transformation modules so it exactly matches the authoritative Node.js implementation for all supported inputs. The work is a repeatable porting backlog, not one monolithic rewrite.

Operations:
${names}

The source implementation is in reference/cli.mjs. The incomplete Rust port is in port/src/ops/. Run ./scripts/visible-oracle.sh for the executable compile-and-parity oracle. Preserve exact JSON values, ordering, Unicode behavior, escaping, negative-number behavior, and existing public operation names.

Do not modify reference/, cases/, or scripts/, do not weaken checks, and do not add network dependencies. Keep each module independently reviewable and finish the complete backlog.`;
}

function git(repo, args, env = {}) {
  const result = spawnSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) fail(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function generateSeed(root, seed) {
  const seedRoot = path.join(root, seed.id);
  const repo = path.join(seedRoot, "repo");
  const evaluator = path.join(seedRoot, "evaluator");
  fs.rmSync(seedRoot, { recursive: true, force: true });
  fs.mkdirSync(repo, { recursive: true });

  const names = operationNames(seed);
  const allCases = casesFor(seed);
  const visibleGolden = allCases.visible.map((item) => referenceResult(names, item));
  const hiddenGolden = allCases.hidden.map((item) => referenceResult(names, item));

  write(path.join(repo, ".gitignore"), "port/.factory-target/\n");
  write(path.join(repo, "reference", "cli.mjs"), referenceCli(seed), 0o755);
  write(path.join(repo, "cases", "visible.json"), json(allCases.visible));
  write(path.join(repo, "cases", "visible-golden.json"), json(visibleGolden));
  write(path.join(repo, "scripts", "visible-oracle.cjs"), visibleOracleScript(), 0o755);
  write(path.join(repo, "scripts", "visible-oracle.sh"), oracleShell(), 0o755);
  write(path.join(repo, "port", "Cargo.toml"), `[package]\nname = "factory-port"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n`);
  write(path.join(repo, "port", "Cargo.lock"), `# This file is automatically @generated by Cargo.\n# It is not intended for manual editing.\nversion = 4\n\n[[package]]\nname = "factory-port"\nversion = "0.1.0"\n`);
  write(path.join(repo, "port", "src", "main.rs"), rustMain(seed));
  write(path.join(repo, "port", "src", "ops", "mod.rs"), `${Object.keys(RUST_MODULES).map((file) => `pub mod ${file.slice(0, -3)};`).join("\n")}\n`);
  for (const [file, source] of Object.entries(RUST_MODULES)) {
    write(path.join(repo, "port", "src", "ops", file), source);
  }

  const protectedFiles = [
    "reference/cli.mjs",
    "cases/visible.json",
    "cases/visible-golden.json",
    "scripts/visible-oracle.cjs",
    "scripts/visible-oracle.sh",
  ];
  write(path.join(evaluator, "hidden.json"), json(allCases.hidden));
  write(path.join(evaluator, "hidden-golden.json"), json(hiddenGolden));
  write(path.join(evaluator, "visible.json"), json(allCases.visible));
  write(path.join(evaluator, "visible-golden.json"), json(visibleGolden));
  write(path.join(evaluator, "reference-cli.mjs"), referenceCli(seed), 0o755);
  write(path.join(evaluator, "protected.json"), json(Object.fromEntries(
    protectedFiles.map((relative) => [relative, sha256(path.join(repo, relative))]),
  )));
  write(path.join(evaluator, "metadata.json"), json({ seed: seed.id, names, rust_image: RUST_IMAGE }));

  git(repo, ["init", "-q", "-b", "main"]);
  git(repo, ["config", "user.name", "Bun Loop Fixture"]);
  git(repo, ["config", "user.email", "fixture@example.invalid"]);
  git(repo, ["add", "."]);
  const commitEnv = { GIT_AUTHOR_DATE: seed.date, GIT_COMMITTER_DATE: seed.date, TZ: "UTC" };
  git(repo, ["commit", "-q", "-m", `factory fixture ${seed.id}`], commitEnv);
  const baseCommit = git(repo, ["rev-parse", "HEAD"]);
  return {
    problem_statement: problemStatement(seed),
    repo: `bun-loop-factory/${seed.id}`,
    base_commit: baseCommit,
  };
}

function generateAll(root) {
  fs.mkdirSync(root, { recursive: true });
  const manifest = SEEDS.map((seed) => generateSeed(root, seed));
  write(path.join(root, "manifest.json"), json(manifest));
  return manifest;
}

function main(argv) {
  if (argv.length !== 1) fail("Usage: generate_factory_fixture.js <output-directory>");
  const output = path.resolve(argv[0]);
  const manifest = generateAll(output);
  process.stdout.write(`Generated ${manifest.length} deterministic factory fixtures in ${output}\n`);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`generate-factory-fixture: ${error.message}\n`); process.exitCode = 1; }
}

module.exports = { RUST_IMAGE, SEEDS, applyGold, casesFor, generateAll, generateSeed, operationNames, referenceResult };
