(function (root) {
  "use strict";

  const STYLE_PREF_KEYS = Object.freeze([
    "zoterostyle.function.publicationTagsColumn.enable",
    "zoterostyle.publicationTagsColumn.source",
    "zoterostyle.publicationTagsColumn.fields",
    "zoterostyle.publicationTagsColumn.gardenFields",
    "zoterostyle.publicationTagsColumn.map",
    "zoterostyle.publicationTagsColumn.rankColors",
    "zoterostyle.publicationTagsColumn.defaultColor",
    "zoterostyle.publicationTagsColumn.textColor",
    "zoterostyle.publicationTagsColumn.opacity",
    "zoterostyle.publicationTagsColumn.margin",
    "zoterostyle.publicationTagsColumn.padding",
    "zoterostyle.IFColumn.field",
    "zoterostyle.function.ratingColumn.enable",
    "zoterostyle.ratingColumn.selectedStar",
    "zoterostyle.ratingColumn.unselectedStar",
    "zoterostyle.ratingColumn.padding",
    "zoterostyle.function.titleColumn.enable",
    "zoterostyle.titleColumn.color",
    "zoterostyle.titleColumn.opacity"
  ]);

  function createSnapshot(win) {
    return Object.freeze({
      metrics: root.CardViewMetricsAdapter.createConfig(win),
      rating: root.CardViewRatingAdapter.createConfig(win),
      readingProgress: root.CardViewReadingProgressAdapter.createConfig(win)
    });
  }

  root.CardViewSettings = { STYLE_PREF_KEYS, createSnapshot };
})(typeof _globalThis !== "undefined" ? _globalThis : (typeof globalThis !== "undefined" ? globalThis : this));
