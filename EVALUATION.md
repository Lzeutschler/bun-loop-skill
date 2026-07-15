# Evaluation

This document records exploratory comparisons of Bun Loop against a single coding
agent. It reports failures, cost, and evaluation contamination as well as successes.
These runs are not blind evaluations or valid standard SWE-bench scores. Two tasks
are also far too few for a statistical claim; they are diagnostic evidence used to
improve the workflow.

## Method

Tasks came from
[SWE-bench Verified](https://www.swebench.com/SWE-bench/guides/datasets/), which
provides a real issue, a fixed repository commit, a solution patch, and a separate
evaluator patch.

For each task, two variants received the same information and started from the same
base commit. However, before their prompts were finalized, the root evaluator had
seen the SWE-bench `FAIL_TO_PASS` test identifiers. The prompts did not include the
test code or expected implementation, but they did include behavior categories
derived from those identifiers:

- xarray: dropping, converting, and renaming indexes, plus DataArray and groupby
  behavior;
- Django: reverse foreign keys, both many-to-many directions, and reversed
  ordering.

The procedure was:

1. Create two history-free snapshots from the same base commit.
2. Give both variants the issue statement, repository, and the same derived
   behavior-category hints described above.
3. Run one variant through Bun Loop and the other through one coding agent without
   the skill or delegation.
4. Keep the gold solution and evaluator-patch contents outside the agents' shared
   filesystem until both variants stop editing.
5. Replace agent-authored tests with the external evaluator tests, then run the
   same fail-to-pass and regression gates against both patches.
6. Remove all temporary repositories and environments after recording aggregate
   results.

The coding agents were prohibited from inspecting sibling fixtures, upstream
history, SWE-bench data, or the internet. The evaluator never used the gold
solution to modify either candidate. Hiding the gold code does not undo the leaked
test-category information: this is a controlled A/B comparison with the same hints
on both sides, not a solve-from-issue-only benchmark.

The fail-to-pass counts below are local evaluator outcomes. They must not be cited
as official SWE-bench benchmark scores because the prompts were contaminated by
evaluator metadata and the official container harness was not used.

## Results

| Task | Difficulty | Variant | External fail-to-pass (local) | Regression gate | Outcome |
|---|---:|---|---:|---:|---|
| `pydata__xarray-6992` | >4 hours | Bun Loop 0.1.0 | 0/12 | 850 passed, 1 baseline-environment failure | Failed |
| `pydata__xarray-6992` | >4 hours | Single agent | 0/12 | 850 passed, 1 baseline-environment failure | Failed |
| `django__django-15957` | 1–4 hours | Bun Loop 0.2.0 | 4/4 | 113/113 full module | Evaluator passed; process blocked at final review capacity |
| `django__django-15957` | 1–4 hours | Single agent | 4/4 | 113/113 full module | Passed |

## What the results support

These two runs do not show that Bun Loop produces better task outcomes than a
single agent. Both variants failed xarray. Both passed the external Django
evaluator, while Bun Loop expanded into a much larger multi-module candidate and
then correctly stopped as blocked because it could not obtain the final independent
reviews.

The narrower evidence is that the orchestration gates worked: reviewers found
concrete additional Django failure modes, separate fixers addressed accepted
findings, and missing final evidence was not mislabeled as success. Whether that
extra search improves production outcomes often enough to justify its cost remains
unproven.

### xarray: invariant repair

The issue reported that `Dataset.reset_index()` could leave more coordinate names
than variables. Both variants made the reproduction and their own broad test suites
pass by removing stale coordinate names at the observed mutation site. Both failed
all 12 external behavior tests.

The gold change modeled `set_index()` and `reset_index()` together and rewrote the
state transitions for dropping, converting, and renaming index variables. Bun
Loop's reviewers found an additional sequence-valued index-key bug, but none
challenged the local symptom patch or mapped every producer of the invariant.

This failure produced version 0.2.0's requirements for:

- a causal-surface map of all invariant writers and consumers;
- a behavior matrix across topologies, flags, and inverse operations;
- exact postconditions rather than “the exception disappeared”;
- presumptive rejection of narrow symptom patches until a causal audit clears
  them.

### Django: sliced prefetch

Both variants implemented per-parent SQL window filtering and passed the four
external evaluator tests plus the complete 113-test `prefetch_related` module.

Bun Loop continued adversarially after the initial green suite. Independent
reviewers reproduced six additional defects across successive rounds:

1. `distinct()` over a row-multiplying join returned duplicates because window
   values defeated deduplication.
2. database routing was resolved unnecessarily and could differ between feature
   checks and execution;
3. reverse-FK querysets using `only()` or `defer()` caused an N+1 query regression;
4. normal relation caches could be reconstructed on a different database alias;
5. ordering by an annotation alias ranked against an unavailable same-select
   alias;
6. ordering by an existing window annotation generated illegal nested-window SQL.

Separate fixers addressed each accepted finding. The final candidate changed four
production files and passed 655 relevant tests with 14 skips and two expected
failures. It is deliberately not recorded as complete: after the last material fix,
the runtime repeatedly refused every attempt to create the two required fresh final
review contexts with `agent thread limit reached`. Bun Loop treated missing evidence
as a capability blocker rather than `CLEAN`.

The single-agent candidate stopped after its own green suite and the official
evaluator. Its 37-line production patch closely matches the upstream 26-line
solution and does not include the later adversarial protections. The extra
adversarial matrix is reported separately from the official SWE-bench score.

## Process cost

The broader Django investigation required one implementer, five material fix
rounds, and multiple fresh review contexts. The single-agent result required one
context. Bun Loop therefore incurred substantially higher runtime and context cost,
and this evaluation does not establish that the additional candidate complexity
was a net benefit.

Version 0.2.0 allows the last two fully integrated single-item reviews to serve as
the aggregate reviews. This avoids an automatically duplicated final pair, but each
material fix still correctly requires fresh review evidence.

## Limitations

- Prompt construction was contaminated by `FAIL_TO_PASS` identifiers. Giving both
  variants the same derived hints improves relative fairness but does not restore a
  blind or standard SWE-bench evaluation.
- Two Python tasks cannot establish a general win rate.
- SWE-bench Verified is public and may be present in model training data.
- Evaluation used local compatible environments instead of the official Docker
  harness. Three malformed xarray parameter directives were normalized, and the
  complete Django module replaced malformed pass-to-pass docstring fragments.
- The Django single-agent control reused a previously completed, unrelated coding
  context because the runtime would not create another fresh thread. It still had
  no skill, delegation, evaluator tests, or Django solution context.
- Non-SQLite database behavior in the extended Django candidate was reasoned about
  and reviewed but not executed locally.
- Wall-clock time and token usage were not captured, so context count is the only
  cost proxy.

## Next evaluation set

Before adding more tasks, future runs should:

- preregister prompts from issue text before any evaluator metadata is inspected;
- keep test identifiers, evaluator patches, gold patches, and expected failure
  categories inaccessible to both coding variants and their orchestrators;
- use a genuinely fresh control context for every task;
- record wall-clock time, token usage, context count, material fix rounds, and diff
  size so benefit can be compared with cost;
- use the same declared scope and hard loop budget for all repeated seeds.

Then add:

- a compiler or parser change with golden syntax tests;
- a concurrent state-machine or async lifetime bug;
- a multi-file migration with backward compatibility requirements;
- a Rust, TypeScript, or Go task to avoid Python-only conclusions;
- repeated seeds and a runtime that exposes enough fresh contexts to complete the
  final review gate.
