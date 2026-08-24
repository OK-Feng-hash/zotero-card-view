(function (root) {
  "use strict";

  const controllers = new Map();

  root.ZoteroCardView = {
    rootURI: "",

    async startup() {
      root.Zotero.CardView = this;
      for (const win of root.Zotero.getMainWindows()) {
        await this.onMainWindowLoad(win);
      }
    },

    async onMainWindowLoad(win) {
      if (controllers.has(win)) return;
      const controller = new root.ZoteroCardViewController(win, this.rootURI);
      controllers.set(win, controller);
      try {
        await controller.init();
      } catch (error) {
        controllers.delete(win);
        win.Zotero.logError(`[CardView] Startup failed: ${error?.stack || error}`);
      }
    },

    async onMainWindowUnload(win) {
      const controller = controllers.get(win);
      if (!controller) return;
      controllers.delete(win);
      await controller.destroy();
    },

    async shutdown() {
      for (const controller of controllers.values()) await controller.destroy();
      controllers.clear();
      delete root.Zotero.CardView;
    }
  };
})(typeof _globalThis !== "undefined" ? _globalThis : (typeof globalThis !== "undefined" ? globalThis : this));

