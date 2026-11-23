# v7: No outlet, each controller teleports from its own detached root

| | |
| --- | --- |
| **Status** | Rejected (kept as the measured baseline, per the root [`README.md`](../README.md) table) |
| **Builds on** | v6 (itself v5 before issue #1): the same Sidebar, sidebar item, Badge and Counter `.vue` files and `renderer.js` as [v6](../v6/README.md); `App.vue` drops v6's `ViewOutlet` |
| **Question** | Can the `frappe.ui` classes work with no shared outlet, each controller teleporting its view from its own detached root, and what does that cost in time and lifetime? |
| **Answer** | The classes work without an outlet (the spike's checks all pass); the design was rejected and kept as the measured baseline. |
| **Checks** | No count in the root [`README.md`](../README.md) table. Run for this README: `50/50` for `spike7.cjs`; jsdom only |

## Idea

- v6 (and v5 before issue #1) drew every controller through one `ViewOutlet` in `App.vue` that teleported each view into its host. v7 has no outlet: `App.vue` holds only `#fui-overlays`, and no file here references `frappe.ui.views` or `frappe.ui.outlet`.
- Each controller draws itself in `$draw()` ([`define.js`](define.js)): it creates a detached `<div>` (`$root_box`) and calls the desk renderer's `render(h(Teleport, { to: this.host }, [view]), $root_box)`. The view's DOM lands in `host`; the root itself never enters the page.
- The view vnode gets the app's context (`view.appContext = frappe.ui.app._context`), so `inject` and `globalProperties` still come from the one `createApp`.
- The class's `<script setup>` runs in `$run_setup()`, inside an `effectScope` under `frappe.ui.app.runWithContext`, not inside the view component. Its bindings read as `this.x`.
- `flush()` runs only this view's own render job. `destroy()` stops the setup's scope and renders `null` into `$root_box`.
- The comment on `$draw()` states the aim: "Each view gets its own root, so nothing shared holds the instance or grows with the page." [`cost.cjs`](cost.cjs) measures that: cost and lifetime.

## What's here

| File | What it is |
| --- | --- |
| [`spike7.cjs`](spike7.cjs) | The jsdom spike: compiles the `.vue` files, boots the desk renderer app, runs 50 checks on Sidebar, the sidebar items, Badge and Counter. It is v6's `spike5_real.cjs` without the PureSetup and HookSetup checks, with "only live rows are in the outlet" replaced by "only live rows are in the DOM" |
| [`cost.cjs`](cost.cjs) | Loads the spike's setup (everything before `let pass`), then measures: `inject` from the app context, which dropped controllers are garbage-collected, create / one update / destroy times for n = 100, 300, 1000 Badges, and sibling order in one container. Needs `--expose-gc` |
| [`define.js`](define.js) | `frappe.ui.define` and the base `Component`: builds the class, `$run_setup()`, `$draw()` (a Teleport from a detached root), `flush()`, `destroy()` |
| [`renderer.js`](renderer.js) | Desk renderer over Vue's `nodeOps`/`patchProp`: a node keeps its Vue parent, Vue changes only its own classes, listeners go through jQuery. Identical to v4's and v6's |
| [`App.vue`](App.vue) | The one app: `#fui-overlays`, no outlet |
| [`Sidebar.vue`](Sidebar.vue), [`TypeLink.vue`](TypeLink.vue), [`TypeSectionBreak.vue`](TypeSectionBreak.vue), [`TypeSpacer.vue`](TypeSpacer.vue), [`TypeButton.vue`](TypeButton.vue) | `frappe.ui.Sidebar` and `frappe.ui.sidebar_item.*` with their public API (identical to v6's) |
| [`Badge.vue`](Badge.vue) | One file used both as a class and as a plain Vue component |
| [`Counter.vue`](Counter.vue) | `<script setup>` beside the public `<script>` |

## How to run

The header comment in `spike7.cjs` says "Spike 5" and "Run: node spike5_real.cjs". It was copied from v5; the commands below use the real file names.

Both scripts read files by relative path (`spike7.cjs` reads `` `${f}.vue` ``, `cost.cjs` reads `"spike7.cjs"`), so they must run from inside `v7/`: `node v7/spike7.cjs` from the repository root fails with `ENOENT ... 'TypeLink.vue'`. `FRAPPE` defaults to `../../../frappe` relative to `v7/` (not the `../../frappe` the root `README.md` gives); it needs `flow/node_modules/jsdom`, `node_modules/jquery` and `node_modules/vue`. Node 22. From the repository root:

```sh
(cd v7 && FRAPPE=/path/to/apps/frappe node spike7.cjs)
(cd v7 && FRAPPE=/path/to/apps/frappe node --expose-gc cost.cjs)
```

A passing `spike7.cjs` run prints one `ok` line per check, ends with `50 passed, 0 failed`, and exits 0. Both scripts were run for this README (Node 22.23.4, the Frappe checkout of the `~/fb` test bench); the spike printed exactly that, and `cost.cjs` printed:

```
inject from the app context: light
GC, dropped without destroy(): badges 0/200, rows reading the sidebar 200/200 | rows after destroy(): 0/200
n=100   create 26ms, one update 1ms, destroy all 7ms, order kept true
n=300   create 79ms, one update 0ms, destroy all 18ms, order kept true
n=1000  create 328ms, one update 0ms, destroy all 53ms, order kept true
siblings in one container, in order: 0 (0),1 (0),2 (0),3 (0),4 (0)
```

The timings are one jsdom run on one machine and vary between runs: a second run gave create 22 / 77 / 325 ms and destroy all 6 / 11 / 55 ms; the GC, inject and sibling lines were the same. "order kept" in `cost.cjs` actually checks that the container is empty after every Badge is destroyed.

## What it proved

- **The legacy Sidebar API works with no outlet.** "rows drawn in order, a row with no path skipped, patched get_path honoured", "a patched add_item saw every top-level row", "opendesk: back row first with its title", "make_sidebar after empty() and .html('') redraws the module", "only live rows are in the DOM", "a real click on a Button row runs its onClick" and the two jQuery `.trigger('click')` checks.
- **The class model is unchanged.** "extends: in the .vue is a real prototype chain", "as a class: a later prototype patch reaches a live instance", "as a class: an app's `class extends` overrides a field, with super", and "as a component: the same .vue mounts as a plain Vue component".
- **Composition beside the public class, with setup outside the view.** "BOTH: ref, computed, inject and a private helper draw at once", "BOTH: bump's internal this.add goes through a prototype patch", "BOTH: an app's class extends gets its own setup state", "BOTH: destroy stops the setup's watchers".
- **App context without one tree.** `cost.cjs`: `inject from the app context: light` for a Counter drawn from its own detached root.
- **Dropped controllers that read nothing global are collected.** `cost.cjs`: 0 of 200 Badges dropped without `destroy()` survive forced GC; 0 of 200 TypeLink rows survive after `destroy()`.
- **Siblings keep their order.** `cost.cjs`: five Badges teleported into one container read `0 (0),1 (0),2 (0),3 (0),4 (0)`.

## What it cost / what broke

- **Rows that read the sidebar are not collected without `destroy()`.** `cost.cjs`: 200 of 200 TypeLink rows dropped without `destroy()` (their host cleared with `innerHTML = ""`) are still alive after forced GC. TypeLink reads `frappe.app.sidebar` in `created()` and in its computed fields ([`TypeLink.vue`](TypeLink.vue)).
- **Nothing destroys a view when its DOM is removed.** `define.js` has no jQuery `cleanData` hook; only an explicit `destroy()` unmounts.
- **Create and destroy cost, in jsdom** (`cost.cjs`, one run): n = 100 / 300 / 1000 Badges take 26 / 79 / 328 ms to create and 7 / 18 / 53 ms to destroy (a second run: 22 / 77 / 325 and 6 / 11 / 55 ms). One update and flush takes 0–1 ms.
- **`flush()` runs only the view's own render job**, not child components' renders, watchers or the post queue.
- **No real-desk run.** Nothing in `bench/` measures v7.

## Carried forward

- v5, after [Issue #1](https://github.com/sokumon/vue-first-components/issues/1), also has no outlet and gives each controller its own small Vue root. It renders the view into a `mount_point` ([`../v5/renderer.js`](../v5/renderer.js)) instead of a Teleport from a detached `<div>`, runs setup, `created()` and `renders()` inside the view's own `setup`, and destroys a view when jQuery's `cleanData` removes its top-level node (root [`README.md`](../README.md#issue-1-what-changed-in-v5)).
- v8 dropped one root per controller for one `createApp` tree: `new` mounts the view as a real child through the renderer's `patch()` ([`../v8/README.md`](../v8/README.md)).
- The stateful view (`view_for()` returning a component with `setup()`) is kept from v6 in this `define.js` and in v5's.

## Open questions

- v7 was measured only in jsdom; the repository has no real-desk numbers for it.
- Views kept alive by global reactive state: [`index.html`](../index.html) ("Known problems") records for v5 that "A view kept alive by global reactive state, whose DOM was removed without jQuery, isn't collected until destroyed", the same case as the 200 of 200 rows here. It is marked "Same as any Vue component".

## See also

- Root [`README.md`](../README.md): the folder table (v7: "Rejected; kept as the measured baseline") and the Issue #1 table (flaw 1, outlet cost; flaw 7, controller lifetime).
- [`index.html`](../index.html): "Issue #1, fixed" (outlet cost, controller lifetime) and "Known problems".
- [`LEARNINGS.md`](../LEARNINGS.md): "jQuery removal must destroy".
- [`bench/perf-final.txt`](../bench/perf-final.txt): real-desk create/destroy runs for v5, plain Teleports and plain `v-for`.
- [`../v6/README.md`](../v6/README.md) (the outlet's cost), [`../v5/README.md`](../v5/README.md) (one root per controller after Issue #1), [`../v8/README.md`](../v8/README.md) (one tree).
