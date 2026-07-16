---
name: bun-loop-skill
description: >-
  Run an oracle-driven multi-agent engineering loop with separate implementer,
  adversarial-reviewer, fixer, and orchestrator contexts. Use only when the user
  explicitly invokes $bun-loop-skill, optionally with `factory` for a repeatable
  migration, port, compiler-error queue, or test backlog, or with `patch` for one
  high-risk change set. A plain explicit invocation selects Factory Mode only when
  work is repeatable, an executable oracle exists, and process improvements can be
  reused, and preparation can amortize across the queue; otherwise it selects Patch
  Mode. Do not invoke implicitly, for trivial edits, or for read-only questions.
---

# Bun Loop

Apply the oracle-driven engineering loops inspired by Jarred Sumner's
[Bun rewrite workflow](https://bun.com/blog/bun-in-rust). Treat adversarial review
as a bug-finding filter. Treat executable oracles—tests, compilers, linters,
reproductions, parity checks, or benchmarks—as the source of completion truth.

## Route the explicit request

Honor an explicit `$bun-loop-skill factory` or `$bun-loop-skill patch` selection.
For a plain `$bun-loop-skill` invocation, choose Factory Mode only when all four
conditions hold:

1. A source can generate multiple structurally similar work items, such as files,
   compiler diagnostics, failing tests, stack traces, or migration records.
2. A repeatable executable oracle can be established before bulk implementation.
3. A correction to the active workflow can improve remaining items of the same
   class.
4. Preparation plus the three-item trial is expected to consume no more than one
   quarter of the total engineering effort. When this amortization is unclear,
   prefer Patch Mode and report the estimate.

Otherwise choose Patch Mode. Do not use either mode for a trivial edit or a
read-only question; explain that the skill's multi-agent cost is not justified.
If the user explicitly requests Factory Mode but an oracle cannot be established,
complete the preparation audit, mark the run `blocked`, and report the missing
oracle instead of silently falling back.

State the selected mode and the evidence for the selection before delegation.

## Preserve the common operating contract

- Honor repository instructions, user scope, approval requirements, and existing
  changes.
- Use real independent subagent contexts. The agent that loads this skill is the
  orchestrator, even if it is itself a subagent.
- Keep roles separate: the orchestrator coordinates; implementers and fixers write;
  reviewers remain read-only. The orchestrator must not author the production
  change or originate review findings.
- Permit one writer per work item. Never allow overlapping writers in one working
  tree. Use parallel writers only under Factory Mode's isolation rules.
- Give reviewers the item contract, relevant reference artifacts, baseline or
  source material, final diff, and raw oracle output. Exclude the implementer's
  reasoning and persuasive explanation.
- Preserve unrelated work. Never use `git stash`, destructive reset or checkout,
  or commands that discard another agent's or the user's changes. Do not commit,
  push, or open a pull request without explicit authorization.
- Set a context, writer, and expensive-oracle budget before starting. A budget is a
  stop condition, never permission to weaken evidence or declare incomplete work
  done.
- Stop with a capability blocker when independent contexts or required isolation
  are unavailable. Never simulate missing roles in the orchestrator context.

## Use evidence consistently

For each item, define a compact contract containing:

- objective, owned paths, and observable acceptance criteria;
- relevant mapping guide, invariants, or source-of-truth artifacts;
- targeted item oracle and the full integration oracle;
- forbidden shortcuts and compatibility constraints;
- dependencies, current queue state, and the declared growth boundary.

Use evidence in this order: explicit user acceptance criteria; documented public
behavior and task statement; independent executable oracle; baseline tests and
repository conventions, excluding alleged defects; then author-added tests. Block
for clarification when higher-ranked evidence conflicts or leaves a material
semantic decision unresolved.

Reviewers must return `CLEAN` or findings in this form:

```text
severity: critical | high | medium | low
location: path and tight line or symbol reference
failure_mode: what breaks and under which conditions
evidence: reasoning, reproduction, or command output
required_correction: the behavior that must change
```

Accept only relevant findings supported by reproduction, command output, a logical
demonstration, or the item contract. Deduplicate reports and record a short reason
for rejecting unsupported, duplicate, or scope-expanding findings. Review activity
and `CLEAN` labels are not executable evidence.

Read [references/review-rubrics.md](references/review-rubrics.md) only when the
item involves the corresponding risk class: state transitions, exact structural
semantics, parsers or compatibility boundaries, async lifetimes, or migrations.
Do not load every rubric by default.

Reject false progress in both modes:

- stubs, placeholder returns, new unresolved TODOs, ignored errors, or compile-only
  substitutions for required behavior;
- deleted, disabled, skipped, or weakened tests and assertions;
- unrequested generalization that broadens a syntax or compatibility boundary;
- a workaround requiring a paragraph-length comment to argue that it is safe;
- a parallel implementation of a repository-owned parser, state model, or
  algorithm merely to keep a patch local.

## Run Factory Mode

Use Factory Mode as an engineering production system with an inner item loop and an
outer process-improvement loop.

### 1. Prepare the factory

Spawn one mapper to inspect the request and repository. Have it produce compact
active artifacts:

- a porting or migration guide and explicit invariants;
- a deterministic queue generator and initial ordered queue;
- item and full-integration oracle commands;
- ownership partitions, dependencies, and safe integration order;
- an initial review rubric containing only relevant risk classes;
- limits for contexts, writer lanes, oracle runs, and item growth.

Keep these artifacts in task scratch space unless the user-authorized project scope
includes writing them into the repository. Send the artifacts to two fresh,
read-only adversarial reviewers. Spawn one fresh fixer to consolidate accepted
preparation findings. The orchestrator adjudicates evidence but does not rewrite the
artifacts itself.

Require the queue generator and item oracle to work before bulk implementation.
When either is unavailable, mark preparation `blocked` with the exact missing
capability.

### 2. Run a three-item trial

Select three items representing materially different dependencies or risk classes.
For each trial item:

1. Spawn one implementer for that item only.
2. Run the item oracle and capture raw output.
3. Spawn two fresh reviewers concurrently.
4. Adjudicate their evidence and spawn one fresh fixer when accepted findings exist.
5. Run the item oracle again against the integrated result.

After all three, update the active mapping guide, queue rules, ownership, review
rubric, and parallelism only through a mapper/fixer handoff backed by trial evidence.
Freeze the resulting factory contract before processing the remaining queue.

### 3. Process the queue

For each item, use this state flow:

`queued -> implementing -> reviewing -> fixing -> verifying -> done | requeued | blocked`

The item loop is:

1. One implementer makes the complete bounded change and runs the affordable item
   oracle.
2. Two fresh reviewers inspect the same final diff and raw oracle output in parallel.
3. The orchestrator adjudicates; one fresh fixer applies all accepted findings.
4. Integrate the patch in the declared order and run the item oracle.
5. Mark the item `done` only when its oracle and acceptance criteria pass and no
   accepted finding remains.

Do not recursively launch another reviewer pair merely because a fixer wrote code.
Create a bounded follow-up item only when the fixer materially crosses the item's
declared growth boundary or the oracle still fails. The new item must name the
remaining failure and use the same queue discipline.

### 4. Improve the active process

Classify evidenced failures. When the same failure class occurs in at least two
items, treat it as a process defect:

- spawn a mapper/fixer to update the active guide, queue generator, or relevant
  review rubric;
- identify completed or in-flight items exposed to that class and requeue only
  those items;
- apply the correction to all remaining items;
- leave this installed skill unchanged.

Measure progress by fewer oracle failures and fewer unresolved queue items. If the
same blocker persists or neither measure improves across three consecutive attempts,
mark the affected work `blocked` with the attempts and required external decision.

### 5. Parallelize only isolated work

In a shared working tree, keep exactly one writer active. After the trial succeeds,
use up to four concurrent writer lanes only when the runtime provides isolated
worktrees or equivalent filesystems, every lane owns non-overlapping paths, and the
orchestrator has a deterministic integration order. Reviewers remain read-only.

Integrate lane patches one at a time and run the relevant item oracle after each
integration. If safe isolation is unavailable, continue sequentially; do not treat
reduced parallelism as a blocker.

### 6. Finish the factory

After the queue is empty, run the full integration oracle. Completion requires:

- the generated queue is empty;
- the full oracle passes;
- no test or check was removed, skipped, disabled, or weakened;
- every accepted finding has been addressed;
- remaining limitations and risks are reported.

Do not require an additional global pair of `CLEAN` reviews. If the full oracle
produces failures, convert each reproducible failure group into new queue items.
Review cannot substitute for an unavailable or failing full oracle.

## Run Patch Mode

Use Patch Mode for one high-risk change set. Do not create Factory artifacts, a
bulk queue, a trial, or a global final review.

1. Build the compact item contract and declare a standard budget of four fresh role
   contexts: one implementer, two parallel reviewers, and one fixer. The orchestrator
   context is not counted.
2. Spawn the implementer to make the complete change and run targeted checks.
3. Send the final diff and raw check output to the two reviewers concurrently.
4. Adjudicate supported findings. Spawn the fixer even when there are no accepted
   findings; in that case it performs no edit and confirms the handoff.
5. Run targeted and affordable integration oracles against the resulting tree.

Complete when the acceptance criteria and oracles pass, no accepted finding remains,
and no forbidden shortcut exists. Re-enter review only when the fixer materially
expanded the declared change boundary or an oracle still fails. Represent the
remaining failure as one bounded follow-up item and keep the total fresh role-context
budget at or below seven. Otherwise stop as `blocked` rather than adding speculative
review rounds.

## Report the outcome

Report the selected mode, completed and blocked items, oracle commands and raw
outcomes, accepted and rejected review counts, contexts and fix rounds used, process
changes made during Factory Mode, and explicit residual risks. Distinguish progress,
completion, and budget or capability blockers.
