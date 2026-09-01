const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("toolbar toggle is inserted before Zotero's flexible spacer", () => {
  const source = fs.readFileSync(
    path.join(root, "addon", "content", "modules", "card-view.js"),
    "utf8"
  );

  assert.match(source, /querySelector\("spacer\[flex='1'\]"\)/);
  assert.match(source, /toolbar\.insertBefore\(button, flexibleSpacer\)/);
  assert.doesNotMatch(source, /getElementById\("zotero-items-toolbar"\)\.append\(button\)/);
});

test("toolbar icon has a concrete XUL-compatible stroke color", () => {
  const icon = fs.readFileSync(
    path.join(root, "addon", "content", "icons", "card-view.svg"),
    "utf8"
  );

  assert.match(icon, /stroke="#[0-9a-fA-F]{6}"/);
  assert.doesNotMatch(icon, /currentColor/);
});

test("startup injects existing windows and provides a View-menu fallback", () => {
  const entry = fs.readFileSync(
    path.join(root, "addon", "content", "modules", "index.js"),
    "utf8"
  );
  const controller = fs.readFileSync(
    path.join(root, "addon", "content", "modules", "card-view.js"),
    "utf8"
  );

  assert.match(entry, /Zotero\.getMainWindows\(\)/);
  assert.match(entry, /await this\.onMainWindowLoad\(win\)/);
  assert.match(controller, /id = "zotero-card-view-menuitem"/);
  assert.match(controller, /label", "文献卡片视图"/);
});

test("card mode removes the native tree from layout and owns scrolling", () => {
  const source = fs.readFileSync(
    path.join(root, "addon", "content", "modules", "card-view.js"),
    "utf8"
  );
  const css = fs.readFileSync(
    path.join(root, "addon", "content", "card-view.css"),
    "utf8"
  );

  assert.match(source, /setProperty\("display", "none", "important"\)/);
  assert.match(source, /classList\.toggle\("card-view-host-active", active\)/);
  assert.match(source, /originalTreeDisplayPriority/);
  assert.match(source, /container\?\.style\.setProperty\("display", "none", "important"\)/);
  assert.match(css, /#zotero-items-pane\.card-view-host-active > #zotero-items-tree/);
  assert.match(css, /overflow:\s*auto/);
});

test("card view exposes configurable persistent sorting", () => {
  const source = fs.readFileSync(
    path.join(root, "addon", "content", "modules", "card-view.js"),
    "utf8"
  );
  const fields = fs.readFileSync(
    path.join(root, "addon", "content", "modules", "sort-fields.js"),
    "utf8"
  );
  assert.match(fields, /id: "date", label: "文献日期"/);
  assert.match(fields, /id: "title", label: "文献名"/);
  assert.match(fields, /id: "impactFactor", label: "期刊影响因子"/);
  assert.match(source, /enabledSortFields/);
  assert.match(source, /card-view-sort-fields-panel/);
  assert.match(source, /CardViewPreferences\.migrateLegacy/);
  assert.match(source, /CardViewPreferences\.set/);
  assert.match(source, /CardViewSorter\.sortModels/);
});

test("long abstracts expose a nested expand and collapse control", () => {
  const source = fs.readFileSync(
    path.join(root, "addon", "content", "modules", "card-renderer.js"),
    "utf8"
  );
  const css = fs.readFileSync(
    path.join(root, "addon", "content", "card-view.css"),
    "utf8"
  );
  assert.match(source, /ABSTRACT_COLLAPSE_THRESHOLD = 500/);
  assert.match(source, /… 展开摘要/);
  assert.match(source, /收起摘要/);
  assert.match(css, /-webkit-line-clamp:\s*6/);
});

test("Zotero Style preference changes trigger a live card refresh", () => {
  const controller = fs.readFileSync(
    path.join(root, "addon", "content", "modules", "card-view.js"),
    "utf8"
  );
  const settings = fs.readFileSync(
    path.join(root, "addon", "content", "modules", "settings.js"),
    "utf8"
  );
  assert.match(settings, /zoterostyle\.publicationTagsColumn\.fields/);
  assert.match(controller, /Zotero\.Prefs\.registerObserver/);
  assert.match(controller, /modelStore\.refreshSettings\(\)/);
  assert.match(controller, /Zotero\.Prefs\.unregisterObserver/);
});

test("card view incrementally mirrors Zotero Style metric cache updates", () => {
  const bootstrap = fs.readFileSync(path.join(root, "addon", "bootstrap.js"), "utf8");
  const controller = fs.readFileSync(
    path.join(root, "addon", "content", "modules", "card-view.js"),
    "utf8"
  );
  const sync = fs.readFileSync(
    path.join(root, "addon", "content", "modules", "style-metrics-sync.js"),
    "utf8"
  );
  assert.match(bootstrap, /style-metrics-sync\.js/);
  assert.match(sync, /storage\.lock\?\.promise/);
  assert.match(sync, /renderCell\(entry\.item, "publicationTags"\)/);
  assert.match(controller, /modelStore\.invalidate\(ids\)/);
  assert.match(controller, /queueVisibleMetricsSync/);
});

test("expanded cards reveal the complete paper title", () => {
  const css = fs.readFileSync(
    path.join(root, "addon", "content", "card-view.css"),
    "utf8"
  );
  assert.match(css, /\.zotero-card-view-card\.expanded \.card-view-title\s*\{/);
  assert.match(css, /-webkit-line-clamp:\s*unset/);
  assert.match(css, /overflow:\s*visible/);
});

test("card view displays Zotero Style ratings and offers rating sorting", () => {
  const controller = fs.readFileSync(
    path.join(root, "addon", "content", "modules", "card-view.js"),
    "utf8"
  );
  const renderer = fs.readFileSync(
    path.join(root, "addon", "content", "modules", "card-renderer.js"),
    "utf8"
  );
  const settings = fs.readFileSync(
    path.join(root, "addon", "content", "modules", "settings.js"),
    "utf8"
  );
  const fields = fs.readFileSync(
    path.join(root, "addon", "content", "modules", "sort-fields.js"),
    "utf8"
  );
  assert.match(fields, /id: "rating", label: "评级"/);
  assert.match(renderer, /createRating\(model\.rating\)/);
  assert.match(settings, /zoterostyle\.ratingColumn\.selectedStar/);
});

test("optimized view lazily renders details and reuses cached card models", () => {
  const controller = fs.readFileSync(
    path.join(root, "addon", "content", "modules", "card-view.js"),
    "utf8"
  );
  const presenter = fs.readFileSync(
    path.join(root, "addon", "content", "modules", "item-presenter.js"),
    "utf8"
  );
  assert.match(controller, /modelStore\.getSummary\(item\)/);
  assert.match(controller, /card\?\._cardViewModel === model/);
  assert.match(controller, /modelStore\.getDetails\(item\)/);
  assert.match(presenter, /function presentSummary/);
  assert.match(presenter, /function presentDetails/);
});

test("PDF tab round trips preserve card position and defer hidden renders", () => {
  const bootstrap = fs.readFileSync(path.join(root, "addon", "bootstrap.js"), "utf8");
  const controller = fs.readFileSync(
    path.join(root, "addon", "content", "modules", "card-view.js"),
    "utf8"
  );
  assert.match(bootstrap, /view-position\.js/);
  assert.match(controller, /\["item", "collection", "tab"\]/);
  assert.match(controller, /type === "tab"/);
  assert.match(controller, /if \(!this\.libraryTabActive\) return/);
  assert.match(controller, /CardViewViewPosition\.capture/);
  assert.match(controller, /queueViewPositionRestore/);
});

test("card titles mirror Ethereal Style reading progress without click actions", () => {
  const bootstrap = fs.readFileSync(path.join(root, "addon", "bootstrap.js"), "utf8");
  const controller = fs.readFileSync(
    path.join(root, "addon", "content", "modules", "card-view.js"),
    "utf8"
  );
  const renderer = fs.readFileSync(
    path.join(root, "addon", "content", "modules", "card-renderer.js"),
    "utf8"
  );
  const settings = fs.readFileSync(
    path.join(root, "addon", "content", "modules", "settings.js"),
    "utf8"
  );
  const css = fs.readFileSync(path.join(root, "addon", "content", "card-view.css"), "utf8");
  assert.match(bootstrap, /reading-progress-adapter\.js/);
  assert.match(controller, /modelStore\.getReadingProgress\(model\.item\)/);
  assert.match(controller, /_cardViewReadingProgressSignature/);
  assert.match(renderer, /card-view-reading-progress-segment/);
  assert.doesNotMatch(renderer, /dataCardAction.*reading|data-card-action.*reading/i);
  assert.match(settings, /zoterostyle\.titleColumn\.color/);
  assert.match(settings, /zoterostyle\.titleColumn\.opacity/);
  assert.match(css, /pointer-events:\s*none/);
});
