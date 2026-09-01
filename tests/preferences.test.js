const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const context = vm.createContext({});
vm.runInContext(
  fs.readFileSync(path.resolve(__dirname, "../addon/content/modules/preferences.js"), "utf8"),
  context
);

function environment(initialValues = {}, initialUserKeys = []) {
  const values = new Map(Object.entries(initialValues));
  const userKeys = new Set(initialUserKeys);
  const calls = [];
  const win = { Zotero: { Prefs: {
    get(key, global) {
      calls.push(["get", key, global]);
      return values.get(key);
    },
    set(key, value, global) {
      calls.push(["set", key, value, global]);
      values.set(key, value);
      userKeys.add(key);
    }
  } } };
  const services = { prefs: { prefHasUserValue: key => userKeys.has(key) } };
  return { win, services, values, userKeys, calls };
}

test("writes card preferences to the global key without duplicating the Zotero prefix", () => {
  const env = environment();
  context.CardViewPreferences.set(env.win, "enabledSortFields", "date,title");
  assert.deepEqual(env.calls[0], [
    "set",
    "extensions.zotero.cardView.enabledSortFields",
    "date,title",
    true
  ]);
});

test("migrates existing choices from the historical duplicated prefix", () => {
  const legacyKey = "extensions.zotero.extensions.zotero.cardView.enabledSortFields";
  const currentKey = "extensions.zotero.cardView.enabledSortFields";
  const env = environment({ [legacyKey]: "date,title,dateAdded" }, [legacyKey]);
  const migrated = context.CardViewPreferences.migrateLegacy(env.win, env.services);
  assert.deepEqual(Array.from(migrated), ["enabledSortFields"]);
  assert.equal(env.values.get(currentKey), "date,title,dateAdded");
});

test("migration never overwrites a correctly stored user preference", () => {
  const legacyKey = "extensions.zotero.extensions.zotero.cardView.sortField";
  const currentKey = "extensions.zotero.cardView.sortField";
  const env = environment(
    { [legacyKey]: "dateAdded", [currentKey]: "title" },
    [legacyKey, currentKey]
  );
  assert.deepEqual(Array.from(context.CardViewPreferences.migrateLegacy(env.win, env.services)), []);
  assert.equal(env.values.get(currentKey), "title");
});
