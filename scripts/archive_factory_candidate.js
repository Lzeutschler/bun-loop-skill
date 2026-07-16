#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function parseEvents(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

function findUsage(events) {
  const totals = {
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
  };
  for (const event of events) {
    const usage = event.usage || event.token_usage || event.payload?.usage || event.item?.usage;
    if (!usage || typeof usage !== "object") continue;
    for (const key of Object.keys(totals)) {
      const value = usage[key] ?? usage[key.replace("_tokens", "")];
      if (Number.isFinite(value)) totals[key] = Math.max(totals[key], value);
    }
  }
  return totals;
}

function parseTrace(lastMessage, variant) {
  const match = lastMessage.match(/FACTORY_TRACE:?\s*(\{[^\n]*\})/);
  if (!match) return { schema_version: 1, variant, parse_error: "missing FACTORY_TRACE", final_message: lastMessage };
  try { return { schema_version: 1, variant, ...JSON.parse(match[1]) }; }
  catch (error) { return { schema_version: 1, variant, parse_error: error.message, final_message: lastMessage }; }
}

function archiveCandidate(repo, eventLog, lastMessageFile, outputRoot, seed, variant) {
  const diff = spawnSync("git", ["diff", "--binary", "HEAD"], { cwd: repo, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (diff.status !== 0) throw new Error(`cannot archive candidate diff: ${diff.stderr}`);
  const destination = path.join(outputRoot, seed);
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, `${variant}.patch`), diff.stdout || "# empty candidate patch\n");
  const events = parseEvents(eventLog);
  const lastMessage = fs.existsSync(lastMessageFile) ? fs.readFileSync(lastMessageFile, "utf8") : "";
  const eventStats = fs.statSync(eventLog);
  const usage = {
    schema_version: 1,
    variant,
    ...findUsage(events),
    event_count: events.length,
    patch_bytes: Buffer.byteLength(diff.stdout),
    wall_clock_seconds: Math.max(0, Math.round((eventStats.mtimeMs - eventStats.birthtimeMs) / 1000)),
  };
  fs.writeFileSync(path.join(destination, `${variant}.usage.json`), `${JSON.stringify(usage, null, 2)}\n`);
  fs.writeFileSync(path.join(destination, `${variant}.trace.json`), `${JSON.stringify(parseTrace(lastMessage, variant), null, 2)}\n`);
  return { usage, trace: parseTrace(lastMessage, variant) };
}

function main(argv) {
  if (argv.length !== 6) {
    throw new Error("Usage: archive_factory_candidate.js <repo> <events.jsonl> <last.txt> <candidates-dir> <seed> <variant>");
  }
  archiveCandidate(...argv.map((value, index) => index < 4 ? path.resolve(value) : value));
  process.stdout.write(`Archived ${argv[4]}/${argv[5]}\n`);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`archive-factory-candidate: ${error.message}\n`); process.exitCode = 1; }
}

module.exports = { archiveCandidate, findUsage, parseTrace };
