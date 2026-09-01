(function (root) {
  "use strict";

  const DEFAULT_COLOR = "#FFC6D3";
  const DEFAULT_OPACITY = 0.7;
  const MIN_SCALE_SECONDS = 60;
  const MAX_PAGE_COUNT = 5000;

  function pref(win, key, fallback) {
    try {
      const value = win.Zotero?.Prefs?.get?.(`zoterostyle.${key}`);
      return value === undefined || value === null || value === "" ? fallback : value;
    } catch (_) { return fallback; }
  }

  function boundedNumber(value, fallback, minimum, maximum) {
    const number = Number.parseFloat(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(maximum, Math.max(minimum, number));
  }

  function createConfig(win) {
    return Object.freeze({
      enabled: pref(win, "function.titleColumn.enable", true) !== false,
      color: String(pref(win, "titleColumn.color", DEFAULT_COLOR)),
      opacity: boundedNumber(pref(win, "titleColumn.opacity", DEFAULT_OPACITY), DEFAULT_OPACITY, 0, 1)
    });
  }

  function pageCount(record) {
    const explicit = Math.trunc(Number(record?.page));
    if (Number.isFinite(explicit) && explicit > 0) return Math.min(explicit, MAX_PAGE_COUNT);
    const indices = Object.keys(record?.data || {})
      .map(key => Number(key))
      .filter(index => Number.isInteger(index) && index >= 0);
    return indices.length ? Math.min(Math.max(...indices) + 1, MAX_PAGE_COUNT) : 0;
  }

  function readRecord(win, item) {
    try {
      const storage = win.Zotero?.ZoteroStyle?.api?.storage;
      const record = storage?.get?.(item, "readingTime");
      return record && typeof record === "object" && typeof record.then !== "function" ? record : null;
    } catch (_) { return null; }
  }

  function normalizedIntensities(record) {
    const count = pageCount(record);
    if (!count) return [];
    const values = Array.from({ length: count }, (_, index) => {
      const seconds = Number.parseFloat(record.data?.[index]);
      return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
    });
    const maximum = Math.max(...values);
    if (!maximum) return [];
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const scale = Math.max(MIN_SCALE_SECONDS, mean + (maximum - mean) * 0.5);
    return values.map(value => Math.min(1, value / scale));
  }

  function signature(color, opacity, intensities) {
    return `${color}|${opacity}|${intensities.map(value => value.toFixed(4)).join(",")}`;
  }

  function getProgress(win, item, config = null) {
    const settings = config || createConfig(win);
    if (!settings.enabled || settings.opacity <= 0 || !win.Zotero?.ZoteroStyle) return null;
    const intensities = normalizedIntensities(readRecord(win, item));
    if (!intensities.length) return null;
    return Object.freeze({
      color: settings.color,
      opacity: settings.opacity,
      intensities: Object.freeze(intensities),
      signature: signature(settings.color, settings.opacity, intensities)
    });
  }

  root.CardViewReadingProgressAdapter = {
    createConfig,
    getProgress,
    pageCount,
    normalizedIntensities
  };
})(typeof _globalThis !== "undefined" ? _globalThis : (typeof globalThis !== "undefined" ? globalThis : this));
