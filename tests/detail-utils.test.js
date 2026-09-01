const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const context = vm.createContext({});
vm.runInContext(
  fs.readFileSync(path.resolve(__dirname, "../addon/content/modules/card-renderer.js"), "utf8"),
  context
);

const utils = context.CardViewDetailUtils;

test("ordinary authors are displayed without a redundant role", () => {
  assert.equal(utils.creatorDetailLabel({ name: "Ada Lovelace", role: "作者" }), "Ada Lovelace");
  assert.equal(utils.creatorDetailLabel({ name: "Grace Hopper", role: "Author" }), "Grace Hopper");
});

test("non-author creator roles remain visible", () => {
  assert.equal(utils.creatorDetailLabel({ name: "Jane Doe", role: "编辑" }), "Jane Doe（编辑）");
});

test("keywords identical to tags are suppressed regardless of order", () => {
  assert.equal(utils.hasDistinctKeywords("吸附；沉淀", ["沉淀", "吸附"]), false);
  assert.equal(utils.hasDistinctKeywords("吸附；废水处理", ["沉淀", "吸附"]), true);
  assert.equal(utils.hasDistinctKeywords("", ["沉淀", "吸附"]), false);
});
