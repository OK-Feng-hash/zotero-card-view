(function (root) {
  "use strict";

  function dateValue(value) {
    const parts = String(value || "").match(/\d+/g) || [];
    const yearIndex = parts.findIndex(part => part.length === 4);
    if (yearIndex < 0) return null;
    const year = Number(parts[yearIndex]);
    const month = Number(parts[yearIndex + 1] || (yearIndex > 0 ? parts[yearIndex - 1] : 1));
    const day = Number(parts[yearIndex + 2] || 1);
    return year * 10000 + Math.min(Math.max(month, 1), 12) * 100 + Math.min(Math.max(day, 1), 31);
  }

  function impactFactorValue(value) {
    const number = Number.parseFloat(String(value || "").replace(",", "."));
    return Number.isFinite(number) ? number : null;
  }

  function compareOptional(left, right, direction) {
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    const comparison = left < right ? -1 : (left > right ? 1 : 0);
    return direction === "desc" ? -comparison : comparison;
  }

  function compareModels(left, right, field, direction) {
    let comparison = 0;
    if (field === "title") {
      comparison = String(left.title || "").localeCompare(String(right.title || ""), undefined, {
        numeric: true,
        sensitivity: "base"
      });
      if (direction === "desc") comparison *= -1;
    } else if (field === "impactFactor") {
      comparison = compareOptional(
        impactFactorValue(left.metrics?.impactFactor),
        impactFactorValue(right.metrics?.impactFactor),
        direction
      );
    } else if (field === "rating") {
      comparison = compareOptional(left.rating?.value || null, right.rating?.value || null, direction);
    } else {
      comparison = compareOptional(dateValue(left.date), dateValue(right.date), direction);
    }
    return comparison || String(left.title || "").localeCompare(String(right.title || ""));
  }

  function sortModels(models, field, direction) {
    return [...models].sort((left, right) => compareModels(left, right, field, direction));
  }

  root.CardViewSorter = { dateValue, impactFactorValue, compareModels, sortModels };
})(typeof _globalThis !== "undefined" ? _globalThis : (typeof globalThis !== "undefined" ? globalThis : this));

