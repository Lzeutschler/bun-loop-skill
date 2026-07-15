#!/usr/bin/env node
"use strict";

const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const packageJson = require("../package.json");
const { execute, RUNTIMES } = require("../lib/installer");

const RUNTIME_NAMES = Object.keys(RUNTIMES);

function parseArgs(argv) {
  const options = {
    runtimes: [],
    scope: null,
    target: null,
    dryRun: false,
    uninstall: false,
    help: false,
    version: false,
    listRuntimes: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (RUNTIME_NAMES.includes(argument.slice(2)) && argument.startsWith("--")) {
      options.runtimes.push(argument.slice(2));
    } else if (argument === "--runtime") {
      const value = argv[++index];
      if (!value) throw new Error("--runtime requires a value");
      options.runtimes.push(...value.split(",").filter(Boolean));
    } else if (argument.startsWith("--runtime=")) {
      options.runtimes.push(...argument.slice(10).split(",").filter(Boolean));
    } else if (argument === "--global") {
      if (options.scope === "local") throw new Error("Choose only one installation scope");
      options.scope = "global";
    } else if (argument === "--local") {
      if (options.scope === "global") throw new Error("Choose only one installation scope");
      options.scope = "local";
    } else if (argument === "--target") {
      options.target = argv[++index];
      if (!options.target) throw new Error("--target requires a skills directory");
    } else if (argument.startsWith("--target=")) {
      options.target = argument.slice(9);
      if (!options.target) throw new Error("--target requires a skills directory");
    } else if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--uninstall") {
      options.uninstall = true;
    } else if (argument === "--list-runtimes") {
      options.listRuntimes = true;
    } else if (argument === "--version" || argument === "-v") {
      options.version = true;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }

  for (const runtime of options.runtimes) {
    if (!RUNTIME_NAMES.includes(runtime)) {
      throw new Error(`Unsupported runtime: ${runtime}`);
    }
  }
  return options;
}

function helpText() {
  return `Bun Loop Skill installer

Usage:
  bun-loop-skill --<runtime> (--global | --local) [options]
  bun-loop-skill --runtime claude,codex --global [options]
  bun-loop-skill --target <skills-directory> [options]

Runtimes:
  ${RUNTIME_NAMES.join(", ")}

Options:
  --global          Install for the current user
  --local           Install into the current project
  --target <path>   Install into a custom skills directory
  --uninstall       Remove the managed skill directory
  --dry-run         Print operations without changing files
  --list-runtimes   Print supported runtime identifiers
  --version, -v     Print package version
  --help, -h        Show this help
`;
}

async function completeInteractiveOptions(options) {
  if (options.target || (options.runtimes.length > 0 && options.scope)) return options;
  if (!stdin.isTTY || !stdout.isTTY) {
    if (options.runtimes.length === 0) throw new Error("Choose a runtime or --target");
    throw new Error("Choose --global or --local");
  }

  const prompt = readline.createInterface({ input: stdin, output: stdout });
  try {
    if (options.runtimes.length === 0) {
      const answer = (await prompt.question(`Runtime [claude] (${RUNTIME_NAMES.join(", ")}): `)).trim();
      options.runtimes = [answer || "claude"];
      if (!RUNTIME_NAMES.includes(options.runtimes[0])) {
        throw new Error(`Unsupported runtime: ${options.runtimes[0]}`);
      }
    }
    if (!options.scope) {
      const answer = (await prompt.question("Scope [global] (global/local): ")).trim();
      options.scope = answer || "global";
      if (!["global", "local"].includes(options.scope)) {
        throw new Error(`Unsupported scope: ${options.scope}`);
      }
    }
    return options;
  } finally {
    prompt.close();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return stdout.write(helpText());
  if (options.version) return stdout.write(`${packageJson.version}\n`);
  if (options.listRuntimes) return stdout.write(`${RUNTIME_NAMES.join("\n")}\n`);

  await completeInteractiveOptions(options);
  const results = execute(options);
  for (const result of results) {
    const verb = result.action === "install" ? "install" : "uninstall";
    const message = options.dryRun
      ? `Would ${verb}`
      : result.changed
        ? result.action === "install" ? "Installed" : "Uninstalled"
        : "No change for";
    stdout.write(`${message} ${result.runtime}: ${result.destination}\n`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`bun-loop-skill: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { completeInteractiveOptions, helpText, parseArgs };
