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

  function numericValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function stringValue(value) {
    const text = String(value || "").trim();
    return text || null;
  }

  function partitionValue(metrics = {}) {
    const badges = Array.isArray(metrics.publicationBadges) ? metrics.publicationBadges : [];
    const partitionBadges = badges.filter(badge =>
      /sci(?:up|base)|中科院|cas/i.test(`${badge?.field || ""} ${badge?.text || ""}`)
    );
    const texts = [metrics.casPartition, ...partitionBadges.map(badge => badge?.text)]
      .filter(Boolean).map(String);
    let rank = null;
    for (const text of texts) {
      const match = text.match(/([1-4])\s*区/i) || text.match(/\bQ([1-4])\b/i);
      if (match) rank = rank == null ? Number(match[1]) : Math.min(rank, Number(match[1]));
    }
    return rank == null ? null : {
      rank,
      top: partitionBadges.some(badge => /top/i.test(`${badge?.field || ""} ${badge?.text || ""}`))
        || texts.some(text => /top/i.test(text))
    };
  }

  function compareOptional(left, right, direction) {
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    const comparison = left < right ? -1 : (left > right ? 1 : 0);
    return direction === "desc" ? -comparison : comparison;
  }

  function compareStrings(left, right, direction) {
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    const comparison = left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
    return direction === "desc" ? -comparison : comparison;
  }

  function comparePartitions(left, right, direction) {
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    const rankComparison = compareOptional(left.rank, right.rank, direction);
    if (rankComparison) return rankComparison;
    if (left.top !== right.top) return left.top ? -1 : 1;
    return 0;
  }

  function compareModels(left, right, field, direction) {
    let comparison = 0;
    if (["title", "creator", "itemType", "publication", "publisher", "tags"].includes(field)) {
      const leftValue = field === "title" ? left.title : left.sortValues?.[field];
      const rightValue = field === "title" ? right.title : right.sortValues?.[field];
      comparison = compareStrings(stringValue(leftValue), stringValue(rightValue), direction);
    } else if (field === "impactFactor") {
      comparison = compareOptional(
        impactFactorValue(left.metrics?.impactFactor),
        impactFactorValue(right.metrics?.impactFactor),
        direction
      );
    } else if (field === "rating") {
      comparison = compareOptional(numericValue(left.rating?.value), numericValue(right.rating?.value), direction);
    } else if (field === "attachmentCount" || field === "noteCount") {
      comparison = compareOptional(numericValue(left[field]), numericValue(right[field]), direction);
    } else if (field === "year") {
      comparison = compareOptional(numericValue(left.sortValues?.year), numericValue(right.sortValues?.year), direction);
    } else if (field === "dateAdded" || field === "dateModified") {
      comparison = compareOptional(
        dateValue(left.sortValues?.[field]),
        dateValue(right.sortValues?.[field]),
        direction
      );
    } else if (field === "journalPartition") {
      comparison = comparePartitions(partitionValue(left.metrics), partitionValue(right.metrics), direction);
    } else {
      comparison = compareOptional(dateValue(left.date), dateValue(right.date), direction);
    }
    return comparison || String(left.title || "").localeCompare(String(right.title || ""));
  }

  function sortModels(models, field, direction) {
    return [...models].sort((left, right) => compareModels(left, right, field, direction));
  }

  root.CardViewSorter = {
    dateValue,
    impactFactorValue,
    partitionValue,
    compareModels,
    sortModels
  };
})(typeof _globalThis !== "undefined" ? _globalThis : (typeof globalThis !== "undefined" ? globalThis : this));
