const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const context = vm.createContext({});
vm.runInContext(
  fs.readFileSync(path.resolve(__dirname, "../addon/content/modules/reading-progress-adapter.js"), "utf8"),
  context
);

function windowWith(record, prefs = {}) {
  return { Zotero: {
    Prefs: { get: key => prefs[key] },
    ZoteroStyle: { api: { storage: { get: () => record } } }
  } };
}

test("mirrors Ethereal Style title color and opacity", () => {
  const win = windowWith(null, {
    "zoterostyle.function.titleColumn.enable": true,
    "zoterostyle.titleColumn.color": "#123456",
    "zoterostyle.titleColumn.opacity": "0.42"
  });
  const config = context.CardViewReadingProgressAdapter.createConfig(win);
  assert.equal(config.enabled, true);
  assert.equal(config.color, "#123456");
  assert.equal(config.opacity, 0.42);
});

test("converts per-page reading seconds into Style-compatible intensities", () => {
  const win = windowWith({ page: 4, data: { 0: 0, 1: 30, 2: 60, 3: 120 } });
  const progress = context.CardViewReadingProgressAdapter.getProgress(win, { id: 1 });
  assert.equal(progress.color, "#FFC6D3");
  assert.equal(progress.opacity, 0.7);
  assert.deepEqual(
    Array.from(progress.intensities, value => Number(value.toFixed(4))),
    [0, 0.3478, 0.6957, 1]
  );
  assert.match(progress.signature, /^#FFC6D3\|0\.7\|/);
});

test("infers page count from sparse data and safely handles missing Style", () => {
  assert.equal(
    context.CardViewReadingProgressAdapter.pageCount({ data: { 0: 10, 4: 20 } }),
    5
  );
  assert.equal(context.CardViewReadingProgressAdapter.getProgress({ Zotero: {} }, { id: 1 }), null);
});

test("disabled or invisible Style title progress is not rendered", () => {
  const record = { page: 2, data: { 0: 60, 1: 20 } };
  const disabled = windowWith(record, { "zoterostyle.function.titleColumn.enable": false });
  const invisible = windowWith(record, { "zoterostyle.titleColumn.opacity": "0" });
  assert.equal(context.CardViewReadingProgressAdapter.getProgress(disabled, { id: 1 }), null);
  assert.equal(context.CardViewReadingProgressAdapter.getProgress(invisible, { id: 1 }), null);
});
