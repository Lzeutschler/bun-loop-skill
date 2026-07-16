#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SEEDS = Object.freeze(["amber", "cobalt", "jade"]);
const VARIANTS = Object.freeze(["factory", "single", "multi"]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function normalizedTrace(trace) {
  if (Number.isFinite(trace.contexts)) return trace;
  const match = typeof trace.final_message === "string"
    ? trace.final_message.match(/FACTORY_TRACE:?\s*(\{[^\n]*\})/)
    : null;
  if (!match) return trace;
  try { return { ...trace, ...JSON.parse(match[1]), recovered_from_final_message: true }; }
  catch { return trace; }
}

function summarizeFactoryEvaluation(studyRoot) {
  const records = [];
  for (const seed of SEEDS) {
    for (const variant of VARIANTS) {
      const reportFile = path.join(studyRoot, "reports", seed, `${variant}.json`);
      const usageFile = path.join(studyRoot, "candidates", seed, `${variant}.usage.json`);
      const traceFile = path.join(studyRoot, "candidates", seed, `${variant}.trace.json`);
      for (const file of [reportFile, usageFile, traceFile]) {
        if (!fs.existsSync(file)) throw new Error(`incomplete factory study: ${file}`);
      }
      const report = readJson(reportFile);
      const usage = readJson(usageFile);
      const trace = normalizedTrace(readJson(traceFile));
      records.push({
        seed,
        variant,
        backlog_resolved: report.backlog_resolved,
        build_passed: report.build.passed,
        visible_passed: report.visible.passed,
        visible_total: report.visible.total,
        hidden_passed: report.hidden.passed,
        hidden_total: report.hidden.total,
        disallowed_paths: report.disallowed_paths,
        protected_failures: report.protected_failures,
        input_tokens: usage.input_tokens,
        cached_input_tokens: usage.cached_input_tokens,
        output_tokens: usage.output_tokens,
        reasoning_output_tokens: usage.reasoning_output_tokens,
        wall_clock_seconds: usage.wall_clock_seconds,
        patch_bytes: usage.patch_bytes,
        contexts: trace.contexts ?? null,
        fix_rounds: trace.fix_rounds ?? null,
        workflow_revisions: trace.workflow_revisions ?? null,
        requeues: trace.requeues ?? null,
        accepted_findings: trace.accepted_findings ?? null,
        rejected_findings: trace.rejected_findings ?? null,
        targeted_oracle_runs: trace.targeted_oracle_runs ?? null,
        full_oracle_runs: trace.full_oracle_runs ?? null,
        trace_status: trace.status ?? null,
        trace_parse_error: trace.recovered_from_final_message ? null : trace.parse_error ?? null,
        trace_recovered_from_final_message: trace.recovered_from_final_message ?? false,
      });
    }
  }

  const aggregate = {};
  for (const variant of VARIANTS) {
    const selected = records.filter((record) => record.variant === variant);
    aggregate[variant] = {
      backlogs_resolved: selected.filter((record) => record.backlog_resolved).length,
      visible_passed: selected.reduce((sum, record) => sum + record.visible_passed, 0),
      visible_total: selected.reduce((sum, record) => sum + record.visible_total, 0),
      hidden_passed: selected.reduce((sum, record) => sum + record.hidden_passed, 0),
      hidden_total: selected.reduce((sum, record) => sum + record.hidden_total, 0),
      hidden_regressions: selected.reduce((sum, record) => sum + record.hidden_total - record.hidden_passed, 0),
      input_tokens: selected.reduce((sum, record) => sum + record.input_tokens, 0),
      cached_input_tokens: selected.reduce((sum, record) => sum + record.cached_input_tokens, 0),
      output_tokens: selected.reduce((sum, record) => sum + record.output_tokens, 0),
      reasoning_output_tokens: selected.reduce((sum, record) => sum + record.reasoning_output_tokens, 0),
      wall_clock_seconds: selected.reduce((sum, record) => sum + record.wall_clock_seconds, 0),
      patch_bytes: selected.reduce((sum, record) => sum + record.patch_bytes, 0),
      contexts: selected.reduce((sum, record) => sum + (record.contexts ?? 0), 0),
    };
  }

  const bestControlRegressions = Math.min(
    aggregate.single.hidden_regressions,
    aggregate.multi.hidden_regressions,
  );
  const claimPassed = aggregate.factory.backlogs_resolved > aggregate.single.backlogs_resolved
    && aggregate.factory.backlogs_resolved > aggregate.multi.backlogs_resolved
    && aggregate.factory.hidden_regressions <= bestControlRegressions;
  return {
    schema_version: 1,
    study: "bun-loop-factory-0.3",
    seeds: SEEDS,
    variants: VARIANTS,
    records,
    aggregate,
    accuracy_claim_gate: {
      passed: claimPassed,
      rule: "Factory resolves more complete backlogs than both controls and has no more hidden regressions than the better control.",
    },
    review_precision: {
      value: null,
      limitation: "The fixed trace captured finding counts but not finding-level oracle confirmations; no precision value is inferred.",
    },
  };
}

function main(argv) {
  if (argv.length !== 2) throw new Error("Usage: summarize_factory_evaluation.js <study-root> <aggregate.json>");
  const studyRoot = path.resolve(argv[0]);
  const output = path.resolve(argv[1]);
  const summary = summarizeFactoryEvaluation(studyRoot);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(
    `Factory=${summary.aggregate.factory.backlogs_resolved}/3 single=${summary.aggregate.single.backlogs_resolved}/3 multi=${summary.aggregate.multi.backlogs_resolved}/3 claim=${summary.accuracy_claim_gate.passed}\n`,
  );
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`summarize-factory-evaluation: ${error.message}\n`); process.exitCode = 1; }
}

module.exports = { SEEDS, VARIANTS, normalizedTrace, summarizeFactoryEvaluation };
