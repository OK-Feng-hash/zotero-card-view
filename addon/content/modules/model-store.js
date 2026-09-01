(function (root) {
  "use strict";

  class CardViewModelStore {
    constructor(win) {
      this.win = win;
      this.settings = root.CardViewSettings.createSnapshot(win);
      this.summaries = new Map();
      this.details = new Map();
    }

    getSummary(item) {
      const cached = this.summaries.get(item.id);
      if (cached?.item === item) return cached.model;
      const model = root.CardViewItemPresenter.presentSummary(this.win, item, this.settings);
      this.summaries.set(item.id, { item, model });
      return model;
    }

    getDetails(item) {
      const cached = this.details.get(item.id);
      if (cached?.item === item) return cached.model;
      const summary = this.getSummary(item);
      const model = root.CardViewItemPresenter.presentDetails(this.win, item, summary);
      this.details.set(item.id, { item, model });
      return model;
    }

    getReadingProgress(item) {
      return root.CardViewReadingProgressAdapter.getProgress(
        this.win,
        item,
        this.settings.readingProgress
      );
    }

    invalidate(ids) {
      for (const value of ids || []) {
        const id = Number(value);
        if (!Number.isFinite(id)) continue;
        this.summaries.delete(id);
        this.details.delete(id);
      }
    }

    invalidateDetails() {
      this.details.clear();
    }

    refreshSettings() {
      this.settings = root.CardViewSettings.createSnapshot(this.win);
      this.summaries.clear();
    }

    retain(ids) {
      const retained = new Set(ids);
      for (const id of this.summaries.keys()) if (!retained.has(id)) this.summaries.delete(id);
      for (const id of this.details.keys()) if (!retained.has(id)) this.details.delete(id);
    }

    clear() {
      this.summaries.clear();
      this.details.clear();
    }
  }

  root.CardViewModelStore = CardViewModelStore;
})(typeof _globalThis !== "undefined" ? _globalThis : (typeof globalThis !== "undefined" ? globalThis : this));
