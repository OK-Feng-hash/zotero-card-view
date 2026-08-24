var chromeHandle = null;
var moduleContext = null;

function install() {}

async function startup({ rootURI }) {
  const aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  chromeHandle = aomStartup.registerChrome(Services.io.newURI(rootURI + "manifest.json"), [
    ["content", "zotero-card-view", rootURI + "content/"]
  ]);

  await Zotero.initializationPromise;
  initDefaultPrefs();

  moduleContext = {
    rootURI,
    Zotero,
    Services,
    IOUtils,
    PathUtils,
    ChromeUtils,
    Components,
    setTimeout,
    clearTimeout
  };
  moduleContext._globalThis = moduleContext;

  for (const file of [
    "text-utils.js",
    "sorter.js",
    "rating-adapter.js",
    "metrics-adapter.js",
    "settings.js",
    "item-presenter.js",
    "model-store.js",
    "card-renderer.js",
    "card-view.js",
    "index.js"
  ]) {
    Services.scriptloader.loadSubScript(rootURI + "content/modules/" + file, moduleContext);
  }

  moduleContext.ZoteroCardView.rootURI = rootURI;
  await moduleContext.ZoteroCardView.startup();
}

async function onMainWindowLoad({ window }) {
  if (moduleContext?.ZoteroCardView) {
    await moduleContext.ZoteroCardView.onMainWindowLoad(window);
  }
}

async function onMainWindowUnload({ window }) {
  if (moduleContext?.ZoteroCardView) {
    await moduleContext.ZoteroCardView.onMainWindowUnload(window);
  }
}

async function shutdown(_data, reason) {
  if (reason === APP_SHUTDOWN) return;
  if (moduleContext?.ZoteroCardView) {
    await moduleContext.ZoteroCardView.shutdown();
  }
  moduleContext = null;
  chromeHandle?.destruct();
  chromeHandle = null;
}

function uninstall() {}

function initDefaultPrefs() {
  const branch = Services.prefs.getDefaultBranch("extensions.zotero.cardView.");
  branch.setBoolPref("enabled", false);
  branch.setCharPref("sortField", "date");
  branch.setCharPref("sortDirection", "desc");
}

