# Security Policy

## Reporting a vulnerability

Do not report vulnerabilities through public issues. Use a
[private GitHub security advisory](https://github.com/Lzeutschler/bun-loop-skill/security/advisories/new)
instead.

Include:

- the affected version or commit;
- installation runtime and scope;
- reproduction steps;
- potential impact;
- suggested remediation, if available.

Remove API keys, tokens, usernames, private repository names, and local paths from
logs or agent transcripts before submitting them.

## Scope

Security reports are especially relevant when the installer or skill could:

- overwrite or delete files outside its managed `bun-loop-skill` directory;
- follow a malicious symlink or escape a configured skills root;
- expose secrets through reviewer bundles or final reports;
- authorize destructive Git operations or external actions without user consent;
- let an implementer bypass independent review while claiming the loop completed.

## Supported versions

Security fixes target the latest released version. Before the first stable release,
the current `main` branch is the supported development line.
