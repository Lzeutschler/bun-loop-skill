# Contributing to Bun Loop

Thanks for helping make adversarial agent workflows more reliable and portable.

## Before opening a change

- Search existing issues first.
- Open an issue before changing the workflow contract, supported runtimes, or
  installer behavior.
- Keep pull requests focused on one problem.
- Never include credentials, private prompts, or unredacted agent transcripts.

## Development setup

```bash
git clone https://github.com/Lzeutschler/bun-loop-skill.git
cd bun-loop-skill
npm install
npm run check
```

The project uses only Node.js built-ins at runtime. Node.js 18 or newer is required.

## Making changes

### Skill behavior

Edit only `skills/bun-loop-skill/SKILL.md`; it is the canonical source copied to
every runtime. Preserve the two-key frontmatter contract (`name` and `description`)
and keep the file below 500 lines.

Behavioral changes require a forward test with fresh agent contexts. Provide the
raw task or fixture, not the expected finding, so reviewers cannot reconstruct the
answer from leaked context.

### Runtime installation

Keep runtime layout decisions in `lib/installer.js`. Add regression coverage for
every new path, override, safety rule, or lifecycle operation. Avoid runtime-specific
prompt forks unless the native format genuinely requires conversion.

### Metadata and releases

Keep the version in these files synchronized:

- `package.json`
- `.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`

Update `CHANGELOG.md` for user-visible changes.

## Pull request checklist

- Run `npm run check`.
- Run `npm pack --dry-run` and inspect the package contents.
- Add or update tests for behavior changes.
- Document compatibility changes in `README.md`.
- Confirm the change does not weaken adversarial review or workspace safety.
- Confirm no generated cache, temporary fixture, or local runtime install is added.

By contributing, you agree that your contribution is licensed under the MIT License.
