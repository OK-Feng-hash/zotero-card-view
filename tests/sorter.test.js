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
  {
    title: "Beta", date: "2024-02-01", metrics: { impactFactor: "12.5" }, rating: { value: 3 },
    attachmentCount: 3, noteCount: 0,
    sortValues: { creator: "Zhang", itemType: "期刊文章", year: "2024", publication: "Waste", publisher: "B", dateAdded: "2026-01-01", dateModified: "2026-03-01", tags: "重金属" }
  },
  {
    title: "alpha", date: "07/2026", metrics: { impactFactor: "3.3" }, rating: { value: 5 },
    attachmentCount: 1, noteCount: 2,
    sortValues: { creator: "Ada", itemType: "会议论文", year: "2026", publication: "Chemistry", publisher: "A", dateAdded: "2025-01-01", dateModified: "2026-04-01", tags: "吸附" }
  },
  {
    title: "Gamma", date: "2025", metrics: { impactFactor: "" }, rating: null,
    attachmentCount: 0, noteCount: 1,
    sortValues: { creator: "Li", itemType: "报告", year: "2025", publication: "Nature", publisher: "C", dateAdded: "2024-01-01", dateModified: "2026-02-01", tags: "铬污染" }
  }
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

test("sorts the added text, year, timestamp, and count fields", () => {
  const sorter = context.CardViewSorter.sortModels;
  assert.deepEqual(Array.from(sorter(models, "creator", "asc"), model => model.title), ["alpha", "Gamma", "Beta"]);
  assert.deepEqual(Array.from(sorter(models, "year", "desc"), model => model.title), ["alpha", "Gamma", "Beta"]);
  assert.deepEqual(Array.from(sorter(models, "dateAdded", "desc"), model => model.title), ["Beta", "alpha", "Gamma"]);
  assert.deepEqual(Array.from(sorter(models, "attachmentCount", "desc"), model => model.title), ["Beta", "alpha", "Gamma"]);
  assert.deepEqual(Array.from(sorter(models, "noteCount", "desc"), model => model.title), ["alpha", "Gamma", "Beta"]);
});

test("sorts journal partitions by numeric rank with TOP first within a rank", () => {
  const partitions = [
    { title: "2区普通", metrics: { casPartition: "材料科学2区", publicationBadges: [] } },
    { title: "1区普通", metrics: { casPartition: "环境科学1区", publicationBadges: [] } },
    { title: "2区TOP", metrics: { casPartition: "材料科学2区", publicationBadges: [{ field: "sciUpTop", text: "材料科学TOP" }] } },
    { title: "1区TOP", metrics: { casPartition: "环境科学1区", publicationBadges: [{ field: "sciUpTop", text: "环境科学TOP" }] } },
    { title: "无分区", metrics: { casPartition: "", publicationBadges: [] } }
  ];
  assert.deepEqual(
    Array.from(context.CardViewSorter.sortModels(partitions, "journalPartition", "asc"), model => model.title),
    ["1区TOP", "1区普通", "2区TOP", "2区普通", "无分区"]
  );
});

test("journal partition sorting ignores unrelated JCR quartiles", () => {
  const metrics = {
    casPartition: "材料科学2区",
    publicationBadges: [
      { field: "sci", text: "SCI Q1" },
      { field: "sciUp", text: "SCI升级版 材料科学2区" }
    ]
  };
  assert.equal(context.CardViewSorter.partitionValue(metrics).rank, 2);
});
