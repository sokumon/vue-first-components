# v2: No mount in the class, one outlet teleports every view

| | |
| --- | --- |
| **Status** | Superseded by v3 |
| **Builds on** | v1 ([`spike.cjs`](../spike.cjs) at the root) |
| **Question** | Can a legacy class keep only state and methods, with no `render()` or `mount()` of its own, and still be drawn by its `.vue` file inside the app's one Vue tree? |
| **Answer** | Yes: controllers join `frappe.ui.views`, and a `ViewOutlet` in `App.vue` teleports each view into its host. |
| **Checks** | `23/23` in jsdom (`21/21` before regions were removed, per the root [`README.md`](../README.md)); jsdom only |

## Idea

- In v1 the class called `mount()` itself. Here the base class [`component.js`](component.js) never renders: the constructor wraps the instance in `shallowReactive`, calls `make()`, adds the controller to the reactive set `frappe.ui.views`, and calls `flush()`.
- [`App.vue`](App.vue) is mounted once, before any class exists. It holds [`ViewOutlet.vue`](ViewOutlet.vue), which renders one `<Teleport :to="controller.host">` per controller, drawing `controller.constructor.view` with the controller as its prop (`static prop`, e.g. `page` or `sidebar`).
- Because each view is a child of `App`, it gets App's provides (`inject("desk")` in [`PageView.vue`](PageView.vue)).
- `flush()` runs the outlet's and the view's pending render jobs at once, so methods that return an element (`add_inner_button`, `add_item`) can find it synchronously.
- No region construct: the spike checks that no `region` appears in the base class or views. Elements jQuery fills (`.layout-main-section`) are left empty in the template.
- Two probes look at what happens when jQuery writes into Vue-drawn DOM, and [`renderer.js`](renderer.js) tries a desk renderer that tolerates it.

## What's here

| File | What it is |
| --- | --- |
| [`spike2.cjs`](spike2.cjs) | The spike: boots jsdom, jQuery and Vue from a Frappe checkout, compiles `.vue` files, defines `frappe.ui.Page` and `frappe.ui.Sidebar` on the base class, runs 23 checks |
| [`component.js`](component.js) | `frappe.ui.Component`: state and methods only, `flush()`, `destroy()` |
| [`App.vue`](App.vue) | The one app: `#fui-overlays` and the outlet |
| [`ViewOutlet.vue`](ViewOutlet.vue) | Teleports each controller's view into its host |
| [`PageView.vue`](PageView.vue) | Page head, indicator, inner buttons, and the empty `.layout-main-section` |
| [`SidebarView.vue`](SidebarView.vue) | Sidebar header, menu, items, collapse button |
| [`probe.cjs`](probe.cjs), [`Probe.vue`](Probe.vue) | What Vue does when jQuery fills, moves, re-classes, `.html()`s or removes what it drew, under the outlet |
| [`probe2.cjs`](probe2.cjs), [`Probe2.vue`](Probe2.vue) | The same jQuery writes under Vue's own `createApp` and under the desk renderer |
| [`renderer.js`](renderer.js) | Desk renderer: a node remembers the parent Vue gave it, and Vue adds and removes only the classes it set. Used only by `probe2.cjs` |

## How to run

The scripts read their sibling files by relative path (`fs.readFileSync("component.js")`, `"spike2.cjs"`), so change into `v2/` first. From the repository root: `FRAPPE` defaults to `../../../frappe` relative to `v2/` (the same place as the root README's `../../frappe`); it needs `flow/node_modules/jsdom`, `node_modules/jquery` and `node_modules/vue`.

```sh
cd v2
FRAPPE=/path/to/apps/frappe node spike2.cjs
FRAPPE=/path/to/apps/frappe node probe.cjs
FRAPPE=/path/to/apps/frappe node probe2.cjs
```

A passing `spike2.cjs` prints one `ok` line per check, ends with `23 passed, 0 failed`, and exits 0 (confirmed with Node 22 for this README).

`probe.cjs` and `probe2.cjs` are observations, not pass/fail tests; they print what happened, including Vue warnings.

## What it proved

- **No rendering in the class.** Check "the base class and views call no render(), mount() or createApp()" scans `component.js`, `ViewOutlet.vue`, `PageView.vue` and `SidebarView.vue`.
- **One tree.** "the view sits in App's tree: it gets App's provides" and "the view's component has App's root as an ancestor".
- **Synchronous legacy API.** "head is drawn when the constructor returns", "add_inner_button returns the real element synchronously", and "opendesk: add_item then children().last() works synchronously".
- **Legacy fields kept.** "$wrapper is the parent the container made"; "page.main is the real .layout-main-section, legacy nesting kept"; "jQuery children of a Vue element with no children survive".
- **Prototype patches and subclasses.** "a prototype patch after construction is honoured", "a subclass keeps the parent's .vue and its overrides", "a patched data method (menu_items) shows".
- **jQuery and Vue together on the Page and Sidebar.** "a class a caller added survives re-renders", "jQuery .trigger('click') reaches the Vue handler", "opendesk's move and title survive Vue appending a row".
- **Several controllers, one outlet.** "two pages, one outlet: both drawn" and "destroy takes the view out of the outlet".
- **Vue's own renderer breaks under jQuery writes; the desk renderer does not.** `probe2.cjs` under Vue's `createApp`: a caller's class is `LOST` when Vue toggles `:class`, and after `.html()` over Vue's children the next update throws (`Cannot read properties of null (reading 'insertBefore')`). Under `renderer.js` the caller's class is kept, Vue removes only its own, the `v-if` child is added after the caller's `<i>caller</i>`, and a jQuery-moved row stays in place (`cabd`).

## Why it didn't work

The outlet was dropped after the first real-browser run ([Issue #1](https://github.com/sokumon/vue-first-components/issues/1), flaw 1, in the root [`README.md`](../README.md)): one outlet re-rendered every controller on every add, so create and destroy cost grew with n². This was measured on v5, which still used this outlet: in a real desk, n = 1000 controllers took 1008 ms to create and 843 ms to destroy. The fix replaced the outlet with one small Vue root per controller (57 ms and 9 ms; plain Vue Teleports 38 / 7 ms). [`v8/SPEC.md`](../v8/SPEC.md) gives the same reason for its design: "A parent-rendered list makes every add O(siblings) (the outlet's n²)."

## What it cost / what broke

- `probe.cjs`: after jQuery `.html()` over Vue-drawn children, inserting a new `v-if` child in that element throws (`Cannot read properties of null (reading 'insertBefore')`). The outlet uses Vue's own renderer, so this is not fixed here.
- `probe2.cjs`: under Vue's own renderer, every step after `.html()` throws, including a list growing after jQuery moved a row (`Cannot set properties of null (setting '__vnode')`).
- `flush()` and `view_instance()` reach into Vue internals: `instance.job` and the outlet's `subTree.children`.
- Every add or remove re-renders the whole outlet list (see above).

## Carried forward

- v3 kept `ViewOutlet.vue` unchanged, the base class (adding `renders()`, `rendered()`, a `host` getter and an `el` getter), and the desk renderer, to which it added listeners routed through jQuery so `.trigger` and `.off` reach them. v4 and v6 still have `ViewOutlet.vue`.
- v5 (after Issue #1) dropped the outlet: each controller became its own Vue root. v7 measured the no-outlet alternative and v8 returned to one tree without an outlet list.
- Dropped for good: `render()` or `mount()` in the class, and `v-region` / jQuery-owned regions (both under "Ruled out" in [`index.html`](../index.html)).

## Open questions

None left open by v2. Its jQuery-vs-Vue probes led to the desk renderer, developed in v3 and later in `v8/renderer.js`; its outlet cost was answered by Issue #1 (v5) and v8's synchronous `patch()` mount.

## See also

- Root [`README.md`](../README.md): the folder table and Issue #1
- [`index.html`](../index.html): "Issue #1, fixed" (outlet cost) and "Ruled out"
- [`LEARNINGS.md`](../LEARNINGS.md): "Vue writes props it thinks changed, not what the DOM has", and the one-tree design of v8
- [`compat/CONTRACT.md`](../compat/CONTRACT.md): the rule for elements jQuery and Vue both touch
- [`v8/SPEC.md`](../v8/SPEC.md): why v8 attaches each view in O(1) instead of an outlet list
- Next: [`v3/`](../v3/README.md); previous: [`v1/`](../v1/README.md) ([`spike.cjs`](../spike.cjs))
