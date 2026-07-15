"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const packageJson = require("../package.json");

const SKILL_NAME = "bun-loop-skill";
const INSTALL_MARKER = ".bun-loop-install.json";
const INSTALL_MARKER_SCHEMA = 1;
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const SOURCE_DIR = path.join(PACKAGE_ROOT, "skills", SKILL_NAME);

const RUNTIMES = Object.freeze({
  claude: {
    global: (ctx) => path.join(configRoot(ctx, "CLAUDE_CONFIG_DIR", ".claude"), "skills"),
    local: (ctx) => path.join(ctx.cwd, ".claude", "skills"),
  },
  codex: {
    global: (ctx) => path.join(configRoot(ctx, "CODEX_HOME", ".codex"), "skills"),
    local: (ctx) => path.join(ctx.cwd, ".codex", "skills"),
  },
  cursor: {
    global: (ctx) => path.join(configRoot(ctx, "CURSOR_CONFIG_DIR", ".cursor"), "skills"),
    local: (ctx) => path.join(ctx.cwd, ".cursor", "skills"),
  },
  copilot: {
    global: (ctx) => path.join(configRoot(ctx, "COPILOT_CONFIG_DIR", ".copilot"), "skills"),
    local: (ctx) => path.join(ctx.cwd, ".github", "skills"),
  },
  opencode: {
    global: (ctx) => path.join(xdgConfigRoot(ctx, "OPENCODE_CONFIG_DIR", "opencode"), "skills"),
    local: (ctx) => path.join(ctx.cwd, ".opencode", "skills"),
  },
  kilo: {
    global: (ctx) => path.join(xdgConfigRoot(ctx, "KILO_CONFIG_DIR", "kilo"), "skills"),
    local: (ctx) => path.join(ctx.cwd, ".kilo", "skills"),
  },
  kimi: {
    global: (ctx) => path.join(configRoot(ctx, "KIMI_CONFIG_DIR", path.join(".config", "agents")), "skills"),
    local: (ctx) => path.join(ctx.cwd, ".agents", "skills"),
  },
  cline: {
    global: (ctx) => path.join(configRoot(ctx, "CLINE_CONFIG_DIR", ".cline"), "skills"),
    local: null,
  },
});

function expandPath(value, ctx) {
  if (!value) return value;
  if (value === "~") return ctx.home;
  if (value.startsWith(`~${path.sep}`) || value.startsWith("~/")) {
    return path.join(ctx.home, value.slice(2));
  }
  return path.resolve(ctx.cwd, value);
}

function configRoot(ctx, envName, fallback) {
  const configured = ctx.env[envName];
  return configured
    ? expandPath(configured, ctx)
    : path.join(ctx.home, fallback);
}

function xdgConfigRoot(ctx, envName, runtimeDirectory) {
  if (ctx.env[envName]) return expandPath(ctx.env[envName], ctx);
  const xdg = ctx.env.XDG_CONFIG_HOME
    ? expandPath(ctx.env.XDG_CONFIG_HOME, ctx)
    : path.join(ctx.home, ".config");
  return path.join(xdg, runtimeDirectory);
}

function createContext(options = {}) {
  return {
    cwd: path.resolve(options.cwd || process.cwd()),
    home: path.resolve(options.home || os.homedir()),
    env: options.env || process.env,
  };
}

function resolveDestination(runtime, scope, options = {}) {
  const ctx = createContext(options);
  const descriptor = RUNTIMES[runtime];
  if (!descriptor) {
    throw new Error(`Unsupported runtime: ${runtime}`);
  }
  const resolver = descriptor[scope];
  if (!resolver) {
    throw new Error(`${runtime} does not expose a ${scope} skill installation root`);
  }
  return path.join(resolver(ctx), SKILL_NAME);
}

function resolveOperations(options = {}) {
  const ctx = createContext(options);
  if (options.target) {
    if (options.runtimes && options.runtimes.length > 0) {
      throw new Error("Use either --target or runtime flags, not both");
    }
    if (options.scope) {
      throw new Error("Use either --target or an installation scope, not both");
    }
    return [{
      runtime: "custom",
      destination: path.join(expandPath(options.target, ctx), SKILL_NAME),
    }];
  }

  const runtimes = [...new Set(options.runtimes || [])];
  if (runtimes.length === 0) throw new Error("Choose at least one runtime");
  if (!options.scope) throw new Error("Choose --global or --local");

  const seen = new Set();
  const operations = [];
  for (const runtime of runtimes) {
    const destination = resolveDestination(runtime, options.scope, ctx);
    if (seen.has(destination)) continue;
    seen.add(destination);
    operations.push({ runtime, destination });
  }
  return operations;
}

function assertSource(sourceDir) {
  const skillFile = path.join(sourceDir, "SKILL.md");
  if (!fs.existsSync(skillFile)) {
    throw new Error(`Canonical skill is missing: ${skillFile}`);
  }
}

function assertManagedInstallation(destination) {
  const markerPath = path.join(destination, INSTALL_MARKER);
  if (!fs.existsSync(markerPath)) {
    throw new Error(
      `Refusing to modify unmanaged installation (missing ${INSTALL_MARKER}): ${destination}`,
    );
  }
  const markerFile = fs.lstatSync(markerPath);
  if (markerFile.isSymbolicLink() || !markerFile.isFile()) {
    throw new Error(`Refusing to modify installation with an invalid marker: ${destination}`);
  }

  let marker;
  try {
    marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
  } catch {
    throw new Error(`Refusing to modify installation with an invalid marker: ${destination}`);
  }
  if (
    marker.schema_version !== INSTALL_MARKER_SCHEMA
    || marker.managed_by !== "bun-loop-skill-installer"
    || marker.skill !== SKILL_NAME
    || typeof marker.package_version !== "string"
    || marker.package_version.length === 0
  ) {
    throw new Error(`Refusing to modify installation with an invalid marker: ${destination}`);
  }

  const skillFile = path.join(destination, "SKILL.md");
  if (!fs.existsSync(skillFile) || fs.lstatSync(skillFile).isSymbolicLink()) {
    throw new Error(`Refusing to modify unrecognized installation: ${destination}`);
  }
  const frontmatter = fs.readFileSync(skillFile, "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter || !/^name:\s*bun-loop-skill\s*$/m.test(frontmatter[1])) {
    throw new Error(`Refusing to modify unrecognized installation: ${destination}`);
  }
}

function writeInstallMarker(destination) {
  const marker = {
    schema_version: INSTALL_MARKER_SCHEMA,
    managed_by: "bun-loop-skill-installer",
    skill: SKILL_NAME,
    package_version: packageJson.version,
  };
  fs.writeFileSync(
    path.join(destination, INSTALL_MARKER),
    `${JSON.stringify(marker, null, 2)}\n`,
    "utf8",
  );
}

function installSkill(destination, options = {}) {
  const sourceDir = options.sourceDir || SOURCE_DIR;
  assertSource(sourceDir);

  if (fs.existsSync(destination)) {
    const existing = fs.lstatSync(destination);
    if (existing.isSymbolicLink()) {
      throw new Error(`Refusing to replace symlinked installation: ${destination}`);
    }
    if (!existing.isDirectory()) {
      throw new Error(`Refusing to replace non-directory installation: ${destination}`);
    }
    assertManagedInstallation(destination);
  }
  if (options.dryRun) return { action: "install", destination, changed: false };

  const parent = path.dirname(destination);
  fs.mkdirSync(parent, { recursive: true });

  const token = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const staging = `${destination}.tmp-${token}`;
  const backup = `${destination}.bak-${token}`;
  let movedExisting = false;

  try {
    fs.cpSync(sourceDir, staging, { recursive: true, errorOnExist: true });
    assertSource(staging);
    writeInstallMarker(staging);
    if (fs.existsSync(destination)) {
      fs.renameSync(destination, backup);
      movedExisting = true;
    }
    fs.renameSync(staging, destination);
    if (movedExisting) fs.rmSync(backup, { recursive: true, force: true });
    return { action: "install", destination, changed: true };
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    if (movedExisting && !fs.existsSync(destination) && fs.existsSync(backup)) {
      fs.renameSync(backup, destination);
    }
    throw error;
  }
}

function uninstallSkill(destination, options = {}) {
  if (!fs.existsSync(destination)) {
    return { action: "uninstall", destination, changed: false };
  }
  const existing = fs.lstatSync(destination);
  if (existing.isSymbolicLink()) {
    throw new Error(`Refusing to remove symlinked installation: ${destination}`);
  }
  if (!existing.isDirectory()) {
    throw new Error(`Refusing to remove non-directory installation: ${destination}`);
  }
  assertManagedInstallation(destination);
  if (options.dryRun) {
    return { action: "uninstall", destination, changed: false };
  }
  fs.rmSync(destination, { recursive: true, force: true });
  return { action: "uninstall", destination, changed: true };
}

function execute(options = {}) {
  const operations = resolveOperations(options);
  return operations.map(({ runtime, destination }) => ({
    runtime,
    ...(options.uninstall
      ? uninstallSkill(destination, options)
      : installSkill(destination, options)),
  }));
}

module.exports = {
  INSTALL_MARKER,
  PACKAGE_ROOT,
  RUNTIMES,
  SKILL_NAME,
  SOURCE_DIR,
  createContext,
  execute,
  expandPath,
  installSkill,
  resolveDestination,
  resolveOperations,
  uninstallSkill,
};
