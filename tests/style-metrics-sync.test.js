const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");

function environment(initial = {}) {
  const values = new Map(Object.entries(initial));
  const requests = [];
  const storage = {
    lock: { promise: Promise.resolve() },
    get(item, key) { return values.get(`${item.key}:${key}`); }
  };
  const win = {
    setTimeout,
    clearTimeout,
    Zotero: {
      debug() {},
      ZoteroStyle: { api: {
        itemTreeExtensionHost: { localStorage: storage },
        renderCell(item, key) { requests.push([item.id, key]); }
      } }
    }
  };
  const sandbox = {
    CardViewMetricsAdapter: { publicationTitle: item => item.journal }
  };
  const context = vm.createContext({ _globalThis: sandbox });
  vm.runInContext(
    fs.readFileSync(path.resolve(__dirname, "../addon/content/modules/style-metrics-sync.js"), "utf8"),
    context
  );
  return { Sync: sandbox.CardViewStyleMetricsSync, win, values, requests, storage };
}

function model(id, journal) {
  return { id, item: { id, journal } };
}

test("waits for Style storage and reports persisted metrics on the first poll", async () => {
  const env = environment({ "Journal A:rank": { sciif: "7.3", sciUp: "环境科学2区" } });
  const sync = new env.Sync(env.win, () => {});
  sync.track([model(1, "Journal A"), model(2, "Journal A")]);
  const first = await sync.pollOnce();
  const second = await sync.pollOnce();
  assert.deepEqual(Array.from(first.changedIDs), [1, 2]);
  assert.deepEqual(Array.from(second.changedIDs), []);
});

test("does not read Style cache before its asynchronous storage lock resolves", async () => {
  const env = environment({ "Journal A:rank": { sciif: "7.3" } });
  let release;
  let reads = 0;
  env.storage.lock.promise = new Promise(resolve => { release = resolve; });
  const originalGet = env.storage.get;
  env.storage.get = (...args) => { reads++; return originalGet(...args); };
  const sync = new env.Sync(env.win, () => {});
  sync.track([model(1, "Journal A")]);
  const polling = sync.pollOnce();
  await Promise.resolve();
  assert.equal(reads, 0);
  release();
  const result = await polling;
  assert.equal(reads, 1);
  assert.deepEqual(Array.from(result.changedIDs), [1]);
});

test("uses Style's public renderer once to request missing visible metrics", async () => {
  const env = environment();
  const sync = new env.Sync(env.win, () => {}, { requestCooldownMs: 60000 });
  sync.track([model(3, "Journal B"), model(4, "Journal C")]);
  sync.prioritize([3]);
  const first = await sync.pollOnce();
  const second = await sync.pollOnce();
  assert.deepEqual(Array.from(first.requestedTitles), ["Journal B"]);
  assert.deepEqual(Array.from(second.requestedTitles), []);
  assert.deepEqual(env.requests, [[3, "publicationTags"]]);
});

test("reports only cards whose journal cache entry changed", async () => {
  const env = environment({
    "Journal A:rank": { sciif: "7.3" },
    "Journal B:rank": { sciif: "3.6" }
  });
  const sync = new env.Sync(env.win, () => {});
  sync.track([model(1, "Journal A"), model(2, "Journal A"), model(3, "Journal B")]);
  await sync.pollOnce();
  env.values.set("Journal A:rank", { sciif: "7.5" });
  const result = await sync.pollOnce();
  assert.deepEqual(Array.from(result.changedIDs), [1, 2]);
});
