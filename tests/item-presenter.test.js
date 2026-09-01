const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const context = vm.createContext({});
for (const file of ["text-utils.js", "rating-adapter.js", "metrics-adapter.js", "item-presenter.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../addon/content/modules", file), "utf8"), context);
}

test("presenter maps a Zotero parent item without exposing note bodies", () => {
  const fields = {
    title: "A paper",
    date: "2026-03-18",
    publicationTitle: "Journal of Tests",
    abstractNote: "Private abstract",
    DOI: "10.1234/example",
    extra: "Keywords: adsorption; chromium"
  };
  const note = {
    id: 2,
    isNote: () => true,
    getNoteTitle: () => "Experiment note",
    getField: () => ""
  };
  const attachment = {
    id: 3,
    isAttachment: () => true,
    attachmentContentType: "application/pdf",
    attachmentFilename: "paper.pdf",
    getField: field => field === "title" ? "PDF Full Text" : ""
  };
  const item = {
    id: 1,
    key: "ABC12345",
    getField: field => fields[field] || "",
    getCreators: () => [{ firstName: "Ada", lastName: "Lovelace", creatorTypeID: 1 }],
    getTags: () => [{ tag: "reviewed" }],
    getCollections: () => [10],
    getNotes: () => [2],
    getAttachments: () => [3]
  };
  const win = { Zotero: {
    CreatorTypes: { getLocalizedString: () => "作者" },
    Collections: { get: () => ({ name: "Research" }) },
    Items: { get: id => id === 2 ? note : attachment }
  } };

  const model = JSON.parse(JSON.stringify(context.CardViewItemPresenter.present(win, item)));
  assert.equal(model.title, "A paper");
  assert.equal(model.creators[0].name, "Ada Lovelace");
  assert.equal(model.keywords, "adsorption; chromium");
  assert.deepEqual(model.notes, [{ id: 2, title: "Experiment note" }]);
  assert.deepEqual(model.attachments, [{ id: 3, title: "PDF Full Text", contentType: "application/pdf" }]);
  assert.equal(JSON.stringify(model).includes("note body"), false);
});

test("presenter does not reuse Zotero tags as independent keywords", () => {
  const item = {
    id: 9,
    key: "NO_KEYWORDS",
    getField: () => "",
    getCreators: () => [],
    getTags: () => [{ tag: "吸附" }],
    getCollections: () => [],
    getNotes: () => [],
    getAttachments: () => []
  };
  const win = { Zotero: {
    Collections: { get: () => null },
    Items: { get: () => null }
  } };
  const model = context.CardViewItemPresenter.present(win, item);
  assert.equal(model.keywords, "");
  assert.deepEqual(Array.from(model.tags), ["吸附"]);
});
