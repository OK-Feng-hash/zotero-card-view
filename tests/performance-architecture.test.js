const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const counters = { prefs: 0, creators: 0, children: 0 };
const win = { Zotero: {
  Prefs: { get: () => { counters.prefs++; return undefined; } },
  ZoteroStyle: { api: { itemTreeExtensionHost: { localStorage: { get: () => ({}) } } } },
  CreatorTypes: { getLocalizedString: () => "作者" },
  Collections: { get: () => null },
  Tags: { getColor: () => null },
  Items: { get: id => {
    counters.children++;
    const note = id < 2000;
    return note ? {
      id,
      isNote: () => true,
      getNoteTitle: () => "Note"
    } : {
      id,
      isAttachment: () => true,
      getField: () => "PDF",
      attachmentContentType: "application/pdf"
    };
  } }
} };

const context = vm.createContext({});
for (const file of [
  "text-utils.js",
  "rating-adapter.js",
  "metrics-adapter.js",
  "settings.js",
  "item-presenter.js",
  "model-store.js"
]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../addon/content/modules", file), "utf8"), context);
}

function item(id) {
  return {
    id,
    key: `ITEM${id}`,
    libraryID: 1,
    getField: field => ({ title: `Paper ${id}`, publicationTitle: "Journal" })[field] || "",
    getTags: () => [{ tag: "topic" }],
    getNotes: () => [1000 + id],
    getAttachments: () => [2000 + id],
    getCreators: () => { counters.creators++; return []; },
    getCollections: () => []
  };
}

test("large summary views parse settings once and defer heavy detail reads", () => {
  const store = new context.CardViewModelStore(win);
  const prefReadsAfterSnapshot = counters.prefs;
  const items = Array.from({ length: 219 }, (_, index) => item(index + 1));
  for (const current of items) store.getSummary(current);
  for (const current of items) store.getSummary(current);

  assert.ok(prefReadsAfterSnapshot > 0 && prefReadsAfterSnapshot < 30);
  assert.equal(counters.prefs, prefReadsAfterSnapshot);
  assert.equal(counters.creators, 0);
  assert.equal(counters.children, 0);

  store.getDetails(items[0]);
  assert.equal(counters.creators, 1);
  assert.equal(counters.children, 2);
});

