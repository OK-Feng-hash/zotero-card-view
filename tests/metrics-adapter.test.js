const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");

const context = vm.createContext({});
for (const file of ["text-utils.js", "metrics-adapter.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "../addon/content/modules", file), "utf8"), context);
}

test("Zotero Style cache has priority over Extra", () => {
  const item = {
    key: "ABCD1234",
    getField: field => ({
      publicationTitle: "Waste Management",
      extra: "JIF: 1.2\n中科院分区: 4区"
    })[field] || ""
  };
  const win = { Zotero: { ZoteroStyle: { api: { itemTreeExtensionHost: { localStorage: {
    get: (target, bucket) => {
      assert.equal(target.key, "Waste Management");
      assert.equal(bucket, "rank");
      return { sciif: "8.4", sciUp: "工程技术1区" };
    }
  } } } } } };
  const result = JSON.parse(JSON.stringify(context.CardViewMetricsAdapter.getMetrics(win, item)));
  assert.equal(result.impactFactor, "8.4");
  assert.equal(result.casPartition, "工程技术1区");
  assert.equal(result.source, "Zotero Style");
  assert.deepEqual(result.publicationBadges.map(badge => badge.text), [
    "IF 8.4",
    "SCI升级版 工程技术1区"
  ]);
});

test("Extra is a local fallback when Zotero Style is unavailable", () => {
  const item = { getField: field => field === "extra" ? "JIF: 6.3\n中科院分区：2区" : "" };
  const result = context.CardViewMetricsAdapter.getMetrics({ Zotero: {} }, item);
  assert.equal(result.impactFactor, "6.3");
  assert.equal(result.casPartition, "2区");
  assert.equal(result.source, "Extra");
});

test("legacy Zotero Style cache remains supported", () => {
  const item = { getField: () => "" };
  const win = { Zotero: { ZoteroStyle: { data: { views: { localStorage: {
    get: () => ({ sciif: "3.1", sciBase: "材料科学2区" })
  } } } } } };
  const result = context.CardViewMetricsAdapter.getMetrics(win, item);
  assert.equal(result.impactFactor, "3.1");
  assert.equal(result.casPartition, "材料科学2区");
});

test("PublicationTags fields, mappings, colors, and opacity mirror Zotero Style preferences", () => {
  const preferences = {
    "zoterostyle.function.publicationTagsColumn.enable": true,
    "zoterostyle.publicationTagsColumn.source": "easyscholar",
    "zoterostyle.publicationTagsColumn.fields": "sciif,sciUp,sciUpTop",
    "zoterostyle.publicationTagsColumn.map": "SCIIF=IF,SCI升级版=中科院",
    "zoterostyle.publicationTagsColumn.rankColors": "#ffe2dd,#e8deee,#dbeddb,#fadec9,#e9e8e7",
    "zoterostyle.publicationTagsColumn.defaultColor": "#86dad1",
    "zoterostyle.publicationTagsColumn.textColor": "#123456",
    "zoterostyle.publicationTagsColumn.opacity": "0.5",
    "zoterostyle.publicationTagsColumn.margin": "0.1",
    "zoterostyle.publicationTagsColumn.padding": "0.4"
  };
  const requestedPreferences = [];
  const win = { Zotero: { Prefs: { get: function (key) {
    assert.equal(arguments.length, 1, "Zotero Style preferences must use the plugin-pref namespace");
    requestedPreferences.push(key);
    return preferences[key];
  } } } };
  const badges = context.CardViewMetricsAdapter.publicationBadges(win, {
    sciif: "7.3",
    sciUp: "环境科学与生态学2区",
    sciUpTop: "环境科学与生态学TOP"
  });
  const plain = JSON.parse(JSON.stringify(badges));

  assert.deepEqual(plain.map(badge => badge.text), [
    "IF 7.3",
    "中科院 环境科学与生态学2区",
    "sciUpTop 环境科学与生态学TOP"
  ]);
  assert.equal(plain[0].backgroundColor, "rgba(232, 222, 238, 0.5)");
  assert.equal(plain[1].backgroundColor, "rgba(232, 222, 238, 0.5)");
  assert.equal(plain[2].backgroundColor, "rgba(255, 226, 221, 0.5)");
  assert.equal(plain[0].textColor, "#123456");
  assert.equal(plain[0].margin, 0.1);
  assert.equal(plain[0].padding, 0.4);
  assert.ok(requestedPreferences.includes("zoterostyle.publicationTagsColumn.fields"));
});

test("changing the configured field list changes the mirrored badges", () => {
  const win = { Zotero: { Prefs: { get: function (key) {
    assert.equal(arguments.length, 1);
    return key === "zoterostyle.publicationTagsColumn.fields" ? "sciUpTop" : undefined;
  } } } };
  const badges = context.CardViewMetricsAdapter.publicationBadges(win, {
    sciif: "7.3",
    sciUp: "环境科学2区",
    sciUpTop: "环境科学TOP"
  });
  assert.deepEqual(Array.from(badges, badge => badge.field), ["sciUpTop"]);
});

