# Evaluation

This document reports both successful and failed evidence. The primary study is a
blind, paired evaluation on five previously unused SWE-bench Verified tasks using
the official Docker harness. It found no quality gain from Bun Loop: the skill
resolved 0/5 tasks and the single-agent control resolved 1/5, while Bun Loop used
about four times as many input tokens. Bun Loop should therefore be treated as an
experimental workflow, not a demonstrated accuracy improvement.

An earlier two-task exploratory study is retained below because its contamination
and failures informed the workflow, but it is not a standard benchmark result.

## Blind official evaluation — July 2026

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

### Workflow changes prompted by this study

The skill now requires:

- primary-contract reconstruction and exact observable semantics before edge-case
  expansion;
- independent reviewer derivation of expected output rather than treating
  author-added tests as the oracle;
- identification of the repository-owned authoritative abstraction and sibling
  frontends before implementation;
- negative compatibility controls for behavior that must remain rejected;
- a complexity ratchet that stops and re-audits growing patches without measurable
  primary progress;
- early blocking when required runtime evidence is unavailable and review cannot
  supply an independent executable oracle.

These changes are hypotheses derived from failure analysis. They require another
fresh blind evaluation; they are not evidence that the skill is now superior.

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

Keep the same three-field prompt boundary and official harness, then run a new
preregistered sample after the workflow changes above. Priorities are:

- at least five new repository-diverse tasks that do not overlap either study;
- Rust, TypeScript, or Go work to reduce Python-only conclusions;
- a parser or compiler task, an async or concurrent state-machine bug, and a
  backward-compatible multi-file migration;
- repeated seeds and matched hard budgets;
- wall-clock, token, context, patch-size, and fix-round measurements.

Do not promote the workflow as an accuracy improvement unless repeated blind
results show a benefit large enough to justify its additional cost.
