#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const VARIANTS = Object.freeze(["factory", "single", "multi"]);

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function cleanManifest(file) {
  const manifest = JSON.parse(fs.readFileSync(file));
  if (!Array.isArray(manifest) || manifest.length !== 3) throw new Error("factory manifest must contain three tasks");
  for (const task of manifest) {
    const keys = Object.keys(task).sort();
    if (keys.join(",") !== "base_commit,problem_statement,repo") {
      throw new Error("factory manifest crossed the three-field prompt boundary");
    }
  }
  return manifest;
}

function createSeal(manifestFile, candidatesRoot, protocolFile) {
  const manifest = cleanManifest(manifestFile);
  const artifacts = {};
  for (const task of manifest) {
    const seed = task.repo.split("/").at(-1);
    for (const variant of VARIANTS) {
      for (const extension of ["patch", "usage.json", "trace.json"]) {
        const relative = `${seed}/${variant}.${extension}`;
        const file = path.join(candidatesRoot, relative);
        if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
          throw new Error(`missing candidate artifact: ${relative}`);
        }
        artifacts[relative] = sha256(file);
      }
    }
  }
  return {
    schema_version: 1,
    hash_algorithm: "sha256",
    task_count: manifest.length,
    variants: VARIANTS,
    manifest_sha256: sha256(manifestFile),
    protocol_sha256: sha256(protocolFile),
    artifacts,
  };
}

function verifySeal(sealFile, manifestFile, candidatesRoot, protocolFile) {
  const expected = createSeal(manifestFile, candidatesRoot, protocolFile);
  const actual = JSON.parse(fs.readFileSync(sealFile));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("factory evaluation artifacts changed after sealing");
  }
  return expected;
}

function main(argv) {
  if (argv.length !== 4) {
    throw new Error("Usage: seal_factory_evaluation.js <manifest.json> <candidates-dir> <protocol.json> <seal.json>");
  }
  const [manifest, candidates, protocol, output] = argv.map((value) => path.resolve(value));
  const seal = createSeal(manifest, candidates, protocol);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(seal, null, 2)}\n`, "utf8");
  process.stdout.write(`Sealed ${Object.keys(seal.artifacts).length} factory artifacts\n`);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`seal-factory-evaluation: ${error.message}\n`); process.exitCode = 1; }
}

module.exports = { VARIANTS, cleanManifest, createSeal, verifySeal };
