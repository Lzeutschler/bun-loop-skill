#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { generateAll, SEEDS } = require("./generate_factory_fixture");
const { renderPrompt } = require("./render_evaluation_prompt");

const VARIANTS = Object.freeze(["factory", "single", "multi"]);
const SKILL_PATH = "/tmp/bun-loop-skill-0.3-under-test";

const WRAPPERS = Object.freeze({
  factory: `Use $bun-loop-skill factory from ${SKILL_PATH} to solve the complete backlog.

Fixed evaluation protocol:
- Work only in the current candidate repository and the provided skill directory. Read no other path.
- Do not inspect git history beyond HEAD, remotes, the internet, evaluator artifacts, sibling fixtures, hidden tests, or solution material.
- Use real Factory Mode roles with at most 40 fresh role contexts, 4 isolated writer lanes, 24 targeted oracle runs, and 6 full oracle runs.
- Modify only port/src/. Do not commit, push, weaken checks, or add network dependencies. Preserve the working-tree diff.
- Finish with exactly one FACTORY_TRACE JSON line containing: contexts, roles, fix_rounds, workflow_revisions, requeues, accepted_findings, rejected_findings, targeted_oracle_runs, full_oracle_runs, and status.`,
  single: `Solve the complete backlog directly in one fresh agent context. Do not use Bun Loop and do not delegate.

Fixed evaluation protocol:
- Work only in the current candidate repository. Read no other path.
- Do not inspect git history beyond HEAD, remotes, the internet, evaluator artifacts, sibling fixtures, hidden tests, or solution material.
- Use at most 24 targeted oracle runs and 6 full oracle runs.
- Modify only port/src/. Do not commit, push, weaken checks, or add network dependencies. Preserve the working-tree diff.
- Finish with exactly one FACTORY_TRACE JSON line containing: contexts, roles, fix_rounds, workflow_revisions, requeues, accepted_findings, rejected_findings, targeted_oracle_runs, full_oracle_runs, and status.`,
  multi: `Solve the complete backlog without Bun Loop. You may organize independent subagents freely, with the same maximum compute budget as Factory Mode.

Fixed evaluation protocol:
- Work only in the current candidate repository. Read no other path.
- Do not inspect git history beyond HEAD, remotes, the internet, evaluator artifacts, sibling fixtures, hidden tests, solution material, or Bun Loop skill files.
- Use at most 40 fresh role contexts, 4 isolated writer lanes, 24 targeted oracle runs, and 6 full oracle runs.
- Modify only port/src/. Do not commit, push, weaken checks, or add network dependencies. Preserve the working-tree diff.
- Finish with exactly one FACTORY_TRACE JSON line containing: contexts, roles, fix_rounds, workflow_revisions, requeues, accepted_findings, rejected_findings, targeted_oracle_runs, full_oracle_runs, and status.`,
});

function prepareFactoryEvaluation(output) {
  const root = path.resolve(output);
  const staging = path.join(root, ".staging");
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  const manifest = generateAll(staging);
  fs.writeFileSync(path.join(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  for (const seed of SEEDS) {
    const sourceRepo = path.join(staging, seed.id, "repo");
    const evaluator = path.join(root, "evaluator", seed.id);
    fs.cpSync(path.join(staging, seed.id, "evaluator"), evaluator, { recursive: true });
    for (const variant of VARIANTS) {
      const candidate = path.join(root, "coding", seed.id, variant, "repo");
      fs.mkdirSync(path.dirname(candidate), { recursive: true });
      fs.cpSync(sourceRepo, candidate, { recursive: true });
      const task = manifest.find((item) => item.repo.endsWith(`/${seed.id}`));
      const prompt = `${WRAPPERS[variant]}\n\n${renderPrompt(task)}\n`;
      const promptPath = path.join(root, "prompts", seed.id, `${variant}.txt`);
      fs.mkdirSync(path.dirname(promptPath), { recursive: true });
      fs.writeFileSync(promptPath, prompt, "utf8");
    }
  }
  fs.rmSync(staging, { recursive: true, force: true });
  return manifest;
}

function main(argv) {
  if (argv.length !== 1) throw new Error("Usage: prepare_factory_evaluation.js <output-directory>");
  const manifest = prepareFactoryEvaluation(argv[0]);
  process.stdout.write(`Prepared ${manifest.length * VARIANTS.length} blind candidate workspaces\n`);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`prepare-factory-evaluation: ${error.message}\n`); process.exitCode = 1; }
}

module.exports = { SKILL_PATH, VARIANTS, WRAPPERS, prepareFactoryEvaluation };
