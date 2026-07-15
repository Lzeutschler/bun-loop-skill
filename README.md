<div align="center">

# Bun Loop

**Implement. Review adversarially. Fix. Repeat until the evidence says done.**

[![Validate](https://github.com/Lzeutschler/bun-loop-skill/actions/workflows/validate.yml/badge.svg)](https://github.com/Lzeutschler/bun-loop-skill/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Agent Skill](https://img.shields.io/badge/Agent%20Skill-portable-181717.svg)](skills/bun-loop-skill/SKILL.md)

</div>

---

## What is Bun Loop?

Bun Loop is a portable agent skill for complex, high-risk software work. It turns
one coding agent into an orchestrator that delegates implementation, sends the
result to two independent adversarial reviewers, assigns accepted findings to a
fresh fixer, and repeats until explicit quality gates pass.

The workflow is inspired by Jarred Sumner's
[Bun rewrite in Rust](https://bun.com/blog/bun-in-rust): separate the author from
the reviewers, assume plausible code is wrong, and improve the process whenever a
defect pattern repeats.

## How it works

```mermaid
flowchart LR
  Contract["Task contract"] --> Queue["Bounded work item"]
  Queue --> Implementer["Implementer"]
  Implementer --> ReviewA["Adversarial reviewer A"]
  Implementer --> ReviewB["Adversarial reviewer B"]
  ReviewA --> Orchestrator["Orchestrator adjudicates evidence"]
  ReviewB --> Orchestrator
  Orchestrator -->|"Accepted findings"| Fixer["Fresh fixer"]
  Fixer --> ReviewA
  Orchestrator -->|"Clean + verified"| Done["Done"]
```

The skill enforces six ideas:

- **Split contexts:** implementers do not review their own work; reviewers do not
  inherit the implementer's reasoning.
- **Two adversarial reviews:** each reviewer tries to demonstrate how the patch
  breaks, regresses, or violates the task contract.
- **One writer at a time:** parallelism is used for read-only review, not competing
  edits in a shared worktree.
- **Evidence-based completion:** compilation is evidence, not completion. Tests,
  acceptance criteria, review findings, and integration checks determine done.
- **Fix the process:** repeated defect classes update the active contract and review
  rubric instead of being patched one by one forever.
- **Bound the loop:** scope, work items, fix rounds, fresh contexts, and expensive
  checks receive hard limits up front; exhausting a limit blocks the task instead
  of weakening a quality gate.

See [EVALUATION.md](EVALUATION.md) for the five-task blind SWE-bench Verified
comparison against a single coding agent. The current result is negative: Bun Loop
resolved 0/5 tasks versus 1/5 for the control while using about 4× the input tokens.

## Quick start

Install directly from GitHub with Node.js 18 or newer:

```bash
npx github:Lzeutschler/bun-loop-skill --claude --global
```

Replace `--claude` with your runtime and choose either `--global` or `--local`:

```bash
npx github:Lzeutschler/bun-loop-skill --codex --global
npx github:Lzeutschler/bun-loop-skill --cursor --local
npx github:Lzeutschler/bun-loop-skill --runtime claude,codex,cursor --global
```

Restart the runtime after installation so it rescans its skills directory.

## Installation layouts

The installer follows the flat, native skill layouts documented in
[GSD Core's runtime mapping matrix](https://github.com/open-gsd/gsd-core/blob/next/docs/reference/skill-mapping-matrix.md).
Unlike GSD's multi-artifact command and agent sources, Bun Loop is already a
standards-shaped skill with minimal `name` and `description` frontmatter, so the
same canonical `SKILL.md` can be copied without provider-specific prompt forks.

| Runtime | Flag | Global skills root | Project skills root |
|---|---|---|---|
| Claude Code | `--claude` | `~/.claude/skills/` | `.claude/skills/` |
| Codex | `--codex` | `~/.codex/skills/` | `.codex/skills/` |
| Cursor | `--cursor` | `~/.cursor/skills/` | `.cursor/skills/` |
| GitHub Copilot | `--copilot` | `~/.copilot/skills/` | `.github/skills/` |
| OpenCode | `--opencode` | `~/.config/opencode/skills/` | `.opencode/skills/` |
| Kilo | `--kilo` | `~/.config/kilo/skills/` | `.kilo/skills/` |
| Kimi | `--kimi` | `~/.config/agents/skills/` | `.agents/skills/` |
| Cline | `--cline` | `~/.cline/skills/` | Not supported by Cline |

Runtime configuration environment variables are respected: `CLAUDE_CONFIG_DIR`,
`CODEX_HOME`, `CURSOR_CONFIG_DIR`, `COPILOT_CONFIG_DIR`, `OPENCODE_CONFIG_DIR`,
`KILO_CONFIG_DIR`, `KIMI_CONFIG_DIR`, `CLINE_CONFIG_DIR`, and `XDG_CONFIG_HOME`.

Here, “supported” means the dependency-free installer knows the documented target
layout and the mapping has automated fixture coverage. It does not claim that every
runtime has been exercised end to end.

## Full-loop capability status

The full workflow additionally requires a runtime to expose independent subagent
contexts, two parallel read-only reviewers, a separate writing fixer, and enough
context capacity to complete the final review gate.

| Runtime | Installer/package status | Full Bun Loop execution status |
|---|---|---|
| Claude Code | Layout covered; plugin manifests statically validated | Not yet smoke-tested in a real Claude runtime |
| Codex | Layout covered; skill metadata validated | Five paired blind runs completed with the official harness; Bun Loop resolved 0/5 versus 1/5 for the control |
| Cursor | Layout covered | Not yet smoke-tested in a real Cursor runtime |
| GitHub Copilot | Layout covered | Not yet smoke-tested in a real Copilot runtime |
| OpenCode | Layout covered | Not yet smoke-tested in a real OpenCode runtime |
| Kilo | Layout covered | Not yet smoke-tested in a real Kilo runtime |
| Kimi | Layout covered | Not yet smoke-tested in a real Kimi runtime |
| Cline | Global layout covered | Not yet smoke-tested in a real Cline runtime |

Installation support cannot manufacture those orchestration capabilities. A runtime
that cannot provide them must produce a capability blocker instead of simulating
independent contexts. Runtime execution has been demonstrated in Codex, but the
blind evaluation did not demonstrate an accuracy benefit. Treat the project as an
experimental beta rather than a universal compatibility or quality claim.

## Other installation methods

### Interactive installer

Clone the repository and run the installer without flags:

```bash
git clone https://github.com/Lzeutschler/bun-loop-skill.git
cd bun-loop-skill
node bin/install.js
```

### Custom skills directory

```bash
node bin/install.js --target ~/.agents/skills
```

`--target` means “skills root”; the installer creates
`<target>/bun-loop-skill/` beneath it.

### Manual install without Node.js

Download or clone the repository, then copy the complete
`skills/bun-loop-skill/` directory beneath one of the skills roots in the table
above. Preserve the directory name and keep `SKILL.md` directly inside it:

```text
<runtime skills root>/
└── bun-loop-skill/
    ├── SKILL.md
    └── agents/
        └── openai.yaml
```

Restart the runtime after copying. The `agents/openai.yaml` file provides Codex UI
metadata and is harmless in runtimes that ignore it.

### Claude plugin marketplace

The repository includes `.claude-plugin/plugin.json` and
`.claude-plugin/marketplace.json`. Claude-compatible runtimes can add
`Lzeutschler/bun-loop-skill` as a custom marketplace source and install
`bun-loop-skill` through their native plugin UI.

## Installer commands

```text
--global          Install for the current user
--local           Install into the current project
--target <path>   Install into a custom skills directory
--uninstall       Remove only the managed bun-loop-skill directory
--dry-run         Print operations without changing files
--list-runtimes   Print supported runtime identifiers
--version         Print the installer version
--help            Show complete help
```

Examples:

```bash
# Preview without writing
npx github:Lzeutschler/bun-loop-skill --codex --global --dry-run

# Remove a global installation
npx github:Lzeutschler/bun-loop-skill --codex --global --uninstall
```

The installer stages updates beside the destination and swaps them into place. It
never modifies unrelated runtime configuration. Each CLI-managed installation gets
a `.bun-loop-install.json` marker. Replacement and uninstall require both that
marker and a matching `bun-loop-skill` manifest, and refuse symlinks,
non-directories, malformed markers, and unmarked folders.

This deliberately means the CLI will not replace or remove a manually copied or
legacy unmarked installation. Inspect and move or delete that directory yourself,
then install again to bring it under installer management.

## Using the skill

Invoke it explicitly for a complex task:

```text
Use $bun-loop-skill to migrate this subsystem while preserving behavior and
prove the result through independent adversarial reviews.
```

The beta is explicit-only: invoke `$bun-loop-skill` when you want to authorize its
multi-agent cost and workflow. It does not trigger implicitly, including for complex
tasks.

## Repository layout

```text
skills/bun-loop-skill/   Canonical portable skill
bin/install.js           User-facing installer CLI
lib/installer.js         Runtime layouts and safe file operations
scripts/validate.js      Repository and manifest validation
scripts/*evaluation*     Blind-evaluation selection and prompt-boundary tools
evaluation/              Machine-readable results and archived evaluation evidence
tests/                   Installer regression tests
.claude-plugin/          Claude plugin and marketplace metadata
.github/                 CI and contribution templates
```

## Development

```bash
npm install
npm run check
npm pack --dry-run
```

`npm run check` validates skill metadata and manifest version parity, then runs the
dependency-free Node test suite. Pull requests run the same checks on Linux, macOS,
and Windows.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and
[CHANGELOG.md](CHANGELOG.md) for project policies.

## Acknowledgements

- [Jarred Sumner's Bun rewrite](https://bun.com/blog/bun-in-rust) for the
  implement/review/fix loop and adversarial context separation.
- [GSD Core](https://github.com/open-gsd/gsd-core) for the professional,
  multi-runtime packaging model used as architectural inspiration.

## License

[MIT](LICENSE)
