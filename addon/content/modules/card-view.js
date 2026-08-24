(function (root) {
  "use strict";

  const { html } = root.CardViewDOM;

  class CardViewController {
    constructor(win, rootURI) {
      this.win = win;
      this.doc = win.document;
      this.rootURI = rootURI;
      this.pane = win.ZoteroPane;
      this.itemsView = null;
      this.treeNode = null;
      this.hostNode = null;
      this.container = null;
      this.sortSelect = null;
      this.sortDirectionButton = null;
      this.grid = null;
      this.button = null;
      this.menuItem = null;
      this.stylesheet = null;
      this.items = [];
      this.itemByID = new Map();
      this.cardByID = new Map();
      this.expandedIDs = new Set();
      this.selectedIDs = new Set();
      this.anchorID = null;
      this.renderTimer = null;
      this.renderRevision = 0;
      this.active = false;
      this.disposed = false;
      this.notifierID = null;
      this.stylePrefObserverIDs = [];
      this.originalItemSelected = null;
      this.itemSelectedWrapper = null;
      this.originalTreeDisplay = "";
      this.originalTreeDisplayPriority = "";
      this.sortField = "date";
      this.sortDirection = "desc";
      this.refreshListener = () => this.scheduleRender();
      this.renderer = new root.CardViewCardRenderer(this.doc);
      this.modelStore = new root.CardViewModelStore(win);
    }

    async init() {
      for (let attempt = 0; attempt < 100 && !this.disposed; attempt++) {
        this.pane = this.win.ZoteroPane || this.pane;
        this.treeNode = this.doc.getElementById("zotero-items-tree");
        if (this.pane && this.treeNode && this.doc.getElementById("zotero-items-toolbar")) break;
        await this.win.Zotero.Promise.delay(100);
      }
      if (!this.pane || !this.treeNode) throw new Error("Zotero library pane did not become ready");

      this.installStylesheet();
      this.createToolbarButton();
      this.createViewMenuItem();
      this.createContainer();
      this.connectItemsView();
      this.registerObservers();

      this.sortField = this.win.Zotero.Prefs.get("extensions.zotero.cardView.sortField", true) || "date";
      this.sortDirection = this.win.Zotero.Prefs.get("extensions.zotero.cardView.sortDirection", true) || "desc";
      this.updateSortControls();

      const enabled = this.win.Zotero.Prefs.get("extensions.zotero.cardView.enabled", true) === true;
      await this.setActive(enabled, false);
    }

    connectItemsView() {
      const nextView = this.pane?.itemsView;
      if (!nextView) return false;
      if (nextView === this.itemsView) return true;
      try { this.itemsView?.onRefresh?.removeListener?.(this.refreshListener); } catch (_) {}
      this.itemsView = nextView;
      try { this.itemsView.onRefresh.addListener(this.refreshListener); } catch (_) {}
      this.patchSelectionCallback();
      return true;
    }

    async ensureItemsView() {
      if (this.connectItemsView()) return true;
      for (let attempt = 0; attempt < 50 && !this.disposed; attempt++) {
        await this.win.Zotero.Promise.delay(100);
        if (this.connectItemsView()) return true;
      }
      return false;
    }

    installStylesheet() {
      const link = html(this.doc, "link");
      link.setAttribute("rel", "stylesheet");
      link.setAttribute("href", this.rootURI + "content/card-view.css");
      link.dataset.cardViewOwner = "card-view@feng.local";
      this.doc.documentElement.append(link);
      this.stylesheet = link;
    }

    createToolbarButton() {
      this.doc.getElementById("zotero-card-view-toggle")?.remove();
      const button = this.doc.createXULElement("toolbarbutton");
      button.id = "zotero-card-view-toggle";
      button.setAttribute("class", "zotero-tb-button");
      button.setAttribute("tooltiptext", "切换文献卡片视图");
      button.setAttribute("aria-label", "切换文献卡片视图");
      const iconURL = `${this.rootURI}content/icons/card-view.svg`;
      button.setAttribute("image", iconURL);
      button.style.listStyleImage = `url(${iconURL})`;
      button.addEventListener("command", () => this.toggleActive());

      const toolbar = this.doc.getElementById("zotero-items-toolbar");
      const flexibleSpacer = toolbar.querySelector("spacer[flex='1']");
      if (flexibleSpacer) toolbar.insertBefore(button, flexibleSpacer);
      else toolbar.insertBefore(button, this.doc.getElementById("zotero-tb-search-spinner") || null);
      this.button = button;
    }

    createViewMenuItem() {
      this.doc.getElementById("zotero-card-view-menuitem")?.remove();
      const popup = this.doc.getElementById("menu_viewPopup");
      if (!popup) return;
      const item = this.doc.createXULElement("menuitem");
      item.id = "zotero-card-view-menuitem";
      item.setAttribute("class", "menu-type-library");
      item.setAttribute("type", "checkbox");
      item.setAttribute("label", "文献卡片视图");
      item.addEventListener("command", () => this.toggleActive());
      popup.insertBefore(item, this.doc.getElementById("view-menuitem-recursive-collections") || null);
      this.menuItem = item;
    }

    toggleActive() {
      this.setActive(!this.active).catch(error => this.logError(error));
    }

    createContainer() {
      this.doc.getElementById("zotero-card-view-container")?.remove();
      this.hostNode = this.treeNode.parentNode;
      this.originalTreeDisplay = this.treeNode.style.getPropertyValue("display");
      this.originalTreeDisplayPriority = this.treeNode.style.getPropertyPriority("display");
      const container = html(this.doc, "div", "zotero-card-view-container");
      container.id = "zotero-card-view-container";
      container.hidden = true;
      container.tabIndex = 0;
      container.setAttribute("role", "listbox");
      container.setAttribute("aria-label", "文献卡片");
      container.style.setProperty("display", "none", "important");

      const sortBar = this.createSortBar();
      const grid = html(this.doc, "div", "zotero-card-view-grid");
      container.append(sortBar, grid);
      container.addEventListener("keydown", event => this.handleAsync(this.onKeyDown(event)));
      container.addEventListener("click", event => this.handleAsync(this.onContainerClick(event)));
      container.addEventListener("dblclick", event => this.handleAsync(this.onContainerDoubleClick(event)));
      container.addEventListener("contextmenu", event => this.handleAsync(this.onContainerContextMenu(event)));
      this.hostNode.append(container);
      this.container = container;
      this.grid = grid;
    }

    createSortBar() {
      const bar = html(this.doc, "div", "card-view-sort-bar");
      const label = html(this.doc, "label", "card-view-sort-label", "排序");
      const select = html(this.doc, "select", "card-view-sort-select");
      select.setAttribute("aria-label", "卡片排序方式");
      for (const [value, text] of [
        ["date", "文献日期"],
        ["title", "文献名"],
        ["impactFactor", "期刊影响因子"],
        ["rating", "评级"]
      ]) {
        const option = html(this.doc, "option", "", text);
        option.value = value;
        select.append(option);
      }
      select.addEventListener("change", () => {
        this.sortField = select.value;
        this.sortDirection = this.sortField === "title" ? "asc" : "desc";
        this.persistSort();
        this.updateSortControls();
        this.scheduleRender(0);
      });
      label.append(select);

      const direction = html(this.doc, "button", "card-view-sort-direction");
      direction.type = "button";
      direction.addEventListener("click", () => {
        this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
        this.persistSort();
        this.updateSortControls();
        this.scheduleRender(0);
      });
      bar.append(label, direction);
      this.sortSelect = select;
      this.sortDirectionButton = direction;
      return bar;
    }

    persistSort() {
      this.win.Zotero.Prefs.set("extensions.zotero.cardView.sortField", this.sortField);
      this.win.Zotero.Prefs.set("extensions.zotero.cardView.sortDirection", this.sortDirection);
    }

    updateSortControls() {
      if (this.sortSelect) this.sortSelect.value = this.sortField;
      if (!this.sortDirectionButton) return;
      const ascending = this.sortDirection === "asc";
      this.sortDirectionButton.textContent = ascending ? "升序 ↑" : "降序 ↓";
      this.sortDirectionButton.title = ascending ? "切换为降序" : "切换为升序";
      this.sortDirectionButton.setAttribute("aria-label", this.sortDirectionButton.title);
    }

    applyViewLayout(active) {
      this.hostNode?.classList.toggle("card-view-host-active", active);
      if (active) {
        this.treeNode.style.setProperty("display", "none", "important");
        this.treeNode.setAttribute("aria-hidden", "true");
        this.container?.style.setProperty("display", "block", "important");
      } else {
        if (this.originalTreeDisplay) {
          this.treeNode.style.setProperty("display", this.originalTreeDisplay, this.originalTreeDisplayPriority);
        } else this.treeNode.style.removeProperty("display");
        this.treeNode.removeAttribute("aria-hidden");
        this.container?.style.setProperty("display", "none", "important");
      }
      if (this.container) this.container.hidden = !active;
    }

    patchSelectionCallback() {
      if (this.itemSelectedWrapper || typeof this.pane.itemSelected !== "function") return;
      this.originalItemSelected = this.pane.itemSelected;
      const controller = this;
      this.itemSelectedWrapper = async function (...args) {
        const result = await controller.originalItemSelected.apply(controller.pane, args);
        controller.syncSelection();
        return result;
      };
      this.pane.itemSelected = this.itemSelectedWrapper;
    }

    registerObservers() {
      if (this.notifierID) return;
      this.notifierID = this.win.Zotero.Notifier.registerObserver({
        notify: (_action, type, ids) => {
          if (type === "item") this.modelStore.invalidate(ids);
          else this.modelStore.invalidateDetails();
          this.scheduleRender();
        }
      }, ["item", "collection"], "zotero-card-view");
      for (const key of root.CardViewSettings.STYLE_PREF_KEYS) {
        try {
          this.stylePrefObserverIDs.push(this.win.Zotero.Prefs.registerObserver(key, () => {
            this.modelStore.refreshSettings();
            this.scheduleRender();
          }));
        } catch (_) {}
      }
    }

    async setActive(active, persist = true) {
      const requested = Boolean(active);
      if (requested && !await this.ensureItemsView()) {
        this.active = false;
        this.updateActiveControls(false);
        this.applyViewLayout(false);
        if (persist) this.win.Zotero.Prefs.set("extensions.zotero.cardView.enabled", false);
        throw new Error("Zotero item view did not become ready");
      }
      this.active = requested;
      this.updateActiveControls(this.active);
      this.applyViewLayout(this.active);
      if (persist) this.win.Zotero.Prefs.set("extensions.zotero.cardView.enabled", this.active);
      if (this.active) {
        await this.render();
        this.container.focus();
      }
    }

    updateActiveControls(active) {
      this.button?.setAttribute("checked", active ? "true" : "false");
      this.button?.classList.toggle("card-view-active", active);
      this.menuItem?.setAttribute("checked", active ? "true" : "false");
    }

    scheduleRender(delay = 80) {
      if (this.disposed) return;
      this.win.clearTimeout(this.renderTimer);
      this.renderTimer = this.win.setTimeout(() => {
        this.renderTimer = null;
        if (this.active) this.render().catch(error => this.logError(error));
      }, delay);
    }

    async render() {
      if (!this.active || this.disposed) return;
      this.connectItemsView();
      const revision = ++this.renderRevision;
      const scrollTop = this.container.scrollTop;
      const visibleItems = (this.pane.getSortedItems?.() || []).filter(item => {
        try { return item?.isRegularItem?.() && !item.deleted; } catch (_) { return false; }
      });

      const models = [];
      for (const item of visibleItems) {
        try { models.push(this.modelStore.getSummary(item)); }
        catch (error) { this.logError(error); }
      }
      if (revision !== this.renderRevision || this.disposed) return;

      const orderedModels = root.CardViewSorter.sortModels(models, this.sortField, this.sortDirection);
      this.items = orderedModels.map(model => model.item);
      this.itemByID = new Map(this.items.map(item => [item.id, item]));
      this.modelStore.retain(this.itemByID.keys());
      this.expandedIDs = new Set([...this.expandedIDs].filter(id => this.itemByID.has(id)));

      const nextCards = new Map();
      const fragment = this.doc.createDocumentFragment();
      let createdCards = 0;
      if (!orderedModels.length) {
        fragment.append(html(this.doc, "div", "card-view-empty", "当前视图中没有可显示的文献条目。"));
      } else {
        for (const model of orderedModels) {
          const expanded = this.expandedIDs.has(model.id);
          const details = expanded ? this.modelStore.getDetails(model.item) : null;
          let card = this.cardByID.get(model.id);
          const reusable = card?._cardViewModel === model
            && card.classList.contains("expanded") === expanded
            && (!expanded || card._cardViewDetails === details);
          if (!reusable) {
            card = this.renderer.createCard(model, details);
            createdCards++;
          }
          nextCards.set(model.id, card);
          fragment.append(card);
          if (!reusable && createdCards % 40 === 0) {
            await this.win.Zotero.Promise.delay(0);
            if (revision !== this.renderRevision || this.disposed) return;
          }
        }
      }
      this.cardByID = nextCards;
      this.grid.replaceChildren(fragment);
      this.container.scrollTop = scrollTop;
      this.syncSelection(true);
    }

    async onContainerClick(event) {
      const actionNode = event.target.closest("[data-card-action]");
      const card = event.target.closest(".zotero-card-view-card");
      if (actionNode) {
        event.stopPropagation();
        const action = actionNode.dataset.cardAction;
        if (action === "expand" && card) this.toggleCardExpansion(card);
        else if (action === "abstract") this.renderer.toggleAbstract(actionNode);
        else if (action === "note") await this.runAction(() => this.pane.openNote(Number(actionNode.dataset.targetId)));
        else if (action === "attachment") {
          await this.runAction(() => this.pane.viewAttachment(Number(actionNode.dataset.targetId)));
        }
        return;
      }
      if (card && !event.target.closest("button, a, select, input")) {
        await this.selectCard(Number(card.dataset.itemId), event);
      }
    }

    toggleCardExpansion(card) {
      const id = Number(card.dataset.itemId);
      const expanded = !card.classList.contains("expanded");
      if (expanded) this.expandedIDs.add(id);
      else this.expandedIDs.delete(id);
      const item = this.itemByID.get(id);
      const details = expanded && item ? this.modelStore.getDetails(item) : null;
      this.renderer.setExpanded(card, expanded, details);
    }

    async onContainerDoubleClick(event) {
      if (event.target.closest("button, a")) return;
      const card = event.target.closest(".zotero-card-view-card");
      if (!card) return;
      event.preventDefault();
      const item = this.itemByID.get(Number(card.dataset.itemId));
      if (item) await this.runAction(() => this.pane.viewItems([item], event));
    }

    async onContainerContextMenu(event) {
      const card = event.target.closest(".zotero-card-view-card");
      if (!card) return;
      event.preventDefault();
      const id = Number(card.dataset.itemId);
      if (!this.getSelectedIDs().includes(id)) await this.selectIDs([id]);
      await this.runAction(() => this.pane.onItemsContextMenuOpen(event));
    }

    async runAction(action) {
      try { await action(); } catch (error) { this.logError(error); }
    }

    handleAsync(promise) {
      Promise.resolve(promise).catch(error => this.logError(error));
    }

    async selectCard(id, event) {
      const orderedIDs = this.items.map(item => item.id);
      let ids;
      if (event.shiftKey && this.anchorID && orderedIDs.includes(this.anchorID)) {
        const start = orderedIDs.indexOf(this.anchorID);
        const end = orderedIDs.indexOf(id);
        ids = orderedIDs.slice(Math.min(start, end), Math.max(start, end) + 1);
      } else if (event.ctrlKey || event.metaKey) {
        const selected = new Set(this.getSelectedIDs());
        selected.has(id) ? selected.delete(id) : selected.add(id);
        ids = [...selected];
        this.anchorID = id;
      } else {
        ids = [id];
        this.anchorID = id;
      }
      await this.selectIDs(ids);
    }

    async selectIDs(ids) {
      if (!ids.length) {
        try { this.itemsView.selection.clearSelection(); } catch (_) {}
        this.syncSelection();
        return;
      }
      await this.itemsView.selectItems(ids, false, true);
      this.syncSelection();
    }

    getSelectedIDs() {
      try { return this.itemsView.getSelectedItems(true); } catch (_) { return []; }
    }

    syncSelection(force = false) {
      if (!this.grid) return;
      const next = new Set(this.getSelectedIDs());
      const changed = force ? new Set(this.cardByID.keys()) : new Set([...this.selectedIDs, ...next]);
      for (const id of changed) {
        if (!force && this.selectedIDs.has(id) === next.has(id)) continue;
        const card = this.cardByID.get(id);
        card?.classList.toggle("selected", next.has(id));
        card?.setAttribute("aria-selected", String(next.has(id)));
      }
      this.selectedIDs = next;
    }

    async onKeyDown(event) {
      if (!this.active || event.target.closest("button, a, select, input")) return;
      const ids = this.items.map(item => item.id);
      if (!ids.length) return;
      const selected = this.getSelectedIDs();
      let index = selected.length ? ids.indexOf(selected[selected.length - 1]) : -1;
      const columns = Math.max(1, Math.floor(this.grid.clientWidth / 300));
      if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        if (event.key === "ArrowRight") index += 1;
        if (event.key === "ArrowLeft") index -= 1;
        if (event.key === "ArrowDown") index += columns;
        if (event.key === "ArrowUp") index -= columns;
        if (event.key === "Home") index = 0;
        if (event.key === "End") index = ids.length - 1;
        index = Math.max(0, Math.min(ids.length - 1, index));
        await this.selectIDs([ids[index]]);
        this.anchorID = ids[index];
        this.cardByID.get(ids[index])?.scrollIntoView({ block: "nearest" });
      } else if (event.key === "Enter" && selected.length === 1) {
        event.preventDefault();
        const item = this.itemByID.get(selected[0]);
        if (item) await this.runAction(() => this.pane.viewItems([item], event));
      }
    }

    logError(error) {
      this.win.Zotero.logError(`[CardView] ${error?.stack || error}`);
    }

    async destroy() {
      this.disposed = true;
      this.renderRevision++;
      this.win.clearTimeout(this.renderTimer);
      try { this.itemsView?.onRefresh?.removeListener?.(this.refreshListener); } catch (_) {}
      if (this.notifierID) this.win.Zotero.Notifier.unregisterObserver(this.notifierID);
      for (const observerID of this.stylePrefObserverIDs) {
        try { this.win.Zotero.Prefs.unregisterObserver(observerID); } catch (_) {}
      }
      this.stylePrefObserverIDs = [];
      if (this.pane?.itemSelected === this.itemSelectedWrapper) this.pane.itemSelected = this.originalItemSelected;
      if (this.treeNode) this.applyViewLayout(false);
      this.modelStore.clear();
      this.cardByID.clear();
      this.button?.remove();
      this.menuItem?.remove();
      this.container?.remove();
      this.stylesheet?.remove();
    }
  }

  root.ZoteroCardViewController = CardViewController;
})(typeof _globalThis !== "undefined" ? _globalThis : (typeof globalThis !== "undefined" ? globalThis : this));

