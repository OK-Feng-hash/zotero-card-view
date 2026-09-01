const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");

function createStore() {
  const counters = { settings: 0, summary: 0, details: 0 };
  const context = vm.createContext({
    CardViewSettings: {
      createSnapshot: () => ({ revision: ++counters.settings })
    },
    CardViewItemPresenter: {
      presentSummary: (_win, item, settings) => ({ id: item.id, item, settings }),
      presentDetails: (_win, item, summary) => ({ ...summary, detail: item.title })
    },
    CardViewReadingProgressAdapter: {
      getProgress: (_win, item) => ({ signature: `progress-${item.id}` })
    }
  });
  const originalSummary = context.CardViewItemPresenter.presentSummary;
  const originalDetails = context.CardViewItemPresenter.presentDetails;
  context.CardViewItemPresenter.presentSummary = (...args) => {
    counters.summary++;
    return originalSummary(...args);
  };
  context.CardViewItemPresenter.presentDetails = (...args) => {
    counters.details++;
    return originalDetails(...args);
  };
  vm.runInContext(
    fs.readFileSync(path.resolve(__dirname, "../addon/content/modules/model-store.js"), "utf8"),
    context
  );
  return { store: new context.CardViewModelStore({}), counters };
}

test("model store reuses summaries and lazily creates details", () => {
  const { store, counters } = createStore();
  const item = { id: 1, title: "Paper" };
  assert.equal(store.getSummary(item), store.getSummary(item));
  assert.equal(counters.summary, 1);
  assert.equal(counters.details, 0);
  assert.equal(store.getDetails(item), store.getDetails(item));
  assert.equal(counters.details, 1);
});

test("item and settings invalidation are scoped", () => {
  const { store, counters } = createStore();
  const first = { id: 1, title: "First" };
  const second = { id: 2, title: "Second" };
  store.getSummary(first);
  const cachedSecond = store.getSummary(second);
  store.invalidate([1]);
  store.getSummary(first);
  assert.equal(store.getSummary(second), cachedSecond);
  assert.equal(counters.summary, 3);
  store.refreshSettings();
  assert.notEqual(store.getSummary(second), cachedSecond);
  assert.equal(counters.settings, 2);
});

test("reading progress is read live instead of entering the summary cache", () => {
  const { store } = createStore();
  const item = { id: 7, title: "Paper" };
  assert.equal(store.getReadingProgress(item).signature, "progress-7");
  assert.equal(store.getReadingProgress(item).signature, "progress-7");
});
