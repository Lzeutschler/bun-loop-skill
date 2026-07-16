"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const packageJson = require("../package.json");
const { parseArgs } = require("../bin/install");
const {
  execute,
  INSTALL_MARKER,
  resolveDestination,
  resolveOperations,
  SKILL_NAME,
} = require("../lib/installer");

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bun-loop-installer-"));
  return {
    directory,
    cleanup: () => fs.rmSync(directory, { recursive: true, force: true }),
  };
}

test("maps global and local runtime roots", () => {
  const home = path.resolve("/tmp/example-home");
  const cwd = path.resolve("/tmp/example-project");
  const env = {};

  assert.equal(
    resolveDestination("claude", "global", { home, cwd, env }),
    path.join(home, ".claude", "skills", SKILL_NAME),
  );
  assert.equal(
    resolveDestination("codex", "local", { home, cwd, env }),
    path.join(cwd, ".codex", "skills", SKILL_NAME),
  );
  assert.equal(
    resolveDestination("copilot", "local", { home, cwd, env }),
    path.join(cwd, ".github", "skills", SKILL_NAME),
  );
  assert.equal(
    resolveDestination("opencode", "global", { home, cwd, env }),
    path.join(home, ".config", "opencode", "skills", SKILL_NAME),
  );
});

test("honors runtime configuration overrides", () => {
  const home = path.resolve("/tmp/example-home");
  const cwd = path.resolve("/tmp/example-project");
  const env = { CODEX_HOME: path.join(home, "custom-codex") };
  assert.equal(
    resolveDestination("codex", "global", { home, cwd, env }),
    path.join(home, "custom-codex", "skills", SKILL_NAME),
  );
});

test("installs, replaces, and uninstalls a custom target", (context) => {
  const temp = fixture();
  context.after(temp.cleanup);
  const skillsRoot = path.join(temp.directory, "skills");
  const options = { target: skillsRoot, runtimes: [] };

  const installed = execute(options);
  const destination = path.join(skillsRoot, SKILL_NAME);
  assert.equal(installed[0].changed, true);
  assert.equal(fs.existsSync(path.join(destination, "SKILL.md")), true);
  assert.equal(fs.existsSync(path.join(destination, "agents", "openai.yaml")), true);
  assert.equal(
    fs.existsSync(path.join(destination, "references", "review-rubrics.md")),
    true,
  );
  assert.equal(
    fs.readFileSync(path.join(destination, "references", "review-rubrics.md"), "utf8"),
    fs.readFileSync(
      path.join(__dirname, "..", "skills", SKILL_NAME, "references", "review-rubrics.md"),
      "utf8",
    ),
  );
  const marker = JSON.parse(fs.readFileSync(path.join(destination, INSTALL_MARKER), "utf8"));
  assert.deepEqual(marker, {
    schema_version: 1,
    managed_by: "bun-loop-skill-installer",
    skill: SKILL_NAME,
    package_version: packageJson.version,
  });

  fs.writeFileSync(path.join(destination, "stale.txt"), "stale");
  execute(options);
  assert.equal(fs.existsSync(path.join(destination, "stale.txt")), false);

  const removed = execute({ ...options, uninstall: true });
  assert.equal(removed[0].changed, true);
  assert.equal(fs.existsSync(destination), false);
});

test("installs and removes the review rubrics for every supported runtime layout", (context) => {
  const temp = fixture();
  context.after(temp.cleanup);
  const home = path.join(temp.directory, "home");
  const cwd = path.join(temp.directory, "project");
  const env = {};
  const layouts = [
    ["claude", "global"], ["claude", "local"],
    ["codex", "global"], ["codex", "local"],
    ["cursor", "global"], ["cursor", "local"],
    ["copilot", "global"], ["copilot", "local"],
    ["opencode", "global"], ["opencode", "local"],
    ["kilo", "global"], ["kilo", "local"],
    ["kimi", "global"], ["kimi", "local"],
    ["cline", "global"],
  ];

  for (const [runtime, scope] of layouts) {
    const options = { runtimes: [runtime], scope, home, cwd, env };
    const [{ destination }] = execute(options);
    assert.equal(
      fs.existsSync(path.join(destination, "references", "review-rubrics.md")),
      true,
      `${runtime} ${scope}`,
    );
    execute({ ...options, uninstall: true });
    assert.equal(fs.existsSync(destination), false, `${runtime} ${scope} uninstall`);
  }
});

test("dry-run reports without changing files", (context) => {
  const temp = fixture();
  context.after(temp.cleanup);
  const skillsRoot = path.join(temp.directory, "skills");
  const result = execute({ target: skillsRoot, runtimes: [], dryRun: true });
  assert.equal(result[0].changed, false);
  assert.equal(fs.existsSync(path.join(skillsRoot, SKILL_NAME)), false);
});

test("uninstall refuses unrecognized files and directories", (context) => {
  const temp = fixture();
  context.after(temp.cleanup);
  const skillsRoot = path.join(temp.directory, "skills");
  const destination = path.join(skillsRoot, SKILL_NAME);
  fs.mkdirSync(skillsRoot, { recursive: true });

  fs.writeFileSync(destination, "not a skill");
  assert.throws(
    () => execute({ target: skillsRoot, runtimes: [], uninstall: true }),
    /non-directory installation/,
  );
  fs.rmSync(destination);

  fs.mkdirSync(destination);
  fs.writeFileSync(path.join(destination, "notes.txt"), "user-owned");
  assert.throws(
    () => execute({ target: skillsRoot, runtimes: [], uninstall: true }),
    /unmanaged installation/,
  );
  assert.equal(fs.readFileSync(path.join(destination, "notes.txt"), "utf8"), "user-owned");
});

test("install and uninstall refuse an unmarked skill directory", (context) => {
  const temp = fixture();
  context.after(temp.cleanup);
  const skillsRoot = path.join(temp.directory, "skills");
  const destination = path.join(skillsRoot, SKILL_NAME);
  fs.mkdirSync(destination, { recursive: true });
  const skill = "---\nname: bun-loop-skill\ndescription: user-owned\n---\n";
  fs.writeFileSync(path.join(destination, "SKILL.md"), skill);

  assert.throws(
    () => execute({ target: skillsRoot, runtimes: [] }),
    /unmanaged installation.*\.bun-loop-install\.json/,
  );
  assert.throws(
    () => execute({ target: skillsRoot, runtimes: [], uninstall: true }),
    /unmanaged installation.*\.bun-loop-install\.json/,
  );
  assert.equal(fs.readFileSync(path.join(destination, "SKILL.md"), "utf8"), skill);
});

test("install and uninstall refuse a malformed management marker", (context) => {
  const temp = fixture();
  context.after(temp.cleanup);
  const skillsRoot = path.join(temp.directory, "skills");
  const destination = path.join(skillsRoot, SKILL_NAME);
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(
    path.join(destination, "SKILL.md"),
    "---\nname: bun-loop-skill\ndescription: user-owned\n---\n",
  );
  fs.writeFileSync(path.join(destination, INSTALL_MARKER), "{}\n");

  assert.throws(
    () => execute({ target: skillsRoot, runtimes: [] }),
    /invalid marker/,
  );
  assert.throws(
    () => execute({ target: skillsRoot, runtimes: [], uninstall: true }),
    /invalid marker/,
  );
});

test("rejects unsupported local runtime layouts", () => {
  assert.throws(
    () => resolveDestination("cline", "local", { home: "/tmp/home", cwd: "/tmp/project", env: {} }),
    /does not expose a local skill installation root/,
  );
});

test("deduplicates repeated runtime selections", () => {
  const operations = resolveOperations({
    runtimes: ["claude", "claude"],
    scope: "global",
    home: "/tmp/home",
    cwd: "/tmp/project",
    env: {},
  });
  assert.equal(operations.length, 1);
});

test("parses runtime, scope, custom target, and lifecycle flags", () => {
  assert.deepEqual(
    parseArgs(["--runtime=claude,codex", "--global", "--dry-run"]),
    {
      runtimes: ["claude", "codex"],
      scope: "global",
      target: null,
      dryRun: true,
      uninstall: false,
      help: false,
      version: false,
      listRuntimes: false,
    },
  );
  const custom = parseArgs(["--target", "/tmp/skills", "--uninstall"]);
  assert.equal(custom.target, "/tmp/skills");
  assert.equal(custom.uninstall, true);
});

test("rejects conflicting scopes and unknown options", () => {
  assert.throws(() => parseArgs(["--global", "--local"]), /only one installation scope/);
  assert.throws(() => parseArgs(["--target="]), /requires a skills directory/);
  assert.throws(() => parseArgs(["--wat"]), /Unknown option/);
});

test("rejects custom targets combined with runtime or scope selectors", () => {
  assert.throws(
    () => resolveOperations({ target: "/tmp/skills", runtimes: ["codex"] }),
    /either --target or runtime flags/,
  );
  assert.throws(
    () => resolveOperations({ target: "/tmp/skills", runtimes: [], scope: "global" }),
    /either --target or an installation scope/,
  );
});
