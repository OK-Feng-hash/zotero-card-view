(function (root) {
  "use strict";

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function cardForID(cardByID, id) {
    if (id === undefined || id === null) return null;
    return cardByID?.get?.(Number(id)) || cardByID?.get?.(id) || null;
  }

  function isWithinViewport(cardRect, containerRect) {
    return cardRect.bottom > containerRect.top && cardRect.top < containerRect.bottom;
  }

  function findAnchor(container, cardByID, preferredIDs = []) {
    if (!container || !cardByID?.size) return null;
    const containerRect = container.getBoundingClientRect();

    for (const id of preferredIDs) {
      const card = cardForID(cardByID, id);
      if (!card) continue;
      const rect = card.getBoundingClientRect();
      if (isWithinViewport(rect, containerRect)) return { id: Number(id), rect, containerRect };
    }

    let nearest = null;
    for (const [id, card] of cardByID) {
      const rect = card.getBoundingClientRect();
      if (!isWithinViewport(rect, containerRect)) continue;
      const distance = Math.abs(rect.top - containerRect.top);
      if (!nearest || distance < nearest.distance) {
        nearest = { id: Number(id), rect, containerRect, distance };
      }
    }
    return nearest;
  }

  function capture(container, cardByID, preferredIDs = []) {
    const state = {
      top: Math.max(0, finiteNumber(container?.scrollTop)),
      anchorID: null,
      anchorOffset: 0
    };
    const anchor = findAnchor(container, cardByID, preferredIDs);
    if (!anchor) return state;
    state.anchorID = anchor.id;
    state.anchorOffset = anchor.rect.top - anchor.containerRect.top;
    return state;
  }

  function restore(container, cardByID, state) {
    if (!container || !state) return 0;
    container.scrollTop = Math.max(0, finiteNumber(state.top));
    const card = cardForID(cardByID, state.anchorID);
    if (!card) return container.scrollTop;

    const containerRect = container.getBoundingClientRect();
    const actualOffset = card.getBoundingClientRect().top - containerRect.top;
    const delta = actualOffset - finiteNumber(state.anchorOffset);
    if (Number.isFinite(delta) && Math.abs(delta) >= 0.5) {
      container.scrollTop = Math.max(0, container.scrollTop + delta);
    }
    return container.scrollTop;
  }

  root.CardViewViewPosition = { capture, restore };
})(typeof _globalThis !== "undefined" ? _globalThis : (typeof globalThis !== "undefined" ? globalThis : this));
