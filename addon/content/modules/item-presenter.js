(function (root) {
  "use strict";

  const { cleanText, firstNonEmpty, parseExtraField } = root.CardViewTextUtils;

  function safeField(item, field) {
    try { return cleanText(item.getField(field)); } catch (_) { return ""; }
  }

  function creatorName(creator) {
    return firstNonEmpty(
      [creator.firstName, creator.lastName].filter(Boolean).join(" "),
      creator.name,
      creator.lastName
    );
  }

  function creatorRole(win, creator) {
    try {
      return cleanText(win.Zotero.CreatorTypes.getLocalizedString(creator.creatorTypeID));
    } catch (_) {
      try { return cleanText(win.Zotero.CreatorTypes.getName(creator.creatorTypeID)); }
      catch (_) { return ""; }
    }
  }

  function getCreators(win, item) {
    try {
      return item.getCreators().map(creator => ({
        name: creatorName(creator),
        role: creatorRole(win, creator)
      })).filter(creator => creator.name);
    } catch (_) { return []; }
  }

  function getTags(win, item) {
    try {
      return item.getTags()
        .map(tag => cleanText(tag.tag))
        .filter(tag => tag && !root.CardViewRatingAdapter.isUncoloredLegacyRatingTag(win, item, tag));
    }
    catch (_) { return []; }
  }

  function getCollections(win, item) {
    try {
      return item.getCollections()
        .map(id => win.Zotero.Collections.get(id))
        .filter(Boolean)
        .map(collection => cleanText(collection.name));
    } catch (_) { return []; }
  }

  function getChildren(win, item, method, type) {
    try {
      return item[method]().map(id => win.Zotero.Items.get(id)).filter(child => child && child[type]());
    } catch (_) { return []; }
  }

  function childIDs(item, method) {
    try { return item[method](); } catch (_) { return []; }
  }

  function noteTitle(note) {
    try { return firstNonEmpty(note.getNoteTitle?.(), note.getDisplayTitle?.(), cleanText(note.note).slice(0, 80), "笔记"); }
    catch (_) { return "笔记"; }
  }

  function attachmentTitle(attachment) {
    return firstNonEmpty(safeField(attachment, "title"), attachment.attachmentFilename, "附件");
  }

  function presentSummary(win, item, settings = {}) {
    const tags = getTags(win, item);
    return {
      id: item.id,
      key: item.key,
      item,
      title: firstNonEmpty(safeField(item, "title"), "无标题条目"),
      date: firstNonEmpty(safeField(item, "date"), safeField(item, "year")),
      journal: firstNonEmpty(safeField(item, "publicationTitle"), safeField(item, "proceedingsTitle"), safeField(item, "publisher")),
      rating: root.CardViewRatingAdapter.getRating(win, item, settings.rating),
      tags,
      noteCount: childIDs(item, "getNotes").length,
      attachmentCount: childIDs(item, "getAttachments").length,
      metrics: root.CardViewMetricsAdapter.getMetrics(win, item, settings.metrics)
    };
  }

  function presentDetails(win, item, summary = presentSummary(win, item)) {
    const extra = safeField(item, "extra");
    const notes = getChildren(win, item, "getNotes", "isNote").map(note => ({
      id: note.id,
      title: noteTitle(note)
    }));
    const attachments = getChildren(win, item, "getAttachments", "isAttachment").map(attachment => ({
      id: attachment.id,
      title: attachmentTitle(attachment),
      contentType: cleanText(attachment.attachmentContentType)
    }));
    return {
      ...summary,
      abstract: safeField(item, "abstractNote"),
      doi: safeField(item, "DOI"),
      url: safeField(item, "url"),
      creators: getCreators(win, item),
      collections: getCollections(win, item),
      keywords: parseExtraField(extra, ["Keywords", "Keyword", "关键词"]),
      notes,
      attachments
    };
  }

  function present(win, item, settings) {
    return presentDetails(win, item, presentSummary(win, item, settings));
  }

  root.CardViewItemPresenter = { present, presentSummary, presentDetails, safeField, creatorName };
})(typeof _globalThis !== "undefined" ? _globalThis : (typeof globalThis !== "undefined" ? globalThis : this));

