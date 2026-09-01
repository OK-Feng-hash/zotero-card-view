(function (root) {
  "use strict";

  const LEGACY_STAR = "⭐";
  const MAX_RATING = 5;

  function parseRatingValue(value) {
    const text = String(value || "").trim();
    if (!/^\d+$/.test(text)) return 0;
    const rating = Number(text);
    return rating >= 1 && rating <= MAX_RATING ? rating : 0;
  }

  function isLegacyRatingTagName(tagName) {
    const characters = Array.from(String(tagName || ""));
    return characters.length >= 1
      && characters.length <= MAX_RATING
      && characters.every(character => character === LEGACY_STAR);
  }

  function isUncoloredLegacyRatingTag(win, item, tagName) {
    if (!isLegacyRatingTagName(tagName)) return false;
    try { return !win.Zotero.Tags.getColor(item.libraryID, tagName); }
    catch (_) { return true; }
  }

  function stylePref(win, key, fallback) {
    try {
      const value = win.Zotero?.Prefs?.get?.(`zoterostyle.${key}`);
      return value === undefined || value === null || value === "" ? fallback : value;
    } catch (_) { return fallback; }
  }

  function createConfig(win) {
    const padding = Number.parseFloat(stylePref(win, "ratingColumn.padding", "2"));
    return Object.freeze({
      enabled: stylePref(win, "function.ratingColumn.enable", true) !== false,
      selectedStar: String(stylePref(win, "ratingColumn.selectedStar", "⭐")),
      unselectedStar: String(stylePref(win, "ratingColumn.unselectedStar", "🌙")),
      padding: Number.isFinite(padding) ? padding : 2
    });
  }

  function getRating(win, item, config = null) {
    const settings = config || createConfig(win);
    if (!settings.enabled) return null;
    let value = 0;
    try {
      const extra = item.getField("extra") || "";
      value = parseRatingValue(root.CardViewTextUtils.parseExtraField(extra, ["rate", "rating", "评级"]));
    } catch (_) {}

    if (!value) {
      try {
        const tag = item.getTags().find(({ tag: tagName }) => (
          isUncoloredLegacyRatingTag(win, item, tagName)
        ));
        if (tag) value = Array.from(tag.tag).length;
      } catch (_) {}
    }
    if (!value) return null;

    return {
      value,
      selectedStar: settings.selectedStar,
      unselectedStar: settings.unselectedStar,
      padding: settings.padding
    };
  }

  root.CardViewRatingAdapter = {
    parseRatingValue,
    isLegacyRatingTagName,
    isUncoloredLegacyRatingTag,
    createConfig,
    getRating
  };
})(typeof _globalThis !== "undefined" ? _globalThis : (typeof globalThis !== "undefined" ? globalThis : this));
