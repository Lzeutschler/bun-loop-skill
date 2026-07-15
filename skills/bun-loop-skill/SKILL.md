---
name: bun-loop-skill
description: >-
  Run an orchestrated multi-agent implementation, adversarial-review, fix, and
  verification loop for complex or high-risk software engineering tasks. Use
  explicitly with $bun-loop-skill, or implicitly for large refactors,
  migrations, compiler or test backlogs, cross-cutting bug fixes, and changes
  with substantial regression risk where independent implementation and review
  contexts materially improve confidence. Do not invoke implicitly for trivial
  edits, read-only questions, or tasks that
  do not authorize subagent collaboration.
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
- Stop and report a capability blocker if the runtime cannot provide independent
  subagent contexts. Do not weaken context isolation silently.

## Build the task contract

Inspect the repository and convert the request into a compact task contract before
delegating implementation. Record:

- the objective and externally observable success criteria;
- in-scope and out-of-scope behavior;
- constraints, compatibility requirements, and forbidden shortcuts;
- the supported input and environment domain, including which hostile or unusual
  values the public contract admits;
- the baseline state, including pre-existing user changes;
- targeted and integration verification commands;
- material risks and relevant source artifacts;
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

- behavioral correctness and acceptance-criteria mismatches;
- edge cases, state transitions, error paths, and partial failure;
- concurrency, re-entrancy, lifetime, ownership, and async boundaries;
- compatibility, security, performance, and resource regressions;
- missing, misleading, disabled, or weakened tests.

Keep findings inside the supported domain recorded in the task contract. Treat a
hostile or unusual value as relevant only when the public API or established
compatibility behavior admits it; otherwise reject it as scope expansion.

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
and fix rounds until no accepted finding remains or the stagnation rule fires.

### 4. Verify and close

After a clean review round, run the targeted verification commands against the
current integrated working tree. Mark the item `done` only when:

- every acceptance criterion is satisfied;
- every required command passes, or an unavailable command is reported as a
  blocker rather than assumed successful;
- no accepted review finding remains;
- the patch stays within the agreed scope and preserves existing work;
- no forbidden shortcut remains.

Otherwise create a bounded follow-up item or move the item back to `fixing`.

## Reject false progress

Treat compilation as evidence, not completion. Reject implementations that obtain
green output by adding stubs, placeholder returns, new unresolved TODOs, ignored
errors, disabled checks, weakened assertions, or deleted coverage.

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
same loop.

Declare completion only when the queue is empty, integration checks pass, both
final reviewers are clean, and no accepted finding or unexplained risk remains.
Report the completed work, verification evidence, review outcome, and any explicit
limitations in the final response.

Measure progress by shrinking failing checks, accepted findings, or unresolved work
items. If the same blocker persists or none of those measures improves for three
consecutive rounds, mark the affected work `blocked`. Report the evidence, three
attempts, and the exact user decision or external change needed. Escalate
immediately instead when continuing would require new authority or unsafe actions.
