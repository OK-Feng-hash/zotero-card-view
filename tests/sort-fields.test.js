const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const context = vm.createContext({});
vm.runInContext(
  fs.readFileSync(path.resolve(__dirname, "../addon/content/modules/sort-fields.js"), "utf8"),
  context
);

test("offers all confirmed card sorting fields", () => {
  assert.deepEqual(
    Array.from(context.CardViewSortFields.FIELDS, field => field.id),
    [
      "date", "title", "creator", "itemType", "year", "publication", "publisher",
      "dateAdded", "dateModified", "attachmentCount", "noteCount", "tags",
      "impactFactor", "journalPartition", "rating"
    ]
  );
});

test("normalizes saved choices in canonical order and rejects an empty selection", () => {
  assert.deepEqual(
    Array.from(context.CardViewSortFields.normalizeEnabled("rating,date,unknown,title")),
    ["date", "title", "rating"]
  );
  assert.deepEqual(
    Array.from(context.CardViewSortFields.normalizeEnabled("")),
    ["date", "title", "impactFactor", "rating"]
  );
});

test("uses field-appropriate initial directions", () => {
  assert.equal(context.CardViewSortFields.defaultDirection("title"), "asc");
  assert.equal(context.CardViewSortFields.defaultDirection("journalPartition"), "asc");
  assert.equal(context.CardViewSortFields.defaultDirection("impactFactor"), "desc");
});
