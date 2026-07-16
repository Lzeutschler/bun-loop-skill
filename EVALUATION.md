# Evaluation

This document reports successful and failed evidence without treating process
activity as correctness. Two controlled studies have not demonstrated an accuracy
advantage for Bun Loop:

- The 0.3 Factory study resolved all three controlled backlogs, but so did the
  single-agent and unstructured multi-agent controls. Factory used about 23× the
  single-agent input tokens and 15× the multi-agent input tokens.
- The earlier 0.2 universal patch loop resolved 0/5 blind SWE-bench Verified tasks
  versus 1/5 for the single-agent control at about 4× the input-token cost.

Bun Loop remains experimental. A still earlier contaminated two-task exploration
is retained because it informed the workflow, not as benchmark evidence.

A fresh-context seven-scenario routing smoke test is archived under
`evaluation/routing-2026-07/`. It covered automatic Factory and Patch selection,
trivial and read-only exclusions, the missing-oracle Factory blocker, the
amortization fallback, and explicit Patch selection. All seven matched the contract.
It is a smoke test, not deterministic runtime conformance or evidence that Patch
Mode obeys its context budget during real implementation.

A separate fresh-context Patch smoke execution is archived under
`evaluation/patch-loop-2026-07/`. On a failing parser-compatibility fixture it used
exactly four role contexts: one implementer, two concurrent read-only reviewers,
and one fixer. A reviewer found a concrete baseline regression, the fixer corrected
it without expanding scope, no re-entry occurred, and an independent final oracle
rerun passed 4/4 tests. This is one execution, not a distributional budget guarantee.

All three archived Factory traces record bounded context counts, active-workflow
revisions, and requeues. Those summary traces do not retain item-level causality,
so they cannot independently prove that a still-failing item oracle, rather than a
different accepted process finding, caused each requeue. A dedicated item-level
oracle-failure trace test remains prerelease work.

## Controlled Factory evaluation — July 2026

### Question and fixture

This study tested the use case that version 0.3 is designed for rather than another
set of unrelated tickets: a repeatable Node-to-Rust porting backlog with eight
independently owned modules, a language-neutral parity oracle, and four recurring
error classes—Unicode indexing, signed arithmetic, escaped delimiters, and stable
ordering.

Three deterministic seeds (`amber`, `cobalt`, and `jade`) changed operation names,
inputs, and numeric boundaries while preserving the same workload shape. Each
candidate repository contained the authoritative Node implementation, incomplete
Rust modules, eight visible parity cases, and the pinned offline Rust build command.
The evaluator-only directory contained sixteen additional cases per seed and hashes
of every protected source and oracle file.

The complete fixture definition is under `evaluation/factory-fixture-v1/`. Its Rust
container is pinned to:

```text
docker.io/library/rust:1.88.0-slim-bookworm@
sha256:38bc5a86d998772d4aec2348656ed21438d20fcdce2795b56ca434cf21430d89
```

The generator is deterministic, each incomplete base fails its visible oracle, and
the evaluator-only correct port passes all visible and hidden cases. Repository
tests regenerate the fixture, validate the clean prompt boundary, and prove seal
mutation detection.

### Instruction-blind paired protocol

Each seed ran three variants from fresh history-free roots:

1. Bun Loop 0.3 with explicit Factory Mode.
2. One fresh coding context without the skill or delegation.
3. An unstructured multi-agent control without the skill, allowed the same maximum
   context, writer, wall-clock, and oracle budget as Factory Mode.

The clean task object contained only `problem_statement`, `repo`, and `base_commit`.
Fixed wrappers differed only in treatment and budget instructions. Candidate
repositories had no evaluator directory, hidden case, gold patch, sibling fixture,
or repository history beyond `HEAD`. Agents were instructed not to use the network,
but exact invocation flags were not archived, so enforcement is not independently
verifiable. This was instruction-blind, not OS-isolated blindness: evaluator data
lived in a sibling directory in the operator workspace, and coding agents were
instructed not to read outside their candidate repository. The archive does not
prove that filesystem boundary.

The operator recorded that all nine patch, usage, and trace triplets were archived
and jointly sealed before hidden evaluation. The seal was reverified immediately
before each sealed patch was applied to a fresh base. Hidden evaluation then checked
build success, eight visible cases, sixteen hidden cases, the `port/src/` write
allowlist, and protected-file integrity. The hashes prove current artifact integrity;
because no trusted timestamped execution ledger was captured, they do not
independently prove that historical ordering.

An initial three-run attempt was discarded because the coding sandbox could not
reach the Docker oracle. Those partial roots were deleted and all nine recorded
runs restarted from regenerated fixtures with Docker access. No hidden evaluator
was run or inspected during the discarded attempt. Exact protocol, seal, candidates,
usage, sealed traces, normalized aggregate records, reports, and results are
archived under `evaluation/factory-2026-07/`.

### Results

| Seed | Factory | Single agent | Unstructured multi-agent |
|---|---:|---:|---:|
| Amber | 8/8 visible · 16/16 hidden | 8/8 · 16/16 | 8/8 · 16/16 |
| Cobalt | 8/8 visible · 16/16 hidden | 8/8 · 16/16 | 8/8 · 16/16 |
| Jade | 8/8 visible · 16/16 hidden | 8/8 · 16/16 | 8/8 · 16/16 |
| **Resolved backlogs** | **3/3** | **3/3** | **3/3** |

Every candidate built successfully, stayed within the path allowlist, preserved all
protected files, and passed its 24 evaluated cases (216 candidate-case results
overall). The preregistered accuracy gate required Factory to resolve more backlogs
than both controls without additional hidden regressions. It failed because all
variants tied at 3/3.

### Cost

| Variant | Input / output tokens | Contexts | Summed run time | Patch bytes |
|---|---:|---:|---:|---:|
| Factory | 28,577,950 / 79,639 | 108 | 15,232 s | 53,039 |
| Single agent | 1,245,053 / 33,798 | 3 | 948 s | 27,208 |
| Unstructured multi-agent | 1,892,893 / 37,572 | 9 | 1,229 s | 30,217 |

Factory used 23.0× the single-agent input tokens, 36× the contexts, and 16.1×
the summed run time. Against the unstructured multi-agent control it used 15.1×
the input tokens, 12× the contexts, and 12.4× the summed run time. Factory's three
runs took approximately 83, 74, and 96 minutes individually.

Token totals are archiver-derived maxima from the available Codex usage events; raw
event logs and their schema were not sealed, so the exact totals are not independently
reconstructible from this archive. Context counts and workflow events are
self-reported. The fixed prompt emitted
`FACTORY_TRACE` without a colon while the original archiver expected one; sealed
trace files therefore retain a parse error plus the complete final message. The
aggregate recovers the JSON from that sealed message without changing candidate
artifacts. Finding-level oracle confirmations were not captured, so review
precision is deliberately reported as unavailable.

### What this supports

Factory Mode executed the intended architecture: preparation reviews, a three-item
trial, per-item implement/review/fix loops, oracle-driven completion, workflow
revisions, and targeted requeues. Reviewers found concrete language-boundary and
handoff defects, and every Factory candidate was correct.

It did not improve the outcome. The authoritative source and strong visible oracle
made the eight-module backlog straightforward enough that one agent solved every
seed much faster. For a queue this small, preparation and a three-item trial consumed
too much of the total work to amortize their cost.

Version 0.3 therefore adds an automatic amortization gate: a plain invocation does
not choose Factory Mode unless preparation plus the trial is expected to consume no
more than one quarter of the total engineering effort. Explicit Factory requests
remain available. This post-study routing correction was not itself evaluated by
the recorded treatment and must not be described as validated.

The next useful evaluation is not another eight-module transparent port. It should
test a materially larger queue, partial or noisy oracles, cross-item dependencies,
and failure classes whose process correction can affect many later items. Until
Factory beats both controls on such a study, there is no evidence for an accuracy
or cost advantage.

### Limitations

- Three deterministic seeds of one synthetic workload do not estimate a general
  win rate.
- Evaluator data was outside candidate repositories but in a readable sibling
  workspace; compliance with the no-read instruction was not enforced by an OS or
  container mount boundary.
- Network use was forbidden by the fixed instructions, but its sandbox enforcement
  is not reconstructible from the archived invocation evidence.
- Exact rendered prompts, the evaluated skill snapshot, invocation flags, and raw
  event logs were not included in the pre-evaluation seal. Candidate patches and
  reports reproduce, but the exact treatment cannot be rerun from the archive alone.
- Seal-before-hidden ordering is an operator record, not a cryptographically
  timestamped or mechanically enforced guarantee.
- All controls could inspect the complete authoritative Node implementation, making
  the task mechanically tractable.
- The unstructured multi-agent control was allowed up to 40 contexts but chose one
  context for Cobalt and four for Amber and Jade.
- Run wall time is measured from event-log lifetime and summed across paired runs;
  calendar time was lower because runs overlapped.
- The first sandbox-invalid attempt was discarded rather than counted because none
  of its variants could execute the declared oracle.
- Review precision and pattern-transfer rates cannot be reconstructed reliably from
  the fixed aggregate traces.

## Blind official evaluation of the 0.2 patch loop — July 2026

### Blind protocol fixed before coding

Tasks came from
[SWE-bench Verified](https://www.swebench.com/SWE-bench/guides/datasets/). Before
the coding agents or prompt creator inspected task-specific evaluator metadata, a
deterministic script selected five repository-diverse tasks, excluding the
repositories used in the earlier study. The selector used published difficulty
strata and then discarded that field; difficulty never entered a coding prompt.

The prompt-construction boundary was executable rather than informal:

- `scripts/select_evaluation_tasks.py` emitted only `problem_statement`, `repo`,
  and `base_commit` into a clean manifest.
- `scripts/render_evaluation_prompt.js` rejected every task object containing any
  additional field. Its allowlist has regression tests.
- Neither coding variant received an instance ID, difficulty, hint, gold patch,
  evaluator patch, test identifiers, expected failure categories, repository
  history, remote, or internet access.
- Every task started from a history-free copy of the declared base commit.
- The Bun Loop treatment and single-agent control used the same model and the same
  three-field task prompt. The treatment loaded the skill and used real isolated
  implementer, reviewer, and fixer contexts; the control used one fresh coding
  context with no skill or delegation.
- All ten candidate patches were copied to a separate sealed directory before the
  evaluator reloaded the dataset to map tasks to official instance IDs.
- `scripts/seal_evaluation.py` now records the clean-manifest and candidate hashes
  that future runs must create at that boundary.
- `scripts/build_evaluation_predictions.py` performed that mapping and generated
  predictions for the official SWE-bench Docker harness.

The prompt renderer enforces the three-field object boundary. Filesystem and agent
isolation kept evaluator data outside the coding runs, but that access chronology
was procedural rather than independently timestamped. The committed SHA-256 seal
was reconstructed from the preserved sealed directory after evaluation, so it
proves the archived bytes are internally consistent, not when evaluator access
occurred. Current tooling requires a seal to verify all ten patch hashes before it
loads evaluator data, preventing post-seal mutation in future runs. The fixed
treatment wrapper necessarily tells Bun Loop to use the skill; it adds no
task-specific information.

The exact fixed treatment and control wrappers are archived in `protocol.json`.
The dataset is pinned to revision
`91aa3ed51b709be6457e12d00300a6a596d4c6a3` (dataset fingerprint
`24e4847db36d5b81`) and was loaded with `datasets` 5.0.0. The clean manifest,
candidate patches and usage records, prediction JSONL, seal, official aggregate
reports, and official per-instance reports are preserved under
`evaluation/blind-2026-07/`. The machine-readable study summary is
`evaluation/blind-2026-07.json`.

### Official results

`F2P` is the number of originally failing tests that passed. `P2P` is the number
of regression tests that remained passing. “Resolved” requires every official
gate to pass.

| Task | Difficulty | Bun Loop F2P / P2P | Single agent F2P / P2P | Resolved |
|---|---:|---:|---:|---:|
| `sympy__sympy-13878` | >4 hours | 0/1 · 19/19 | 1/1 · 19/19 | Bun 0 · control 1 |
| `sphinx-doc__sphinx-7590` | >4 hours | 0/1 · 24/24 | 0/1 · 24/24 | Bun 0 · control 0 |
| `astropy__astropy-13398` | 1–4 hours | 0/4 · 63/68 | 0/4 · 63/68 | Bun 0 · control 0 |
| `pytest-dev__pytest-10356` | 1–4 hours | 0/1 · 79/79 | 0/1 · 79/79 | Bun 0 · control 0 |
| `pylint-dev__pylint-8898` | 1–4 hours | 0/1 · 18/18 | 0/1 · 18/18 | Bun 0 · control 0 |
| **Total** | | **0/5 tasks** | **1/5 tasks** | **Bun −1** |

Patch application and harness setup succeeded for every prediction. The result is
not caused by an evaluator infrastructure error; the archived aggregate reports
record five submitted and completed instances, zero empty patches, and zero errors
for both variants.

### Cost

Token counters are totals reported by the coding runs. Cached input is included in
the input total. “Contexts” counts the fresh coding contexts used by each variant.

| Task | Bun input / output | Control input / output | Bun contexts / fix rounds | Control contexts |
|---|---:|---:|---:|---:|
| SymPy | 2,691,937 / 6,846 | 838,609 / 8,792 | 13 / 3 | 1 |
| Sphinx | 1,611,253 / 6,262 | 313,456 / 4,271 | 10 / 2 | 1 |
| Astropy | 2,451,425 / 7,650 | 270,147 / 3,918 | 12 / 3 | 1 |
| pytest | 951,122 / 5,702 | 353,548 / 3,179 | 9 / 2 | 1 |
| Pylint | 1,005,547 / 4,223 | 403,413 / 4,766 | 6 / 1 | 1 |
| **Total** | **8,711,284 / 30,683** | **2,179,173 / 24,926** | **50 / 11** | **5** |

Bun Loop used 4.0× the input tokens and 10× the contexts. Reasoning-token counters
are not compared because aggregation across delegated contexts is not equivalent
to a single context. Precise wall-clock duration was not captured.

### What failed

The negative result exposed a consistent process defect. Adversarial reviewers
often found real edge cases, but the loop expanded the patch before proving the
exact primary contract:

- exact symbolic structure or precedence was replaced by behavior that appeared
  equivalent but was observably different;
- reviewers pursued speculative hostile inputs while missing the required order;
- narrow compatibility changes became generalized parsers and accidentally made
  previously invalid inputs valid;
- local parallel implementations were added instead of extending the repository's
  shared parser or canonical state model;
- patches grew through review rounds without reducing the official primary
  failures, especially when local dependency limitations prevented executable
  confirmation.

The reviewers were useful defect generators, but defect generation is not the same
as task correctness. In this sample, the extra search increased cost and candidate
complexity without improving the resolved rate.

### Lessons carried into 0.3

The 0.3 workflow retains these checks as conditional review rubrics rather than
mandatory ceremony for every patch:

- primary-contract reconstruction and exact observable semantics before edge-case
  expansion;
- independent reviewer derivation of expected output rather than treating
  author-added tests as the oracle;
- identification of the repository-owned authoritative abstraction and sibling
  frontends before implementation;
- negative compatibility controls for behavior that must remain rejected;
- early blocking when required runtime evidence is unavailable and review cannot
  supply an independent executable oracle.

Version 0.3 also removes recursive reviewer cascades and mandatory global `CLEAN`
reviews. Executable item and integration oracles now control completion. These
changes are hypotheses derived from failure analysis, not evidence of superiority.

### Limitations

- Five tasks are enough to falsify a quality-gain claim for this run, not to
  estimate a stable win rate.
- All selected repositories are Python projects.
- SWE-bench Verified is public and may appear in model training data.
- This is one deterministic task sample and one run per variant, not repeated
  seeds.
- The same model powered both variants, but orchestration changes its available
  context and effective compute.
- Coding environments lacked some project dependencies. Agents reported those
  blockers honestly; the official evaluator environments were complete.
- Token use is reported, but wall-clock time and monetary cost were not captured.
- The original access chronology was not cryptographically timestamped. Archived
  hashes verify artifact integrity, not absence of prior evaluator access.

## Earlier contaminated exploratory study

Two earlier tasks compared Bun Loop with a single coding agent in local compatible
environments. The root evaluator had already seen `FAIL_TO_PASS` identifiers before
the prompts were finalized and converted those identifiers into behavior-category
hints. Both variants received the same hints, but equal contamination does not make
the study blind or official.

| Task | Variant | Local external F2P | Regression gate | Outcome |
|---|---|---:|---:|---|
| `pydata__xarray-6992` | Bun Loop 0.1.0 | 0/12 | 850 passed, 1 baseline-environment failure | Failed |
| `pydata__xarray-6992` | Single agent | 0/12 | 850 passed, 1 baseline-environment failure | Failed |
| `django__django-15957` | Bun Loop 0.2.0 | 4/4 | 113/113 full module | Evaluator passed; final review capacity blocked |
| `django__django-15957` | Single agent | 4/4 | 113/113 full module | Passed |

The xarray failure motivated causal-surface maps, behavior matrices, and inverse
operation checks: both variants patched the observed mutation site while missing
the wider state transition. In Django, Bun Loop reviewers found additional
plausible defects and drove five material fix rounds, but the resulting patch was
much larger and final independent review contexts were unavailable. The simple
control was smaller and passed the same evaluator. This study showed that gates can
stop unsupported completion; it did not show an outcome advantage.

## Next evaluation

The next Factory study should preserve the same three-field prompt boundary,
three-way control design, sealing, and hidden evaluation while changing the scale
and information structure:

- a queue large enough that preparation and a three-item trial are at most one
  quarter of expected work;
- partial or noisy item oracles plus a stronger integration oracle;
- cross-item dependencies and repeated defect classes appearing across many later
  items;
- finding-level traces that permit review-precision and pattern-transfer metrics;
- repeated seeds, wall-clock measurement, and a budget large enough to represent
  the declared per-item topology honestly.

Patch Mode still needs a separate new blind ticket evaluation because the Factory
fixture does not validate it. Do not promote either mode as an accuracy improvement
until it beats matched controls by enough to justify its cost.
