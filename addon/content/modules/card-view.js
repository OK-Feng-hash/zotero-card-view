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
      this.sortFieldsPicker = null;
      this.sortFieldsButton = null;
      this.sortFieldsPanel = null;
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
      this.restorePositionTimer = null;
      this.visibleMetricsTimer = null;
      this.renderRevision = 0;
      this.restorePositionRevision = 0;
      this.renderPending = false;
      this.active = false;
      this.disposed = false;
      this.libraryTabActive = true;
      this.positionRestorePending = false;
      this.suppressPositionCapture = false;
      this.viewPosition = { top: 0, anchorID: null, anchorOffset: 0 };
      this.notifierID = null;
      this.stylePrefObserverIDs = [];
      this.originalItemSelected = null;
      this.itemSelectedWrapper = null;
      this.originalTreeDisplay = "";
      this.originalTreeDisplayPriority = "";
      this.sortField = "date";
      this.sortDirection = "desc";
      this.enabledSortFields = [...root.CardViewSortFields.DEFAULT_ENABLED];
      this.documentClickListener = event => {
        if (!this.sortFieldsPanel || this.sortFieldsPanel.hidden) return;
        if (!this.sortFieldsPicker?.contains(event.target)) this.closeSortFieldsPanel();
      };
      this.refreshListener = () => this.scheduleRender();
      this.scrollListener = () => {
        if (!this.suppressPositionCapture) this.captureViewPosition();
        this.queueVisibleMetricsSync();
      };
      this.renderer = new root.CardViewCardRenderer(this.doc);
      this.modelStore = new root.CardViewModelStore(win);
      this.metricsSync = new root.CardViewStyleMetricsSync(win, ids => {
        if (this.disposed || !ids.length) return;
        this.modelStore.invalidate(ids);
        this.scheduleRender(0);
      });
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
      root.CardViewPreferences.migrateLegacy(this.win, root.Services);
      this.loadSortPreferences();
      this.createContainer();
      this.connectItemsView();
      this.libraryTabActive = this.isLibraryTabSelected();
      this.registerObservers();

      this.updateSortControls();

      const enabled = root.CardViewPreferences.get(this.win, "enabled", false) === true;
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

    loadSortPreferences() {
      this.enabledSortFields = root.CardViewSortFields.normalizeEnabled(
        root.CardViewPreferences.get(this.win, "enabledSortFields", "")
      );
      const savedField = root.CardViewPreferences.get(this.win, "sortField", "date") || "date";
      this.sortField = this.enabledSortFields.includes(savedField) ? savedField : this.enabledSortFields[0];
      const savedDirection = root.CardViewPreferences.get(this.win, "sortDirection", "desc");
      this.sortDirection = ["asc", "desc"].includes(savedDirection)
        ? savedDirection
        : root.CardViewSortFields.defaultDirection(this.sortField);
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
      container.addEventListener("scroll", this.scrollListener, { passive: true });
      this.hostNode.append(container);
      this.container = container;
      this.grid = grid;
    }

    createSortBar() {
      const bar = html(this.doc, "div", "card-view-sort-bar");
      const label = html(this.doc, "label", "card-view-sort-label", "排序");
      const select = html(this.doc, "select", "card-view-sort-select");
      select.setAttribute("aria-label", "卡片排序方式");
      select.addEventListener("change", () => {
        this.sortField = select.value;
        this.sortDirection = root.CardViewSortFields.defaultDirection(this.sortField);
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

      const picker = html(this.doc, "div", "card-view-sort-field-picker");
      const pickerButton = html(this.doc, "button", "card-view-sort-fields-button", "排序项目");
      pickerButton.type = "button";
      pickerButton.setAttribute("aria-label", "选择排序项目");
      pickerButton.setAttribute("aria-haspopup", "menu");
      pickerButton.setAttribute("aria-expanded", "false");
      const panel = html(this.doc, "div", "card-view-sort-fields-panel");
      panel.hidden = true;
      panel.setAttribute("role", "menu");
      panel.setAttribute("aria-label", "可用排序项目");
      for (const field of root.CardViewSortFields.FIELDS) {
        const item = html(this.doc, "label", "card-view-sort-fields-item");
        const checkbox = html(this.doc, "input", "card-view-sort-fields-checkbox");
        checkbox.type = "checkbox";
        checkbox.value = field.id;
        checkbox.checked = this.enabledSortFields.includes(field.id);
        checkbox.setAttribute("role", "menuitemcheckbox");
        checkbox.addEventListener("change", () => this.onSortFieldToggle(checkbox));
        item.append(checkbox, html(this.doc, "span", "", field.label));
        panel.append(item);
      }
      pickerButton.addEventListener("click", () => {
        panel.hidden ? this.openSortFieldsPanel() : this.closeSortFieldsPanel();
      });
      panel.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        this.closeSortFieldsPanel();
        pickerButton.focus();
      });
      picker.append(pickerButton, panel);

      bar.append(label, direction, picker);
      this.sortSelect = select;
      this.sortDirectionButton = direction;
      this.sortFieldsPicker = picker;
      this.sortFieldsButton = pickerButton;
      this.sortFieldsPanel = panel;
      this.rebuildSortOptions();
      this.doc.addEventListener("click", this.documentClickListener);
      return bar;
    }

    openSortFieldsPanel() {
      if (!this.sortFieldsPanel) return;
      this.sortFieldsPanel.hidden = false;
      this.sortFieldsButton?.setAttribute("aria-expanded", "true");
    }

    closeSortFieldsPanel() {
      if (!this.sortFieldsPanel) return;
      this.sortFieldsPanel.hidden = true;
      this.sortFieldsButton?.setAttribute("aria-expanded", "false");
    }

    onSortFieldToggle(checkbox) {
      const enabled = new Set(this.enabledSortFields);
      checkbox.checked ? enabled.add(checkbox.value) : enabled.delete(checkbox.value);
      if (!enabled.size) {
        checkbox.checked = true;
        return;
      }
      this.enabledSortFields = root.CardViewSortFields.FIELDS
        .map(field => field.id)
        .filter(field => enabled.has(field));
      const fieldChanged = !this.enabledSortFields.includes(this.sortField);
      if (fieldChanged) {
        this.sortField = this.enabledSortFields[0];
        this.sortDirection = root.CardViewSortFields.defaultDirection(this.sortField);
      }
      this.rebuildSortOptions();
      this.persistSort();
      this.updateSortControls();
      if (fieldChanged) this.scheduleRender(0);
    }

    rebuildSortOptions() {
      if (!this.sortSelect) return;
      const fragment = this.doc.createDocumentFragment();
      for (const field of root.CardViewSortFields.FIELDS) {
        if (!this.enabledSortFields.includes(field.id)) continue;
        const option = html(this.doc, "option", "", field.label);
        option.value = field.id;
        fragment.append(option);
      }
      this.sortSelect.replaceChildren(fragment);
      this.sortSelect.value = this.sortField;
    }

    persistSort() {
      root.CardViewPreferences.set(this.win, "sortField", this.sortField);
      root.CardViewPreferences.set(this.win, "sortDirection", this.sortDirection);
      root.CardViewPreferences.set(
        this.win,
        "enabledSortFields",
        root.CardViewSortFields.serializeEnabled(this.enabledSortFields)
      );
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
        this.closeSortFieldsPanel();
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
        notify: (action, type, ids) => {
          if (type === "tab") {
            if (action === "select") this.onTabSelected(ids);
            return;
          }
          if (type === "item") this.modelStore.invalidate(ids);
          else this.modelStore.invalidateDetails();
          this.scheduleRender();
        }
      }, ["item", "collection", "tab"], "zotero-card-view");
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
        if (persist) root.CardViewPreferences.set(this.win, "enabled", false);
        throw new Error("Zotero item view did not become ready");
      }
      this.active = requested;
      this.updateActiveControls(this.active);
      this.applyViewLayout(this.active);
      if (persist) root.CardViewPreferences.set(this.win, "enabled", this.active);
      if (this.active) {
        await this.render();
        this.metricsSync.start();
        this.queueVisibleMetricsSync(0);
        this.container.focus();
      } else this.pauseMetricsSync();
    }

    updateActiveControls(active) {
      this.button?.setAttribute("checked", active ? "true" : "false");
      this.button?.classList.toggle("card-view-active", active);
      this.menuItem?.setAttribute("checked", active ? "true" : "false");
    }

    scheduleRender(delay = 80) {
      if (this.disposed) return;
      this.renderPending = true;
      this.win.clearTimeout(this.renderTimer);
      this.renderTimer = null;
      if (!this.libraryTabActive) return;
      this.renderTimer = this.win.setTimeout(() => {
        this.renderTimer = null;
        if (this.active && this.libraryTabActive) {
          this.renderPending = false;
          this.render().catch(error => this.logError(error));
        }
      }, delay);
    }

    async render() {
      if (!this.active || this.disposed) return;
      if (!this.libraryTabActive) {
        this.renderPending = true;
        return;
      }
      this.renderPending = false;
      this.connectItemsView();
      const revision = ++this.renderRevision;
      if (!this.positionRestorePending) this.captureViewPosition();
      const viewPosition = { ...this.viewPosition };
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
          const readingProgress = this.modelStore.getReadingProgress(model.item);
          const progressSignature = readingProgress?.signature || "";
          let card = this.cardByID.get(model.id);
          const reusable = card?._cardViewModel === model
            && card.classList.contains("expanded") === expanded
            && (!expanded || card._cardViewDetails === details)
            && card._cardViewReadingProgressSignature === progressSignature;
          if (!reusable) {
            card = this.renderer.createCard(model, details, readingProgress);
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
      this.restoreViewPosition(viewPosition);
      this.syncSelection(true);
      this.metricsSync.track(orderedModels);
      this.queueVisibleMetricsSync(0);
    }

    isLibraryTabSelected(ids = []) {
      try {
        if (this.win.Zotero_Tabs?.selectedID) {
          return this.win.Zotero_Tabs.selectedID === "zotero-pane";
        }
      } catch (_) {}
      return Array.from(ids || []).includes("zotero-pane");
    }

    onTabSelected(ids) {
      const librarySelected = this.isLibraryTabSelected(ids);
      const returnedToLibrary = librarySelected && !this.libraryTabActive;
      this.libraryTabActive = librarySelected;
      if (!librarySelected) {
        this.win.clearTimeout(this.renderTimer);
        this.renderTimer = null;
        this.pauseMetricsSync();
        return;
      }
      if (!returnedToLibrary || !this.active) return;
      this.metricsSync.start();
      this.positionRestorePending = true;
      if (this.renderPending) this.scheduleRender(0);
      this.queueViewPositionRestore();
      this.queueVisibleMetricsSync(0);
    }

    pauseMetricsSync() {
      this.win.clearTimeout(this.visibleMetricsTimer);
      this.visibleMetricsTimer = null;
      this.metricsSync.pause();
    }

    queueVisibleMetricsSync(delay = 120) {
      this.win.clearTimeout(this.visibleMetricsTimer);
      this.visibleMetricsTimer = null;
      if (!this.active || !this.libraryTabActive || this.disposed || !this.container) return;
      this.visibleMetricsTimer = this.win.setTimeout(() => {
        this.visibleMetricsTimer = null;
        if (!this.active || !this.libraryTabActive || this.disposed) return;
        const viewport = this.container.getBoundingClientRect();
        const ids = [];
        for (const [id, card] of this.cardByID) {
          const rect = card.getBoundingClientRect();
          if (rect.bottom > viewport.top && rect.top < viewport.bottom) ids.push(id);
        }
        this.metricsSync.prioritize(ids);
        this.metricsSync.wake(0);
      }, Math.max(0, Number(delay) || 0));
    }

    captureViewPosition(preferredID = null) {
      if (!this.container || !this.grid) return this.viewPosition;
      const preferredIDs = [preferredID, ...this.getSelectedIDs()]
        .filter((id, index, values) => id !== null && id !== undefined && values.indexOf(id) === index);
      this.viewPosition = root.CardViewViewPosition.capture(
        this.container,
        this.cardByID,
        preferredIDs
      );
      return this.viewPosition;
    }

    restoreViewPosition(position = this.viewPosition) {
      if (!this.container) return;
      const revision = ++this.restorePositionRevision;
      this.suppressPositionCapture = true;
      root.CardViewViewPosition.restore(this.container, this.cardByID, position);
      this.win.setTimeout(() => {
        if (revision === this.restorePositionRevision) this.suppressPositionCapture = false;
      }, 0);
    }

    queueViewPositionRestore() {
      this.win.clearTimeout(this.restorePositionTimer);
      this.restorePositionTimer = this.win.setTimeout(() => {
        this.restorePositionTimer = null;
        if (!this.active || !this.libraryTabActive || this.disposed) return;
        this.restoreViewPosition();
        const finish = () => {
          if (!this.active || !this.libraryTabActive || this.disposed) return;
          this.restoreViewPosition();
          this.positionRestorePending = false;
        };
        if (typeof this.win.requestAnimationFrame === "function") {
          this.win.requestAnimationFrame(finish);
        } else this.win.setTimeout(finish, 0);
      }, 0);
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
      this.captureViewPosition(ids[ids.length - 1]);
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
      this.win.clearTimeout(this.restorePositionTimer);
      this.win.clearTimeout(this.visibleMetricsTimer);
      try { this.itemsView?.onRefresh?.removeListener?.(this.refreshListener); } catch (_) {}
      if (this.notifierID) this.win.Zotero.Notifier.unregisterObserver(this.notifierID);
      for (const observerID of this.stylePrefObserverIDs) {
        try { this.win.Zotero.Prefs.unregisterObserver(observerID); } catch (_) {}
      }
      this.stylePrefObserverIDs = [];
      if (this.pane?.itemSelected === this.itemSelectedWrapper) this.pane.itemSelected = this.originalItemSelected;
      if (this.treeNode) this.applyViewLayout(false);
      this.doc.removeEventListener("click", this.documentClickListener);
      this.container?.removeEventListener("scroll", this.scrollListener);
      this.metricsSync.destroy();
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
