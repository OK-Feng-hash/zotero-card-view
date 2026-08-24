const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const context = vm.createContext({});
vm.runInContext(
  fs.readFileSync(path.resolve(__dirname, "../addon/content/modules/sorter.js"), "utf8"),
  context
);

const models = [
  { title: "Beta", date: "2024-02-01", metrics: { impactFactor: "12.5" }, rating: { value: 3 } },
  { title: "alpha", date: "07/2026", metrics: { impactFactor: "3.3" }, rating: { value: 5 } },
  { title: "Gamma", date: "2025", metrics: { impactFactor: "" }, rating: null }
];

test("sorts literature dates with newest first", () => {
  const result = context.CardViewSorter.sortModels(models, "date", "desc");
  assert.deepEqual(Array.from(result, model => model.title), ["alpha", "Gamma", "Beta"]);
});

test("sorts titles ascending", () => {
  const result = context.CardViewSorter.sortModels(models, "title", "asc");
  assert.deepEqual(Array.from(result, model => model.title), ["alpha", "Beta", "Gamma"]);
});

test("sorts impact factors descending and keeps missing values last", () => {
  const result = context.CardViewSorter.sortModels(models, "impactFactor", "desc");
  assert.deepEqual(Array.from(result, model => model.title), ["Beta", "alpha", "Gamma"]);
});

test("sorts ratings descending and keeps unrated items last", () => {
  const result = context.CardViewSorter.sortModels(models, "rating", "desc");
  assert.deepEqual(Array.from(result, model => model.title), ["alpha", "Beta", "Gamma"]);
});

