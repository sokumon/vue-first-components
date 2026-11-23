# v4: The `.vue` file is the class

| | |
| --- | --- |
| **Status** | Superseded by v5 |
| **Builds on** | v3 |
| **Question** | Can one Options API `.vue` file be both the legacy `frappe.ui` class and its view, with no hand-written class? |
| **Answer** | Yes: a component named `frappe.ui.Sidebar` is compiled into a real class by `frappe.ui.define` (`define.js`), and the same file still mounts as a plain Vue component. |
| **Checks** | `42/42` in jsdom; jsdom only |

## Idea

- In v3 each class was hand-written JavaScript (`v3/sidebar.js`, `v3/sidebar_item.js`) with a separate view (`v3/Sidebar.vue`, `v3/SidebarItem.vue`). In v4 there is one `.vue` per class, written in the Options API, and no `.vue` declares a class.
- The `.vue` loader in `spike4.cjs` adds one line to each compiled file: if `_sfc_main.name` starts with `frappe.ui.`, it calls `frappe.ui.define(_sfc_main)`.
- `frappe.ui.define` ([`define.js`](define.js)) builds a class with the short name (`Sidebar`) and assigns it to the dotted global. `methods` go on the prototype, `created`/`mounted` become methods, `data` becomes the instance's initial fields, `computed` become fields a caller can still assign, and `extends` becomes a real prototype chain, so `super` works.
- The base `Component` is v3's model kept: the constructor wraps `this` in `shallowReactive`, calls `created()`, and if `renders()` is true adds the controller to `frappe.ui.views`, flushes and calls `mounted()`. [`ViewOutlet.vue`](ViewOutlet.vue) still teleports each view into its `host`.
- The ported classes are `frappe.ui.Sidebar` and `frappe.ui.sidebar_item.TypeLink`, `TypeSectionBreak`, `TypeSpacer` and `TypeButton`, plus a small `frappe.ui.Badge` that tests the class and component uses of one file.

## What's here

| File | What it is |
| --- | --- |
| [`spike4.cjs`](spike4.cjs) | The spike: boots jsdom, jQuery and Vue from a Frappe checkout, compiles the `.vue` files (adding the `frappe.ui.define` line), stubs the desk globals, runs 42 checks |
| [`define.js`](define.js) | `frappe.ui.define` and the base `Component`: turns a compiled `.vue`'s options into its `frappe.ui` class; `flush()`, `destroy()`, `host`, `$el` |
| [`renderer.js`](renderer.js) | The desk renderer from v3: nodes keep the parent Vue gave them, Vue adds and removes only its own classes, listeners are bound through jQuery |
| [`App.vue`](App.vue) | The one app: `#fui-overlays` and the outlet |
| [`ViewOutlet.vue`](ViewOutlet.vue) | One `<Teleport>` per controller in `frappe.ui.views` |
| [`Sidebar.vue`](Sidebar.vue) | `frappe.ui.Sidebar`: its public methods, jQuery fields as `computed`, and the template |
| [`TypeLink.vue`](TypeLink.vue) | `frappe.ui.sidebar_item.TypeLink`, the base sidebar row |
| [`TypeSectionBreak.vue`](TypeSectionBreak.vue), [`TypeSpacer.vue`](TypeSpacer.vue), [`TypeButton.vue`](TypeButton.vue) | Row types that `extends: TypeLink` |
| [`Badge.vue`](Badge.vue) | `frappe.ui.Badge`: `props`, `data`, `computed`, `methods`; used as a class and as a component |

## How to run

From the repository root, change into `v4/` first: the spike reads the `.vue` files by relative path (`fs.readFileSync(\`${f}.vue\`)`), so `node v4/spike4.cjs` run from the root fails with `ENOENT` on `TypeLink.vue`. `FRAPPE` defaults to `../../../frappe` relative to `v4/`; the checkout it names needs `flow/node_modules/jsdom`, `node_modules/jquery` and `node_modules/vue`.

```sh
cd v4 && FRAPPE=/path/to/apps/frappe node spike4.cjs
```

A passing run prints one `ok` line per check, ends with `42 passed, 0 failed`, and exits 0 (confirmed with Node 22 for this README).

## What it proved

- **No hand-written class.** "no .vue writes a class or assigns frappe.ui.*" scans the `<script>` of every `.vue`. "the class has the real name, its methods on the prototype" (`frappe.ui.Sidebar.name === "Sidebar"`, `add_item` own on the prototype).
- **`extends` and `super` are real.** "extends: in the .vue is a real prototype chain" and "super in a .vue method reaches the parent" (`TypeButton.container_class()` falls back to `TypeLink`'s).
- **The Sidebar keeps its public API.** `new frappe.ui.Sidebar()` with no options; `wrapper` is `.body-sidebar-container` under `body`; `setup()` fires `sidebar_setup`; `$sidebar`, `$items_container`, `$standard_items_band`, `items`, `get_item()`, `highlight_active_item()`; the user menu still goes through `frappe.ui.Dropdown`; `toggle_width()` updates the DOM before `sidebar-expand` fires and stores the state in `localStorage`.
- **Prototype patches installed before boot are honoured.** A patched `add_item` sees every top-level row, and a patched `TypeLink.prototype.get_path` changes the row drawn.
- **jQuery and Vue together.** A real click and `.trigger('click')` on a Button row (and on its `<a>`) run its `onClick`; opendesk's back row (`add_item`, then `.attr("title")` and `prependTo`) survives; `make_sidebar()` after `empty()` and `.html('')` redraws.
- **The same file works as a class.** `new frappe.ui.Badge(opts)` draws at once; methods and computed work and `this` is reactive; a later prototype patch reaches a live instance; an app's `class extends` can override a computed with `super`; undeclared properties can be set; assigning a computed field overrides the view (the `this.$input = ...` pattern).
- **And as a plain Vue component.** "as a component: the same .vue mounts as a plain Vue component" and "its data, computed and methods work" (mounted with `createApp(Badge, { label })`).
- **Only live controllers are in the outlet.** "only live rows are in the outlet" checks the size of `frappe.ui.views` after a redraw.

## Why it didn't work

v4's design was extended, not abandoned: v5 is "v4 plus `<script setup>`" (root [`README.md`](../README.md)). The part of v4 that was dropped is the outlet. After the first real-browser run ([Issue #1](https://github.com/sokumon/vue-first-components/issues/1), flaw 1, in the root `README.md`), one outlet re-rendering every controller on every add made create and destroy cost grow with n². This was measured on v5, which still used the outlet: n = 1000 controllers took 1008 ms to create and 843 ms to destroy in a real desk. v5 replaced it with one small Vue root per controller (57 ms and 9 ms; plain Vue Teleports 38 / 7 ms).

## What it cost / what broke

- Every add or remove re-renders the whole outlet list (see above).
- `flush()` and `view_instance()` reach into Vue internals: `instance.job` and the outlet's `subTree.children`.
- `define.js` reads only `name`, `extends`, `data`, `computed`, `methods`, `created`, `mounted` and `render`. Other options (for example `watch`) are not turned into the class; [`index.html`](../index.html) still lists "watch, beforeUnmount, cached computed options" as not emitted.
- Composition is not available: the class is Options API only. v5 added `<script setup>` for that.
- The `.vue` compile step is the spike's own loader (regex `import` to `require`, plus the added `frappe.ui.define` line). No real build emits that line yet (root `README.md`, "No build step yet emits `frappe.ui.define` or `__imports`").

## Carried forward

- v5 kept `frappe.ui.define`, the `extends` prototype chain and `define_field` (computed fields a caller can assign) in `v5/define.js`, and has its own `Sidebar.vue`, `Type*.vue` and `Badge.vue`. It added `<script setup>` next to the public `<script>`, whose bindings read as `this.x`.
- v5 first kept the outlet; after Issue #1 it dropped it, and each controller became its own small Vue root. v6 still has `ViewOutlet.vue`; v8 returned to one tree without an outlet list.
- The desk renderer continued into v5 and later `v8/renderer.js`.

## Open questions

- How to add composition without losing the prototype API: answered by v5 ("anything callers or patches can reach goes in methods. Everything else can be composition", [`index.html`](../index.html)).
- The outlet's cost: answered by Issue #1 (v5) and v8's synchronous mount.
- A real build step that emits `frappe.ui.define(_sfc_main)`: still open (root `README.md` review table, and "Next test" in `index.html`).

## See also

- Root [`README.md`](../README.md): the folder table, Issue #1, and the independent review
- [`index.html`](../index.html): "From file to class", "Ruled out" (hand-written classes "should come out of compilation"), and "Issue #1, fixed"
- [`LEARNINGS.md`](../LEARNINGS.md): "The class stays the public API; a `.vue` file draws it"
- [`compat/CONTRACT.md`](../compat/CONTRACT.md): what Frappe and ERPNext code uses from the legacy desk classes, which a port must keep working
- Next: [`v5/`](../v5/); previous: [`v3/`](../v3/)
