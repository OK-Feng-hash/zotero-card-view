const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const moduleDir = path.resolve(__dirname, "../addon/content/modules");

test("all runtime modules attach to the bootstrap _globalThis sandbox", () => {
  const sandbox = {};
  const context = vm.createContext({ _globalThis: sandbox });
  for (const file of [
    "text-utils.js",
    "preferences.js",
    "sort-fields.js",
    "sorter.js",
    "rating-adapter.js",
    "metrics-adapter.js",
    "style-metrics-sync.js",
    "reading-progress-adapter.js",
    "view-position.js",
    "settings.js",
    "item-presenter.js",
    "model-store.js",
    "card-renderer.js",
    "card-view.js",
    "index.js"
  ]) {
    vm.runInContext(fs.readFileSync(path.join(moduleDir, file), "utf8"), context);
  }

  assert.ok(sandbox.CardViewTextUtils);
  assert.ok(sandbox.CardViewPreferences);
  assert.ok(sandbox.CardViewSortFields);
  assert.ok(sandbox.CardViewSorter);
  assert.ok(sandbox.CardViewRatingAdapter);
  assert.ok(sandbox.CardViewMetricsAdapter);
  assert.equal(typeof sandbox.CardViewStyleMetricsSync, "function");
  assert.ok(sandbox.CardViewReadingProgressAdapter);
  assert.ok(sandbox.CardViewViewPosition);
  assert.ok(sandbox.CardViewSettings);
  assert.ok(sandbox.CardViewItemPresenter);
  assert.equal(typeof sandbox.CardViewModelStore, "function");
  assert.equal(typeof sandbox.CardViewCardRenderer, "function");
  assert.ok(sandbox.CardViewDetailUtils);
  assert.equal(typeof sandbox.ZoteroCardViewController, "function");
  assert.ok(sandbox.ZoteroCardView);
});

test("bootstrap exposes its shared module context explicitly", () => {
  const bootstrap = fs.readFileSync(path.resolve(__dirname, "../addon/bootstrap.js"), "utf8");
  assert.match(bootstrap, /moduleContext\._globalThis\s*=\s*moduleContext/);
});
