(function (root) {
  "use strict";

  const PREFIX = "extensions.zotero.cardView.";
  const LEGACY_PREFIX = "extensions.zotero.extensions.zotero.cardView.";
  const NAMES = Object.freeze([
    "enabled",
    "sortField",
    "sortDirection",
    "enabledSortFields"
  ]);

  function get(win, name, fallback) {
    try {
      const value = win.Zotero.Prefs.get(`${PREFIX}${name}`, true);
      return value === undefined || value === null ? fallback : value;
    } catch (_) { return fallback; }
  }

  function set(win, name, value) {
    win.Zotero.Prefs.set(`${PREFIX}${name}`, value, true);
  }

  function migrateLegacy(win, services = root.Services) {
    const prefs = services?.prefs;
    if (!prefs?.prefHasUserValue) return [];
    const migrated = [];
    for (const name of NAMES) {
      const currentKey = `${PREFIX}${name}`;
      const legacyKey = `${LEGACY_PREFIX}${name}`;
      if (prefs.prefHasUserValue(currentKey) || !prefs.prefHasUserValue(legacyKey)) continue;
      try {
        const value = win.Zotero.Prefs.get(legacyKey, true);
        if (value === undefined || value === null) continue;
        set(win, name, value);
        migrated.push(name);
      } catch (_) {}
    }
    return migrated;
  }

  root.CardViewPreferences = { PREFIX, LEGACY_PREFIX, NAMES, get, set, migrateLegacy };
})(typeof _globalThis !== "undefined" ? _globalThis : (typeof globalThis !== "undefined" ? globalThis : this));
