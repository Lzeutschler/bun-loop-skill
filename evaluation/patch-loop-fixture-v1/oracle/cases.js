"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { parseList } = require("../src/parse-list");

test("keeps ordinary comma-separated behavior", () => {
  assert.deepEqual(parseList("alpha,beta"), ["alpha", "beta"]);
  assert.deepEqual(parseList(""), [""]);
});

test("treats an escaped comma as literal data", () => {
  assert.deepEqual(parseList("alpha\\,beta,gamma"), ["alpha,beta", "gamma"]);
});

test("preserves a literal backslash before a delimiter", () => {
  assert.deepEqual(parseList("alpha\\\\,beta"), ["alpha\\", "beta"]);
});

test("rejects a dangling escape without broadening the grammar", () => {
  assert.throws(() => parseList("alpha\\"), /dangling escape/i);
});
