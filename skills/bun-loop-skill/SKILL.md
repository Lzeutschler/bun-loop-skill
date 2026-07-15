---
name: bun-loop-skill
description: >-
  Run an orchestrated multi-agent implementation, adversarial-review, fix, and
  verification loop for complex or high-risk software engineering tasks. Use only
  when the user explicitly invokes $bun-loop-skill for a large refactor, migration,
  compiler or test backlog, cross-cutting bug fix, or other change with substantial
  regression risk where independent implementation and review contexts materially
  improve confidence. Do not invoke without explicit user authorization, for
  trivial edits, or for read-only questions.
---

# Bun Loop

Apply the implement-review-fix loop inspired by Jarred Sumner's
[Bun rewrite workflow](https://bun.com/blog/bun-in-rust). Keep authorship,
adversarial review, fixing, and orchestration in separate contexts.

## Preserve the operating contract

- Honor the user's scope, the current collaboration mode, repository instructions,
  approval requirements, and existing changes before starting the loop.
- Use real subagents. Never simulate implementer, reviewer, and fixer roles in the
  orchestrator context.
- Treat the agent that receives the task and loads this skill as the orchestrator,
  even when that agent is technically a subagent. Never infer that an unseen parent
  agent will orchestrate the loop.
- Coordinate work, adjudicate evidence, and decide state transitions as the
  orchestrator; do not author code, apply fixes, or originate a code review. Before
  changing any target file, spawn the implementer and wait for its handoff.
- Permit exactly one writing agent at a time. Reviewers must remain read-only.
- Set a hard loop budget before delegation. Budget work items, material fix rounds,
  fresh contexts, and expensive verification runs from the task's risk and the
  runtime's documented limits. Unless the user sets a different bound, allow at
  most three material fix rounds per work item. Reserve two fresh contexts for the
  post-fix final review; do not consume them on a redundant aggregate pair when the
  single-item reuse rule applies.
- Treat the budget as a stop condition, never as permission to waive a finding,
  skip evidence, or declare incomplete work done. Ask the user to expand the
  budget, reduce scope, or accept a blocked handoff when the cap is reached.
- Stop and report a capability blocker if the runtime cannot provide independent
  subagent contexts. Do not weaken context isolation silently.

## Build the task contract

Inspect the repository and convert the request into a compact task contract before
delegating implementation. Record:

- the objective and externally observable success criteria;
- in-scope and out-of-scope behavior;
- a scope frontier naming allowed paths, public behaviors, dependencies, and the
  conditions under which discovering new work requires user authorization;
- constraints, compatibility requirements, and forbidden shortcuts;
- the supported input and environment domain, including which hostile or unusual
  values the public contract admits;
- the baseline state, including pre-existing user changes;
- targeted and integration verification commands;
- material risks and relevant source artifacts;
- the loop budget: maximum work items, material fix rounds per item, fresh agent
  contexts, and expensive verification runs, with the reason for each bound;
- a causal-surface map for each broken invariant: every operation that creates,
  mutates, serializes, or consumes the affected state, not only the crash site;
- a behavior matrix covering materially different input topologies, operation
  modes, flags, and cross-operation round trips;
- an ordered queue of bounded work items with owned paths and dependencies.

Give each work item an identifier, objective, acceptance criteria, allowed paths,
verification commands, dependencies, and one of these states:

`queued -> implementing -> reviewing -> fixing -> verifying -> done | blocked`

For a large or expensive change, run the smallest representative work item as a
trial. Complete its full loop, correct the active task contract if necessary, and
only then expand to the remaining queue.

## Run one work item

### 1. Delegate implementation

Spawn one implementer in a bounded context. Use no inherited conversation history
when the collaboration runtime supports that option. Pass only the task contract,
the current work item, relevant source artifacts, allowed paths, and verification
commands. Instruct the implementer to:

- make the complete production change within the assigned scope;
- repair the state transition that creates the invalid state, after inspecting
  sibling writers and inverse operations; do not merely sanitize the observed
  consumer or subtract stale bookkeeping at the crash site;
- preserve unrelated and pre-existing changes;
- run the strongest affordable targeted checks;
- avoid self-review and avoid editing outside owned paths;
- return changed paths, acceptance-criteria mapping, command results, and known
  residual risks.

Wait for the implementer to finish and capture an item-specific review bundle:
the task contract, relevant baseline code, changed paths, patch, and raw verification
output. Exclude the implementer's private reasoning and persuasive explanation.

### 2. Run adversarial reviews

Spawn two reviewers concurrently in fresh contexts with no inherited conversation
history. Keep the orchestrator alive until both return. Give each the same review
bundle without the other reviewer's output or the expected answer. Tell each
reviewer to assume that the change is wrong and to find concrete ways it violates
the contract, regresses behavior, or fails in use.

Require reviewers to inspect, reason, and run read-only checks without editing.
Prioritize, where relevant:

- causal completeness: whether every producer of the violated invariant and each
  inverse or round-trip operation follows one coherent state model;
- exact postconditions across the task contract's behavior matrix, including
  variable identity, ownership, dimensions, metadata, and indexes—not merely
  absence of the reported exception;
- behavioral correctness and acceptance-criteria mismatches;
- edge cases, state transitions, error paths, and partial failure;
- concurrency, re-entrancy, lifetime, ownership, and async boundaries;
- compatibility, security, performance, and resource regressions;
- missing, misleading, disabled, or weakened tests.

Keep findings inside the supported domain recorded in the task contract. Treat a
hostile or unusual value as relevant only when the public API or established
compatibility behavior admits it; otherwise reject it as scope expansion.

For an invariant or state-transition bug, require each reviewer to inspect all
assignments to the affected state fields and exercise at least one inverse or
round-trip path. A narrow patch at the reported method is presumptively incomplete
until this causal audit demonstrates otherwise. Do not use current buggy output as
the expected result merely because existing tests encode it; derive postconditions
from the public contract, neighboring operations, and the invariant model.

Reject vague style feedback. Require every finding to contain:

```text
severity: critical | high | medium | low
location: path and tight line or symbol reference
failure_mode: what breaks and under which conditions
evidence: reasoning, reproduction, or command output
required_correction: the behavior that must change
```

Allow `CLEAN` only after an explicit review finds no actionable issue. Reviewers
must report findings, not implement fixes.

Never treat a missing or stalled reviewer as `CLEAN`. If a reviewer stops making
progress beyond the runtime's normal bounded wait, interrupt it and replace it once
with a fresh reviewer receiving the same bundle. If the replacement also stalls,
mark validation blocked and report the missing independent evidence.

Treat a hard fresh-context creation error as a capacity signal, not an ordinary
stall. Try the intended spawn once and, when the runtime supports an independent
alternate coordinator, one alternate spawn path. If both return the same capacity
error, stop retrying, preserve the current patch and evidence, and mark validation
blocked. Reusing a context that has seen implementation or another review does not
satisfy the missing review.

### 3. Adjudicate and fix

Have the orchestrator deduplicate the two reports and evaluate their evidence.
Accept findings that are reproducible, logically demonstrated, or required by the
task contract. Reject duplicates, unsupported claims, and scope-expanding
preferences with a short reason. Do not mark an accepted finding as waived.

When accepted findings exist, spawn a separate fixer in a fresh context. Pass the
task contract, current patch, accepted findings, allowed paths, and verification
commands, but not the implementer's reasoning. Instruct the fixer to resolve every
accepted finding without broadening scope and to return the same evidence fields as
the implementer.

Review every fixer patch again with two new adversarial reviewers. Repeat review
and fix rounds until no accepted finding remains, the hard loop budget is reached,
or the stagnation rule fires. A finding about behavior directly changed by the
current patch remains in scope even when its failure appears in a neighboring file.
For unrelated pre-existing defects or material expansion beyond the scope frontier,
record evidence and request authorization instead of silently growing the task.

### 4. Verify and close

After a clean review round, run the targeted verification commands against the
current integrated working tree. Mark the item `done` only when:

- every acceptance criterion is satisfied;
- the behavior matrix validates exact postconditions, not only green exit status
  or the original reproduction;
- every required command passes, or an unavailable command is reported as a
  blocker rather than assumed successful;
- no accepted review finding remains;
- the patch stays within the agreed scope and preserves existing work;
- no forbidden shortcut remains.

Otherwise create a bounded follow-up item or move the item back to `fixing`.
If doing so would exceed the loop budget, mark the item `blocked` and report the
remaining gate, evidence collected, budget consumed, and smallest decision that
would permit another bounded iteration.

## Reject false progress

Treat compilation as evidence, not completion. Reject implementations that obtain
green output by adding stubs, placeholder returns, new unresolved TODOs, ignored
errors, disabled checks, weakened assertions, or deleted coverage.

Reject symptom patches that make one reproduction pass while leaving the same
invalid state constructible through a sibling writer, inverse operation, flag, or
input topology. Expand verification from the causal-surface map before accepting
such a patch.

Reject workaround code that needs a paragraph-length comment to argue that it is
safe. Prefer code whose invariants are visible in its types, control flow, and
tests. Keep concise comments that explain genuinely non-obvious external contracts.

When the same defect pattern appears more than once, correct the active process:
update the remaining work-item contract and reviewer rubric, add an appropriate
verification gate, and requeue completed items that may share the defect. Do not
self-modify this installed skill unless the user explicitly requests that change.

## Protect the shared workspace

- Inspect the worktree before delegation and identify user-owned changes.
- Never allow overlapping writers or ambiguous path ownership.
- Never use `git stash`, destructive reset/checkout operations, or commands that
  discard another agent's or the user's work.
- Do not commit, push, rewrite history, or create pull requests unless the user has
  explicitly authorized that action.
- Avoid broad formatters, code generators, or slow global commands inside parallel
  phases unless the orchestrator has established exclusive ownership.

## Finish the queue

After all work items are `done`, run the full affordable integration checks. Build
an aggregate review bundle for the complete diff and send it to two new adversarial
reviewers. Convert any accepted integration finding into a new work item and run the
same loop. For a single-item queue only, the item's last two fresh reviews may also
serve as the aggregate reviews when they received the exact final diff, the causal
surface and behavior matrix, and the full integration output; otherwise run two new
aggregate reviews.

Declare completion only when the queue is empty, integration checks pass, both
final reviewers are clean, and no accepted finding or unexplained risk remains.
Report the completed work, verification evidence, review outcome, and any explicit
limitations in the final response.

Measure progress by shrinking failing checks, accepted findings, or unresolved work
items. If the same blocker persists or none of those measures improves for three
consecutive rounds, mark the affected work `blocked`. Report the evidence, three
attempts, and the exact user decision or external change needed. Escalate
immediately instead when continuing would require new authority or unsafe actions.
Also stop at any declared hard budget even when progress is measurable. Report
progress separately from completion and never convert budget exhaustion into a
clean result.
