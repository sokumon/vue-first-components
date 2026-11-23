# v3: the real Sidebar API, on a desk renderer that shares its DOM with jQuery

| | |
| --- | --- |
| **Status** | Superseded by v4 |
| **Builds on** | v2 |
| **Question** | Can `frappe.ui.Sidebar` and `frappe.ui.sidebar_item.Type*` keep their real public API (and the way opendesk patches and drives them) while `.vue` files draw them, even when jQuery `.html()`, `.trigger()` and `.off()` act on Vue's nodes? |
| **Answer** | Yes in jsdom: the Sidebar flow, prototype patches and opendesk's back row work, and a desk renderer that binds Vue's listeners through jQuery lets `.trigger()` and `.off()` reach them. |
| **Checks** | `31/31` in jsdom (plus 11 listener checks in `probe3.cjs`); jsdom only |

## Idea

- v2's design is kept: the base class [`component.js`](component.js) holds state and methods only, controllers join `frappe.ui.views`, and [`ViewOutlet.vue`](ViewOutlet.vue) in [`App.vue`](App.vue) teleports each view into its host.
- The base class gains `renders()` (a controller can decide not to draw, as rows with no route do), `rendered()` (runs once the view is in the document), a `host` getter (`$(this.parent || this.container)[0]`) and an `el` getter (the view's root element). `make(opts)` now receives the options.
- [`sidebar.js`](sidebar.js) and [`sidebar_item.js`](sidebar_item.js) are the desk's `frappe.ui.Sidebar` and `frappe.ui.sidebar_item.TypeLink`, `TypeSectionBreak`, `TypeSpacer` and `TypeButton`, with their method names (`setup`, `add_item`, `make_sidebar_item`, `empty`, `get_item`, `toggle_width`, `open`, `close`, ...). Markup moved into [`Sidebar.vue`](Sidebar.vue) and [`SidebarItem.vue`](SidebarItem.vue); the jQuery fields (`wrapper`, `$sidebar`, `$items_container`, `$standard_items_band`) are getters over the view's DOM.
- The desk renderer ([`renderer.js`](renderer.js)) extends v2's: a node still remembers the parent Vue gave it (so jQuery `.html('')` over Vue nodes does not break the next insert), Vue still changes only the classes it set, and now every `on*` listener except `Once`, `Passive` and `Capture` is bound with jQuery under the `.vue` namespace. So `.trigger()` and `.off()` reach Vue's listeners.
- [`trigger.cjs`](trigger.cjs) shows why: it compares jQuery `.trigger()` against a native `addEventListener` listener and a jQuery `.on` listener for ten element/event pairs.

## What's here

| File | What it is |
| --- | --- |
| [`spike3.cjs`](spike3.cjs) | jsdom setup, a `.vue` loader, the desk globals the classes use, and the 31 checks |
| [`component.js`](component.js) | `frappe.ui.Component`: `shallowReactive` instance, `renders()`/`rendered()`, `host`, `el`, `flush()`, `destroy()` |
| [`renderer.js`](renderer.js) | The desk renderer: `createRenderer` over Vue's `nodeOps` and `patchProp`, with Vue parents, own-classes-only, and listeners bound through jQuery |
| [`App.vue`](App.vue) | The one app: `#fui-overlays` and the outlet |
| [`ViewOutlet.vue`](ViewOutlet.vue) | One `<Teleport>` per controller in `frappe.ui.views` (unchanged from v2) |
| [`sidebar.js`](sidebar.js) | `frappe.ui.Sidebar` |
| [`Sidebar.vue`](Sidebar.vue) | The sidebar's view: container, band, items area, user menu, collapse arrow |
| [`sidebar_item.js`](sidebar_item.js) | `frappe.ui.sidebar_item.TypeLink`, `TypeSectionBreak`, `TypeSpacer`, `TypeButton` |
| [`SidebarItem.vue`](SidebarItem.vue) | One view for every row type |
| [`probe3.cjs`](probe3.cjs) | 11 checks of Vue listeners under the desk renderer, driven by jQuery and by real events |
| [`trigger.cjs`](trigger.cjs) | Prints which listeners jQuery `.trigger()` reaches, native or jQuery's |

## How to run

`spike3.cjs` and `probe3.cjs` read files by relative path (`component.js`, `spike3.cjs`, ...), so run them from inside `v3/`; from the repository root `node v3/spike3.cjs` fails with `ENOENT ... 'component.js'`.

```sh
cd v3
FRAPPE=/path/to/apps/frappe node spike3.cjs
FRAPPE=/path/to/apps/frappe node probe3.cjs
FRAPPE=/path/to/apps/frappe node trigger.cjs
```

`FRAPPE` defaults to `../../frappe` relative to the repository root. It needs a Frappe checkout with `node_modules/vue`, `node_modules/jquery` and `flow/node_modules/jsdom`.

A passing `spike3.cjs` prints one `ok` line per check and ends with:

```
31 passed, 0 failed
```

and exits 0 (1 if any check fails). `probe3.cjs` prints 11 `ok` lines and no `FAIL`. `trigger.cjs` prints the jQuery version and one line per case; with jQuery 3.7.1, `.trigger()` reached a native `addEventListener` listener only for `button` click, `div` click and `input` focus, and a jQuery `.on` listener in all ten cases.

## What it proved

- The constructor and fields keep their shape: `new frappe.ui.Sidebar() takes no options, as before`; `wrapper is .body-sidebar-container, a direct child of body`; `item.wrapper is the row's .sidebar-item-container`; `sidebar.items are the public item classes`; `user menu still goes through frappe.ui.Dropdown`.
- Prototype patches made before boot are honoured: `a patched add_item saw every top-level row`; `rows drawn in order, a row with no path skipped, patched get_path honoured`.
- State changes are in the DOM on the next line: `apply_page_visibility shows it at once`; `section.close() hides its children at once`; `toggle_width folds it, and the DOM is up to date when sidebar-expand fires`.
- Events and DOM reads that legacy code relies on: `sidebar_setup event fires with the sidebar`; `highlight_active_item lights /desk/item`; `body gets sidebar-collapsed`; `the collapse is kept in localStorage`.
- jQuery and Vue share nodes: `make_sidebar after empty() and .html('') redraws the module`; `opendesk: back row first with its title` (opendesk's flow: `empty()`, `add_item` Buttons, then move the last row to the top with jQuery).
- Listeners are reachable from jQuery: `a real click on a Button row runs its onClick`; `jQuery .trigger('click') on the row runs it too`; `jQuery .trigger('click') on the row's <a> bubbles to it`. `probe3.cjs` adds that a triggered click runs a listener once, not twice; `withKeys` and `withModifiers` still work; `Capture` and `Once` stay on Vue's own `patchEvent`; and `.off('click').on('click', fn) replaces Vue's listener, as legacy code expects`.
- Lifetime: `only live rows are in the outlet` after `empty()` destroys the rows it removes.
- `no render(), mount(), createApp() or region in the classes and views`.

## What it cost / what broke

- Every view still goes through one shared outlet. The cost of that design was measured later, not here: the root [`README.md`](../README.md) lists v6 as having found the outlet's cost, and Issue #1 (flaw 1) records that the shared outlet's create/destroy cost grew with n² in v5 (real desk, n = 1000 controllers: 1008 ms to create and 843 ms to destroy, before v5 removed the outlet).
- `patch_listener` calls the handler directly and returns its result to jQuery. Issue #1 (flaw 6) records that merged listeners broke; v5 fixed it with `call_handlers`, and listener return values no longer reach jQuery.
- The renderer's semantics differ from Vue's: `.off()` removes template listeners, and listeners get jQuery-triggered events. The root README's independent review (of v5, whose renderer descends from this one) lists this as an open minor issue, and lists the desk renderer dropping Vue's guard against listeners attached during the same click (vuejs/core#1004) as an open major one.
- Setters are still asynchronous: methods that change what callers read next call `flush()` (`apply_page_visibility`, `toggle`, `apply_expanded_state`, `label_rail_rows`, section `toggle`).
- `SidebarItem.vue` is one template for every row type, branching on `row.item.type`.

## Carried forward

[v4](../v4/) kept `renderer.js` unchanged and `ViewOutlet.vue` almost unchanged (the prop is always `controller`), with the same Sidebar and sidebar item API. It dropped the separate class file plus `static view`: each class became an Options API `.vue` file (`Sidebar.vue`, `TypeLink.vue`, `TypeSectionBreak.vue`, `TypeSpacer.vue`, `TypeButton.vue`) compiled into a real class by `define.js`, and the root README records 42/42. The jQuery-bound listeners carried on into `v5/renderer.js` and `v8/renderer.js`, both with `call_handlers`.

## Open questions

- Everything here ran in jsdom only; the real-desk runs in the root README are for v5 and v8 (`bench/`).
- The outlet's cost was not measured here. v6 found it (root README), Issue #1 removed the outlet in v5 (each controller its own root), and v8 later moved to one `createApp` tree.

## See also

- Root [`README.md`](../README.md): the iteration table, and Issue #1 (outlet cost, merged listeners) and the independent review (renderer semantics).
- [`index.html`](../index.html): "How legacy callers keep working" (the desk renderer rows for `.addClass()`, `.html()` and `.trigger()`/`.off("click")`) and "Where each frappe.ui class fits" (Sidebar, `sidebar_item.*`).
- [`LEARNINGS.md`](../LEARNINGS.md): jQuery and Vue writing into the same element, and the renderer patching only the classes that changed.
- [`compat/CONTRACT.md`](../compat/CONTRACT.md) and [`compat/sweep-dom.md`](../compat/sweep-dom.md).
- Previous: [v2](../v2/README.md). Next: [v4](../v4/). Later: [v5](../v5/) (chosen), [v8](../v8/README.md).
