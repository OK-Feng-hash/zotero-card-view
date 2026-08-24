# Zotero Card View 0.2 Architecture

## Design goals

The plugin is a view over Zotero's live library. It does not own a literature database, duplicate attachments, or call a remote service. Zotero remains the source of truth for selection, editing, opening files, collections, tags, and item metadata.

## Module boundaries

| Module | Responsibility |
| --- | --- |
| `index.js` | One controller per Zotero main window and add-on shutdown coordination. |
| `card-view.js` | View lifecycle, native selection bridge, sorting, refresh scheduling, keyed card reuse, and delegated input events. |
| `card-renderer.js` | DOM construction only; compact cards first and expanded details on demand. |
| `model-store.js` | Summary/detail caches, item-scoped invalidation, settings invalidation, and memory pruning. |
| `item-presenter.js` | Converts Zotero items into display-safe summary and detail models. |
| `settings.js` | One immutable Zotero Style settings snapshot and its observed preference keys. |
| `metrics-adapter.js` | Reads the local Zotero Style journal cache or local `Extra` fallback and mirrors badge styling. |
| `rating-adapter.js` | Reads Zotero Style ratings and their configured star appearance. |
| `sorter.js` | Pure date, title, impact-factor, and rating ordering. |
| `text-utils.js` | Text cleanup and exact `Extra` field parsing. |

## Data flow

1. Zotero's current item view supplies visible regular items.
2. `model-store.js` returns cached compact summaries or asks `item-presenter.js` to create them.
3. `sorter.js` returns a new ordered model array without mutating cached data.
4. `card-view.js` reuses the existing DOM node when its summary and expansion state are unchanged.
5. `card-renderer.js` builds details only after the user expands a card.

Initial rendering therefore does not localize creators, resolve collection objects, or resolve note and attachment child objects. It only reads their ID counts for the compact footer.

## Invalidation rules

- Zotero item notification: invalidate that item's summary and details.
- Zotero collection notification: invalidate details because collection membership labels may change.
- Zotero Style preference notification: rebuild the settings snapshot and summary cache.
- Native item-view refresh: update membership and order while reusing valid models and card nodes.
- Leaving a collection: prune models no longer visible so the cache remains bounded.

Expanded IDs and scroll position survive ordinary refreshes. Selection synchronization updates only changed cards outside a render; a render performs one forced pass so newly created nodes always receive the correct state.

## Lifecycle and compatibility

Zotero 9's main `ItemTree` exposes its selection callback only through `ZoteroPane.itemSelected`; it does not expose a second public selection event. The controller installs a narrow wrapper, keeps the exact original function, and restores it only if no other code replaced the wrapper. Refresh listeners are disconnected and reconnected if Zotero replaces its item-view instance.

Every registered notifier, preference observer, refresh listener, injected node, cache, and selection bridge is released during window unload or add-on shutdown.

## Privacy boundary

- No `fetch`, `XMLHttpRequest`, socket, telemetry, or external update endpoint is used.
- Abstracts and note bodies are never sent outside Zotero.
- Note bodies are not included in cached view models; only their display titles and Zotero IDs are retained.
- The EasyScholar secret key is neither read nor stored.
- Journal data is read only from Zotero Style's already-loaded local cache or the item's local `Extra` field.

## Remaining scaling boundary

Compact cards are created cooperatively in batches of 40 to yield to Zotero's UI. Keyed reuse prevents repeat construction during normal refreshes. Full viewport virtualization is intentionally not used because it would complicate Zotero multi-selection, context menus, keyboard navigation, and variable-height expanded cards. It should be reconsidered only for views containing several thousand visible parent items.

