const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const context = vm.createContext({});
for (const file of ["text-utils.js", "rating-adapter.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../addon/content/modules", file), "utf8"), context);
}

test("reads the current Zotero Style rate and appearance preferences", () => {
  const preferences = {
    "zoterostyle.function.ratingColumn.enable": true,
    "zoterostyle.ratingColumn.selectedStar": "★",
    "zoterostyle.ratingColumn.unselectedStar": "☆",
    "zoterostyle.ratingColumn.padding": "3"
  };
  const win = { Zotero: {
    Prefs: { get: key => preferences[key] },
    Tags: { getColor: () => null }
  } };
  const item = {
    libraryID: 1,
    getField: field => field === "extra" ? "rate: 4" : "",
    getTags: () => []
  };
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.CardViewRatingAdapter.getRating(win, item))),
    { value: 4, selectedStar: "★", unselectedStar: "☆", padding: 3 }
  );
});

test("supports legacy uncolored star tags and rejects colored ones", () => {
  const item = {
    libraryID: 1,
    getField: () => "",
    getTags: () => [{ tag: "⭐⭐⭐" }]
  };
  const uncoloredWin = { Zotero: { Tags: { getColor: () => null } } };
  const coloredWin = { Zotero: { Tags: { getColor: () => ({ color: "#ff0" }) } } };
  assert.equal(context.CardViewRatingAdapter.getRating(uncoloredWin, item).value, 3);
  assert.equal(context.CardViewRatingAdapter.getRating(coloredWin, item), null);
});
