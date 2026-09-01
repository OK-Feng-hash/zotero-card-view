(function (root) {
  "use strict";

  function stableSignature(value) {
    if (value === undefined) return "missing";
    if (value === "") return "empty";
    if (!value || typeof value !== "object") return `value:${String(value)}`;
    return JSON.stringify(Object.keys(value).sort().map(key => [key, value[key]]));
  }

  class CardViewStyleMetricsSync {
    constructor(win, onChange, options = {}) {
      this.win = win;
      this.onChange = typeof onChange === "function" ? onChange : () => {};
      this.intervalMs = Math.max(250, Number(options.intervalMs) || 750);
      this.requestCooldownMs = Math.max(5000, Number(options.requestCooldownMs) || 30000);
      this.tracked = new Map();
      this.prioritizedIDs = new Set();
      this.signatures = new Map();
      this.requestedAt = new Map();
      this.timer = null;
      this.timerDueAt = 0;
      this.active = false;
      this.destroyed = false;
    }

    track(models) {
      const next = new Map();
      for (const model of models || []) {
        const item = model?.item;
        const id = Number(model?.id ?? item?.id);
        if (!item || !Number.isFinite(id)) continue;
        const title = root.CardViewMetricsAdapter.publicationTitle(item);
        if (!title) continue;
        let entry = next.get(title);
        if (!entry) {
          entry = { title, item, ids: new Set() };
          next.set(title, entry);
        }
        entry.ids.add(id);
      }
      this.tracked = next;
      const retainedIDs = new Set();
      for (const entry of next.values()) for (const id of entry.ids) retainedIDs.add(id);
      this.prioritizedIDs = new Set([...this.prioritizedIDs].filter(id => retainedIDs.has(id)));
      for (const title of this.signatures.keys()) if (!next.has(title)) this.signatures.delete(title);
      for (const title of this.requestedAt.keys()) if (!next.has(title)) this.requestedAt.delete(title);
    }

    prioritize(ids) {
      this.prioritizedIDs = new Set(
        Array.from(ids || []).map(Number).filter(Number.isFinite)
      );
    }

    start() {
      if (this.destroyed) return;
      this.active = true;
      this.wake(0);
    }

    pause() {
      this.active = false;
      this.win.clearTimeout(this.timer);
      this.timer = null;
      this.timerDueAt = 0;
    }

    destroy() {
      this.pause();
      this.destroyed = true;
      this.tracked.clear();
      this.prioritizedIDs.clear();
      this.signatures.clear();
      this.requestedAt.clear();
    }

    wake(delay = 0) {
      if (!this.active || this.destroyed) return;
      const wait = Math.max(0, Number(delay) || 0);
      const dueAt = Date.now() + wait;
      if (this.timer && this.timerDueAt <= dueAt) return;
      this.win.clearTimeout(this.timer);
      this.timerDueAt = dueAt;
      this.timer = this.win.setTimeout(() => {
        this.timer = null;
        this.timerDueAt = 0;
        this.tick().catch(error => this.logError(error));
      }, wait);
    }

    async tick() {
      if (!this.active || this.destroyed) return;
      const result = await this.pollOnce();
      if (!this.active || this.destroyed) return;
      if (result.changedIDs.length) this.onChange(result.changedIDs);
      this.wake(result.ready ? this.intervalMs : Math.max(this.intervalMs, 1000));
    }

    async getStorage() {
      const storage = this.win.Zotero?.ZoteroStyle?.api?.itemTreeExtensionHost?.localStorage;
      if (!storage) return null;
      try {
        if (storage.lock?.promise) await storage.lock.promise;
      } catch (error) {
        this.logError(error);
        return null;
      }
      return storage;
    }

    async pollOnce() {
      const storage = await this.getStorage();
      if (!storage) return { ready: false, changedIDs: [], requestedTitles: [] };

      const changedIDs = new Set();
      const requestedTitles = [];
      const now = Date.now();
      const styleAPI = this.win.Zotero?.ZoteroStyle?.api;

      for (const entry of this.tracked.values()) {
        let value;
        try { value = storage.get({ key: entry.title }, "rank"); }
        catch (error) {
          this.logError(error);
          continue;
        }

        const signature = stableSignature(value);
        const hadSignature = this.signatures.has(entry.title);
        const previous = this.signatures.get(entry.title);
        this.signatures.set(entry.title, signature);
        if (value !== undefined && value !== "" && (!hadSignature || previous !== signature)) {
          for (const id of entry.ids) changedIDs.add(id);
        }

        const visible = [...entry.ids].some(id => this.prioritizedIDs.has(id));
        const lastRequest = this.requestedAt.get(entry.title) || 0;
        if (value === undefined && visible && now - lastRequest >= this.requestCooldownMs
          && typeof styleAPI?.renderCell === "function") {
          try {
            styleAPI.renderCell(entry.item, "publicationTags");
            this.requestedAt.set(entry.title, now);
            requestedTitles.push(entry.title);
          } catch (error) { this.logError(error); }
        }
      }

      return { ready: true, changedIDs: [...changedIDs], requestedTitles };
    }

    logError(error) {
      this.win.Zotero?.debug?.(`[CardView] Zotero Style metric synchronization failed: ${error}`);
    }
  }

  root.CardViewStyleMetricsSync = CardViewStyleMetricsSync;
  root.CardViewStyleMetricsSignature = stableSignature;
})(typeof _globalThis !== "undefined" ? _globalThis : (typeof globalThis !== "undefined" ? globalThis : this));
