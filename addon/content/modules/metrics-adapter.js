(function (root) {
  "use strict";

  const { cleanText, firstNonEmpty, parseExtraField } = root.CardViewTextUtils;

  function publicationTitle(item) {
    for (const field of ["publicationTitle", "conferenceName", "university", "publisher"]) {
      try {
        const value = cleanText(item.getField(field));
        if (value) return value;
      } catch (_) {}
    }
    return "";
  }

  function readStyleCache(win, item) {
    try {
      const style = win.Zotero?.ZoteroStyle;
      const title = publicationTitle(item);
      const currentStorage = style?.api?.itemTreeExtensionHost?.localStorage;
      const currentValue = title ? currentStorage?.get?.({ key: title }, "rank") : null;
      if (currentValue && typeof currentValue === "object") return currentValue;

      const legacyViews = style?.data?.views;
      const legacyStorage = legacyViews?.localStorage || legacyViews?.storage;
      const legacyValue = legacyStorage?.get?.(item, "publication");
      return legacyValue && typeof legacyValue === "object" ? legacyValue : {};
    } catch (error) {
      win.Zotero?.debug?.(`[CardView] Zotero Style cache unavailable: ${error}`);
      return {};
    }
  }

  function normalizePartition(value) {
    const text = cleanText(value);
    if (!text) return "";
    if (/top/i.test(text) && !/区/.test(text)) return `TOP · ${text}`;
    return text;
  }

  function pref(win, key, fallback) {
    try {
      const value = win.Zotero?.Prefs?.get?.(`zoterostyle.${key}`);
      return value === undefined || value === null || value === "" ? fallback : value;
    } catch (_) { return fallback; }
  }

  function numeric(value, fallback) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function fieldInfo(field, rawValue, source = "easyscholar") {
    let value = cleanText(rawValue).replace("类", "");
    let key = field;
    let rank = 1;
    if (source === "garden") {
      const number = Number(value);
      const ifRank = metric => metric >= 10 ? 1 : metric >= 4 ? 2 : metric >= 2 ? 3 : metric >= 1 ? 4 : 5;
      const zone = () => {
        const values = [...value].map(Number).filter(digit => digit >= 1 && digit <= 4);
        return values.length ? Math.min(...values) : 1;
      };
      if (field === "IF" || field === "5YIF") {
        return { field, key: field, value, rank: ifRank(number) };
      }
      if (field === "JCI" || field === "jci") {
        rank = number >= 3 ? 1 : number >= 1 ? 2 : number >= 0.5 ? 3 : 4;
      } else if (field === "JCR") {
        return { field, key: "SCI", value: `Q${value}`, rank: number || 4 };
      } else if (field === "中科院 2025") {
        rank = zone();
        return { field, key: "中科院", value: `${rank}区`, rank };
      } else if (field === "新锐") {
        rank = zone();
        return { field, key: "新锐", value: `${rank}区`, rank };
      } else if (field === "CiteScore") {
        rank = number >= 50 ? 1 : number >= 15 ? 2 : number >= 5 ? 3 : number >= 1 ? 4 : 5;
      } else if (field === "SJR") {
        rank = number >= 10 ? 1 : number >= 3 ? 2 : number >= 1 ? 3 : number >= 0.3 ? 4 : 5;
      }
      return { field, key, value, rank };
    }
    if (field === "sciif" || field === "sciif5") {
      key = field === "sciif" ? "SCIIF" : "SCIIF(5)";
      const number = Number.parseFloat(value);
      rank = number >= 10 ? 1 : number >= 4 ? 2 : number >= 2 ? 3 : number >= 1 ? 4 : 5;
    } else if (field === "sci") {
      key = "SCI";
      const match = value.match(/Q([1-4])/i);
      rank = match ? Number(match[1]) : 1;
    } else if (field === "sciBase" || field === "sciUp") {
      key = field === "sciBase" ? "SCI基础版" : "SCI升级版";
      const match = value.match(/([1-4])区/);
      rank = match ? Number(match[1]) : 1;
    } else {
      const embeddedRank = value.match(/(.+)\[rank=([1-5])\]/);
      if (embeddedRank) {
        value = embeddedRank[1];
        rank = Number(embeddedRank[2]);
      } else if (/^[A-D]$/i.test(value)) {
        rank = value.toUpperCase().charCodeAt(0) - 64;
      } else {
        const numericRank = value.match(/[1-5]/);
        if (numericRank) rank = Number(numericRank[0]);
      }
    }
    return { field, key, value, rank };
  }

  function parseMappings(value) {
    return String(value || "").split(/[,;]\s*/).map(entry => {
      const separator = entry.indexOf("=");
      if (separator < 0) return null;
      const from = entry.slice(0, separator).trim();
      const to = entry.slice(separator + 1).trim();
      const regex = from.match(/^\/(.+)\/([a-z]*)$/i);
      try { return regex ? [new RegExp(regex[1], regex[2]), to] : [from, to]; }
      catch (_) { return null; }
    }).filter(Boolean);
  }

  function mapText(value, mappings) {
    let result = String(value || "");
    for (const [from, to] of mappings) {
      if (typeof from === "string" && from === result) return to;
      if (from instanceof RegExp && from.test(result)) return result.replace(from, to);
    }
    return result;
  }

  function hexRGB(color) {
    const value = String(color || "").trim();
    const short = value.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
    const full = value.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (short) return short.slice(1).map(part => Number.parseInt(part + part, 16));
    if (full) return full.slice(1).map(part => Number.parseInt(part, 16));
    return null;
  }

  function autoTextColor(color) {
    const rgb = hexRGB(color);
    if (!rgb) return color;
    const [red, green, blue] = rgb.map(channel => channel / 255);
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;
    let hue = 0;
    if (delta) {
      if (max === red) hue = ((green - blue) / delta) % 6;
      else if (max === green) hue = (blue - red) / delta + 2;
      else hue = (red - green) / delta + 4;
      hue = (hue * 60 + 360) % 360;
    }
    const lightness = (max + min) / 2;
    const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
    return `hsl(${Math.round(hue)} ${Math.round(saturation * 100)}% 40%)`;
  }

  function createConfig(win) {
    const source = pref(win, "publicationTagsColumn.source", "easyscholar");
    const fieldsValue = pref(
      win,
      source === "garden" ? "publicationTagsColumn.gardenFields" : "publicationTagsColumn.fields",
      "sciif, sciUp"
    );
    return Object.freeze({
      enabled: pref(win, "function.publicationTagsColumn.enable", true) !== false,
      source,
      fields: Object.freeze(String(fieldsValue).split(/,\s*/).filter(Boolean)),
      colors: Object.freeze(String(pref(
        win,
        "publicationTagsColumn.rankColors",
        "#ffe2dd, #e8deee, #dbeddb, #fadec9, #e9e8e7"
      )).split(/,\s*/).filter(Boolean)),
      defaultColor: pref(win, "publicationTagsColumn.defaultColor", "#86dad1"),
      textColor: pref(win, "publicationTagsColumn.textColor", "auto"),
      opacity: numeric(pref(win, "publicationTagsColumn.opacity", "1"), 1),
      margin: numeric(pref(win, "publicationTagsColumn.margin", "0.08"), 0.08),
      padding: numeric(pref(win, "publicationTagsColumn.padding", "0.455"), 0.455),
      mappings: Object.freeze(parseMappings(pref(
        win,
        "publicationTagsColumn.map",
        "SCIIF=IF, SCIIF(5)=IF(5)"
      ))),
      selectedIFField: pref(win, "IFColumn.field", "sciif")
    });
  }

  function publicationBadges(win, data, config = null) {
    if (!Object.keys(data).length) return [];
    const settings = config || createConfig(win);
    if (!settings.enabled) return [];
    const fields = settings.fields.filter(field => data[field] !== undefined && data[field] !== "");

    return fields.map(field => {
      const info = fieldInfo(field, data[field], settings.source);
      const color = settings.colors[info.rank - 1] || settings.colors.at(-1) || settings.defaultColor;
      const text = [...new Set([mapText(info.key, settings.mappings), mapText(info.value, settings.mappings)])]
        .filter(Boolean).join(" ");
      const rgb = hexRGB(color);
      return {
        field,
        text,
        rank: info.rank,
        backgroundColor: rgb
          ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${settings.opacity})`
          : color,
        textColor: settings.textColor === "auto" ? autoTextColor(color) : settings.textColor,
        margin: settings.margin,
        padding: settings.padding
      };
    });
  }

  function getMetrics(win, item, config = null) {
    const settings = config || createConfig(win);
    const data = readStyleCache(win, item);
    const extra = item.getField?.("extra") || "";
    const impactFactor = firstNonEmpty(
      data[settings.selectedIFField],
      data.sciif,
      data.sciif5,
      parseExtraField(extra, ["SCIIF", "IF", "Impact Factor", "JIF"])
    );
    const casPartition = normalizePartition(firstNonEmpty(
      data.sciUp,
      data.sciBase,
      parseExtraField(extra, ["SCI升级版", "中科院分区", "CAS Partition"])
    ));
    return {
      impactFactor,
      casPartition,
      publicationBadges: publicationBadges(win, data, settings),
      source: Object.keys(data).length ? "Zotero Style" : (impactFactor || casPartition ? "Extra" : "")
    };
  }

  root.CardViewMetricsAdapter = {
    getMetrics,
    createConfig,
    normalizePartition,
    publicationTitle,
    readStyleCache,
    fieldInfo,
    parseMappings,
    mapText,
    publicationBadges,
    autoTextColor
  };
})(typeof _globalThis !== "undefined" ? _globalThis : (typeof globalThis !== "undefined" ? globalThis : this));

