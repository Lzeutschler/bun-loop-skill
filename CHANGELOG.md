# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
the project intends to follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.0] - 2026-07-16

### Changed

- Split the workflow into an oracle-driven Factory Mode for repeatable backlogs and
  a bounded Patch Mode for one high-risk change set.
- Replace recursive reviewer cascades and mandatory global `CLEAN` reviews with
  executable item and integration oracles as the source of completion truth.
- Add mapper-reviewed preparation artifacts, a three-item Factory trial, safe
  isolated writer lanes, and process-level requeueing after repeated defect classes.
- Move state, structural, parser, lifetime, and migration checks into conditional
  review rubrics so ordinary patches do not pay their context cost.
- Bound Patch Mode to four normal role contexts and seven contexts only after a
  material fixer expansion or a still-failing oracle.
- Add a deterministic three-seed Node-to-Rust backlog fixture, hidden evaluator,
  three-variant sealing protocol, and integrity tests for the next comparison.
- Install and remove the conditional review rubrics across every supported runtime
  layout.

### Evaluation

- Preserve the official five-task negative result for the old 0.2 universal patch
  loop: 0/5 resolved versus 1/5 for the single-agent control at about four times
  the input-token cost.
- Record the controlled 0.3 Factory study honestly: Factory, single-agent, and
  unstructured multi-agent variants all resolved 3/3 backlogs, while Factory used
  about 23× and 15× their respective input-token totals.
- Add fresh-context routing and Patch-budget smoke runs; the Patch run used exactly
  four role contexts and required no review re-entry.
- Add an automatic amortization gate after the Factory study showed that preparation
  and a three-item trial are unjustified for a small eight-item transparent port.

### Additional changes

- Make the beta explicit-only by disabling implicit skill invocation.
- Add hard per-task budgets and scope-frontier rules; budget exhaustion now blocks
  instead of weakening completion gates.
- Separate tested installer mappings from end-to-end runtime capability claims.
- Require a generated management marker before replacing or uninstalling a skill
  directory.
- Correct the evaluation report to disclose leaked evaluator-category hints and to
  stop presenting local outcomes as blind or official SWE-bench scores.
- Add a clean three-field evaluation-prompt boundary and post-seal prediction
  builder for repeatable blind SWE-bench comparisons.
- Report a five-task official Docker-harness evaluation honestly: Bun Loop resolved
  0/5 tasks versus 1/5 for the single-agent control at roughly four times the input
  token cost.
- Prioritize exact primary-contract fidelity, repository-owned abstractions, and
  negative compatibility controls before adversarial edge expansion.
- Add a complexity ratchet and stop speculative review rounds when executable
  primary evidence is unavailable.
- Archive the clean manifest, sealed candidates, usage records, predictions, and
  official reports; pin the dataset revision and verify future post-seal prediction
  builds against SHA-256 hashes.

## [0.2.0] - 2026-07-15

### Changed

- Require causal-surface maps and behavior matrices for invariant and
  state-transition defects.
- Require cross-operation and inverse-path review before accepting narrow fixes.
- Reject symptom patches that only make the reported reproduction pass.
- Allow a fully integrated single-item review round to satisfy the aggregate
  review gate without launching a redundant second pair of reviewers.
- Reserve fresh-context capacity for final review and bound retries after hard
  agent-thread capacity errors.
- Add a public exploratory evaluation report comparing Bun Loop with a single
  agent on two SWE-bench Verified tasks.

## [0.1.0] - 2026-07-15

### Added

- Portable Bun Loop skill with implementer, dual adversarial reviewer, fixer, and
  orchestrator roles.
- Quality gates for false progress, repeated defect patterns, shared worktrees, and
  stalled reviewers.
- Dependency-free installer for Claude, Codex, Cursor, Copilot, OpenCode, Kilo,
  Kimi, Cline, and custom skills roots.
- Claude plugin and marketplace manifests.
- Repository validation, installer tests, cross-platform CI, and community policy
  files.

[Unreleased]: https://github.com/Lzeutschler/bun-loop-skill/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/Lzeutschler/bun-loop-skill/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Lzeutschler/bun-loop-skill/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Lzeutschler/bun-loop-skill/releases/tag/v0.1.0
