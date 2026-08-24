const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "addon/manifest.json"), "utf8"));
const packageJSON = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const updateManifest = JSON.parse(fs.readFileSync(path.join(root, "updates.json"), "utf8"));

test("manifest follows Zotero 9 bootstrap compatibility requirements", () => {
  const target = manifest.applications?.zotero;
  assert.equal(manifest.manifest_version, 2);
  assert.match(target.id, /^[a-z0-9._-]+@[a-z0-9._-]+$/i);
  assert.match(target.update_url, /^https:\/\//);
  assert.equal(target.strict_min_version, "6.999");
  assert.equal(target.strict_max_version, "9.0.*");
});

test("package and add-on versions stay synchronized", () => {
  assert.equal(manifest.version, packageJSON.version);
});

test("release metadata points to the public repository", () => {
  const url = new URL(manifest.applications.zotero.update_url);
  assert.equal(url.protocol, "https:");
  assert.equal(url.hostname, "raw.githubusercontent.com");
  assert.equal(manifest.applications.zotero.id, "zotero-card-view@ok-feng-hash.github.io");
});

test("update manifest matches the packaged add-on", () => {
  const id = manifest.applications.zotero.id;
  const update = updateManifest.addons?.[id]?.updates?.[0];
  assert.ok(update);
  assert.equal(update.version, manifest.version);
  assert.equal(
    update.update_link,
    `https://github.com/OK-Feng-hash/zotero-card-view/releases/download/v${manifest.version}/zotero-card-view-${manifest.version}.xpi`
  );
  assert.match(update.update_hash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(
    update.applications.zotero.strict_min_version,
    manifest.applications.zotero.strict_min_version
  );
  assert.equal(
    update.applications.zotero.strict_max_version,
    manifest.applications.zotero.strict_max_version
  );
});

