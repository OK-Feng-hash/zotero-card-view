const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const context = vm.createContext({});
const modulePath = path.resolve(__dirname, "../addon/content/modules/text-utils.js");
vm.runInContext(fs.readFileSync(modulePath, "utf8"), context);
const utils = context.CardViewTextUtils;

test("cleanText removes markup and normalizes whitespace", () => {
  assert.equal(utils.cleanText("  A <i>useful</i>  title &amp; note "), "A useful title & note");
});

test("parseExtraField supports English and Chinese separators", () => {
  const extra = "PMID: 123\n关键词：吸附；铬\nJIF: 8.4";
  assert.equal(utils.parseExtraField(extra, ["关键词"]), "吸附；铬");
  assert.equal(utils.parseExtraField(extra, ["IF", "JIF"]), "8.4");
});

test("parseExtraField does not accept partial field names", () => {
  assert.equal(utils.parseExtraField("JIF5: 9.1", ["JIF"]), "");
});

