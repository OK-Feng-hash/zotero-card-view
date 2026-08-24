(function (root) {
  "use strict";

  function cleanText(value) {
    return String(value ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function firstNonEmpty(...values) {
    return values.map(cleanText).find(Boolean) || "";
  }

  function parseExtraField(extra, names) {
    const accepted = new Set(names.map(name => name.toLowerCase()));
    for (const line of String(extra || "").split(/\r?\n/)) {
      const match = line.match(/^\s*([^:：]+)\s*[:：]\s*(.+?)\s*$/);
      if (match && accepted.has(match[1].trim().toLowerCase())) return cleanText(match[2]);
    }
    return "";
  }

  root.CardViewTextUtils = { cleanText, firstNonEmpty, parseExtraField };
})(typeof _globalThis !== "undefined" ? _globalThis : (typeof globalThis !== "undefined" ? globalThis : this));

