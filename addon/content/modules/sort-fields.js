(function (root) {
  "use strict";

  const FIELDS = Object.freeze([
    { id: "date", label: "文献日期", defaultDirection: "desc" },
    { id: "title", label: "文献名", defaultDirection: "asc" },
    { id: "creator", label: "创建者", defaultDirection: "asc" },
    { id: "itemType", label: "条目类型", defaultDirection: "asc" },
    { id: "year", label: "年份", defaultDirection: "desc" },
    { id: "publication", label: "出版物", defaultDirection: "asc" },
    { id: "publisher", label: "出版社", defaultDirection: "asc" },
    { id: "dateAdded", label: "添加日期", defaultDirection: "desc" },
    { id: "dateModified", label: "修改日期", defaultDirection: "desc" },
    { id: "attachmentCount", label: "附件数量", defaultDirection: "desc" },
    { id: "noteCount", label: "笔记数量", defaultDirection: "desc" },
    { id: "tags", label: "标签", defaultDirection: "asc" },
    { id: "impactFactor", label: "期刊影响因子", defaultDirection: "desc" },
    { id: "journalPartition", label: "期刊分区", defaultDirection: "asc" },
    { id: "rating", label: "评级", defaultDirection: "desc" }
  ].map(field => Object.freeze(field)));

  const FIELD_BY_ID = new Map(FIELDS.map(field => [field.id, field]));
  const DEFAULT_ENABLED = Object.freeze(["date", "title", "impactFactor", "rating"]);

  function normalizeEnabled(value) {
    const requested = Array.isArray(value)
      ? value
      : String(value || "").split(",");
    const selected = new Set(requested.map(field => String(field).trim()).filter(field => FIELD_BY_ID.has(field)));
    const result = FIELDS.map(field => field.id).filter(field => selected.has(field));
    return result.length ? result : [...DEFAULT_ENABLED];
  }

  function serializeEnabled(fields) {
    return normalizeEnabled(fields).join(",");
  }

  function get(field) {
    return FIELD_BY_ID.get(field) || FIELD_BY_ID.get("date");
  }

  function defaultDirection(field) {
    return get(field).defaultDirection;
  }

  root.CardViewSortFields = {
    FIELDS,
    DEFAULT_ENABLED,
    normalizeEnabled,
    serializeEnabled,
    get,
    defaultDirection
  };
})(typeof _globalThis !== "undefined" ? _globalThis : (typeof globalThis !== "undefined" ? globalThis : this));
