(function (root) {
  "use strict";

  const HTML_NS = "http://www.w3.org/1999/xhtml";
  const ABSTRACT_COLLAPSE_THRESHOLD = 500;

  function html(document, tag, className, text) {
    const node = document.createElementNS(HTML_NS, tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function appendTextBlock(document, parent, heading, value) {
    if (!value) return;
    const section = html(document, "section", "card-view-detail-section");
    section.append(html(document, "h4", "", heading), html(document, "p", "", value));
    parent.append(section);
  }

  function creatorDetailLabel(creator) {
    const role = String(creator.role || "").trim();
    if (!role || /^(作者|author)$/i.test(role)) return creator.name;
    return `${creator.name}（${role}）`;
  }

  function normalizedTerms(value) {
    return String(value || "").split(/[;,；，\n]+/)
      .map(term => term.trim().toLocaleLowerCase())
      .filter(Boolean)
      .sort();
  }

  function hasDistinctKeywords(keywords, tags) {
    const keywordTerms = normalizedTerms(keywords);
    if (!keywordTerms.length) return false;
    const tagTerms = normalizedTerms(tags.join("；"));
    return keywordTerms.join("\u0000") !== tagTerms.join("\u0000");
  }

  class CardRenderer {
    constructor(document) {
      this.doc = document;
    }

    createCard(model, details = null) {
      const card = html(this.doc, "article", "zotero-card-view-card");
      card.dataset.itemId = String(model.id);
      card.tabIndex = -1;
      card.setAttribute("role", "option");
      card.setAttribute("aria-selected", "false");
      card._cardViewModel = model;
      card._cardViewDetails = details;

      const header = html(this.doc, "div", "card-view-card-header");
      const title = html(this.doc, "h3", "card-view-title", model.title);
      title.title = model.title;
      header.append(title);

      const meta = html(this.doc, "div", "card-view-meta");
      if (model.date) meta.append(this.badge(model.date, "neutral"));
      if (model.journal) meta.append(this.badge(model.journal, "journal"));
      if (model.metrics.source === "Zotero Style") {
        for (const metric of model.metrics.publicationBadges) meta.append(this.publicationBadge(metric));
      } else {
        if (model.metrics.impactFactor) meta.append(this.badge(`IF ${model.metrics.impactFactor}`, "impact"));
        if (model.metrics.casPartition) meta.append(this.badge(`SCI分区 ${model.metrics.casPartition}`, "partition"));
      }

      const tags = html(this.doc, "div", "card-view-tags");
      if (model.rating) tags.append(this.createRating(model.rating));
      for (const tag of model.tags.slice(0, 5)) tags.append(this.badge(tag, "tag"));
      if (model.tags.length > 5) tags.append(this.badge(`+${model.tags.length - 5}`, "neutral"));

      const footer = html(this.doc, "div", "card-view-footer");
      const counts = [];
      if (model.noteCount) counts.push(`${model.noteCount} 条笔记`);
      if (model.attachmentCount) counts.push(`${model.attachmentCount} 个附件`);
      footer.append(html(this.doc, "span", "card-view-counts", counts.join(" · ") || "Zotero 条目"));
      const expand = html(this.doc, "button", "card-view-expand", details ? "收起" : "展开");
      expand.type = "button";
      expand.dataset.cardAction = "expand";
      expand.setAttribute("aria-expanded", String(Boolean(details)));
      footer.append(expand);

      card.append(header, meta, tags, footer);
      if (details) {
        card.classList.add("expanded");
        card.append(this.createDetails(details));
      }
      return card;
    }

    badge(text, kind) {
      return html(this.doc, "span", `card-view-badge ${kind}`, text);
    }

    publicationBadge(metric) {
      const badge = this.badge(metric.text, "publication-metric");
      badge.dataset.field = metric.field;
      badge.style.backgroundColor = metric.backgroundColor;
      badge.style.color = metric.textColor;
      badge.style.margin = `${metric.margin}em`;
      badge.style.padding = `0.05em ${metric.padding}em`;
      return badge;
    }

    createRating(rating) {
      const node = html(this.doc, "span", "card-view-rating");
      node.setAttribute("role", "img");
      node.setAttribute("aria-label", `评级 ${rating.value} / 5`);
      node.title = `评级 ${rating.value} / 5`;
      for (let index = 0; index < 5; index++) {
        const star = html(
          this.doc,
          "span",
          "card-view-rating-star",
          index < rating.value ? rating.selectedStar : rating.unselectedStar
        );
        star.style.padding = `0 ${rating.padding}px`;
        node.append(star);
      }
      return node;
    }

    createDetails(model) {
      const details = html(this.doc, "div", "card-view-details");
      details.append(this.createAbstractSection(model.abstract || "暂无摘要"));
      if (hasDistinctKeywords(model.keywords, model.tags)) {
        appendTextBlock(this.doc, details, "关键词", model.keywords);
      }
      appendTextBlock(
        this.doc,
        details,
        "作者",
        model.creators.map(creatorDetailLabel).join("；") || "暂无作者信息"
      );
      appendTextBlock(this.doc, details, "标签类别", model.tags.join("；") || "暂无标签");
      appendTextBlock(this.doc, details, "所属集合", model.collections.join("；") || "未加入集合");

      const links = html(this.doc, "section", "card-view-detail-section card-view-links");
      links.append(html(this.doc, "h4", "", "笔记与附件"));
      if (!model.notes.length && !model.attachments.length) {
        links.append(html(this.doc, "p", "", "暂无笔记或附件"));
      }
      for (const note of model.notes) links.append(this.actionButton(`笔记 · ${note.title}`, "note", note.id));
      for (const attachment of model.attachments) {
        links.append(this.actionButton(`附件 · ${attachment.title}`, "attachment", attachment.id));
      }
      details.append(links);

      const identifiers = [model.doi && `DOI：${model.doi}`, model.url && `URL：${model.url}`]
        .filter(Boolean).join("\n");
      appendTextBlock(this.doc, details, "标识符", identifiers);
      return details;
    }

    createAbstractSection(abstract) {
      const section = html(this.doc, "section", "card-view-detail-section card-view-abstract");
      section.append(html(this.doc, "h4", "", "摘要"));
      const paragraph = html(this.doc, "p", "card-view-abstract-text", abstract);
      section.append(paragraph);
      if (abstract.length > ABSTRACT_COLLAPSE_THRESHOLD) {
        paragraph.classList.add("collapsed");
        const toggle = html(this.doc, "button", "card-view-abstract-toggle", "… 展开摘要");
        toggle.type = "button";
        toggle.dataset.cardAction = "abstract";
        toggle.setAttribute("aria-expanded", "false");
        section.append(toggle);
      }
      return section;
    }

    actionButton(label, action, targetID) {
      const button = html(this.doc, "button", "card-view-link", label);
      button.type = "button";
      button.dataset.cardAction = action;
      button.dataset.targetId = String(targetID);
      return button;
    }

    setExpanded(card, expanded, details = null) {
      card.classList.toggle("expanded", expanded);
      const button = card.querySelector(".card-view-expand");
      if (button) {
        button.textContent = expanded ? "收起" : "展开";
        button.setAttribute("aria-expanded", String(expanded));
      }
      card.querySelector(".card-view-details")?.remove();
      if (expanded && details) card.append(this.createDetails(details));
      card._cardViewDetails = expanded ? details : null;
    }

    toggleAbstract(button) {
      const paragraph = button.parentNode?.querySelector(".card-view-abstract-text");
      if (!paragraph) return;
      const expanded = paragraph.classList.toggle("expanded");
      paragraph.classList.toggle("collapsed", !expanded);
      button.textContent = expanded ? "收起摘要" : "… 展开摘要";
      button.setAttribute("aria-expanded", String(expanded));
    }
  }

  root.CardViewDOM = { html };
  root.CardViewDetailUtils = { creatorDetailLabel, normalizedTerms, hasDistinctKeywords };
  root.CardViewCardRenderer = CardRenderer;
})(typeof _globalThis !== "undefined" ? _globalThis : (typeof globalThis !== "undefined" ? globalThis : this));

