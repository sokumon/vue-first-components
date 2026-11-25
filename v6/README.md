# v6: Functional views and a detached `draw()` for leaves

| | |
| --- | --- |
| **Status** | Rejected |
| **Builds on** | v5, in its form before issue #1 (one shared `ViewOutlet`) |
| **Question** | Do functional components, or a detached `draw()` helper for leaf markup, make views cheaper than stateful components under the outlet? |
| **Answer** | No. Functional gave no speed gain over stateful; the cost that grew was the outlet's. |
| **Checks** | No count in the root [`README.md`](../README.md) table. Run for this README: `53/53` for `spike6_functional_views.cjs` and for `spike5_real.cjs`, plus 8 `ok` lines from `functional.cjs`; jsdom only |

## Idea

- The base is v5 as it was before issue #1: [`define.js`](define.js) turns a `.vue` into a `frappe.ui` class, each controller joins the reactive set `frappe.ui.views`, and [`ViewOutlet.vue`](ViewOutlet.vue), inside [`App.vue`](App.vue), renders one `<Teleport>` per controller into its `host`.
- [`define_functional.js`](define_functional.js) is `define.js` with one change: `view_for()` returns a functional component (a plain function with `props = ["controller"]`) instead of a stateful component with `setup()`. [`spike6_functional_views.cjs`](spike6_functional_views.cjs) is [`spike5_real.cjs`](spike5_real.cjs) with `define_functional.js` loaded in place of `define.js`, so every controller view in the Sidebar, Badge and Counter checks is functional.
- [`functional.cjs`](functional.cjs) tries functional components for leaves: a template-only [`BadgeLeaf.vue`](BadgeLeaf.vue) becomes a functional component through a one-line wrapper (`functional_from`), and `draw(component, props)` renders it into a detached `<div>` with the app's context, outside the outlet.
- It then compares, in jsdom, controllers through the outlet against functional and stateful leaves drawn in one parent or detached, at n = 100, 300 and 1000, and checks which of them are garbage-collected when dropped.

## What's here

The header comments in `spike6_functional_views.cjs` say "Spike 5" and "Run: node spike5_real.cjs". They were copied from v5; the file names below are the real ones.

| File | What it is |
| --- | --- |
| [`spike6_functional_views.cjs`](spike6_functional_views.cjs) | The spike: the v5 checks with every controller view functional (`define_functional.js`) |
| [`spike5_real.cjs`](spike5_real.cjs) | The same checks with stateful views (`define.js`); the comparison point |
| [`functional.cjs`](functional.cjs) | Functional leaves, `draw()`, lifetime and cost. Runs the setup part of `spike5_real.cjs`, then its own probes |
| [`define.js`](define.js) | `frappe.ui.define` and the base `Component`, with stateful views and the outlet |
| [`define_functional.js`](define_functional.js) | The same, with functional views |
| [`App.vue`](App.vue), [`ViewOutlet.vue`](ViewOutlet.vue) | The one app and the outlet that teleports every controller's view |
| [`renderer.js`](renderer.js) | Desk renderer: nodes keep the parent Vue gave them, Vue touches only its own classes, listeners go through jQuery |
| [`BadgeLeaf.vue`](BadgeLeaf.vue) | A template-only leaf, used as a functional component |
| [`Sidebar.vue`](Sidebar.vue), [`TypeLink.vue`](TypeLink.vue), [`TypeButton.vue`](TypeButton.vue), [`TypeSectionBreak.vue`](TypeSectionBreak.vue), [`TypeSpacer.vue`](TypeSpacer.vue) | `frappe.ui.Sidebar` and `frappe.ui.sidebar_item.*` |
| [`Badge.vue`](Badge.vue), [`Counter.vue`](Counter.vue), [`PureSetup.vue`](PureSetup.vue), [`HookSetup.vue`](HookSetup.vue) | Small classes for the class, `<script setup>` and hook checks |

## How to run

The scripts read sibling files by relative path (`fs.readFileSync("spike5_real.cjs")`, `` `${f}.vue` ``), so run them from inside `v6/`; from the repository root they fail with `ENOENT ... 'TypeLink.vue'`. `FRAPPE` defaults to `../../../frappe` relative to `v6/` (the root README's `../../frappe`). It needs `flow/node_modules/jsdom`, `node_modules/jquery` and `node_modules/vue`. Node 22 or newer.

```sh
cd v6
FRAPPE=/path/to/apps/frappe node spike6_functional_views.cjs
FRAPPE=/path/to/apps/frappe node spike5_real.cjs
FRAPPE=/path/to/apps/frappe node --expose-gc functional.cjs
```

A passing `spike6_functional_views.cjs` or `spike5_real.cjs` prints one `ok` line per check, a `HOOKS onMounted calls: ...` line (a log, not a check), ends with `53 passed, 0 failed`, and exits 0. `functional.cjs` prints 8 `ok` lines, a `GC:` line, and one cost line per n; it is an observation and has no pass count. All three were run for this README with Node 22.23.4.

## What it proved

- **Functional views keep the class API.** `spike6_functional_views.cjs` passes the same 53 checks as `spike5_real.cjs` (Sidebar rows, `.trigger('click')`, prototype patches, `class extends`, `<script setup>` bindings as `this.x`).
- **A functional child re-renders alone.** "a functional child re-renders alone when what it read changes" (`child_renders === 2`, `parent_renders === 1`), and "it still gets a component instance from Vue" with "no setup state, no proxy".
- **A template-only `.vue` works as a functional leaf.** "template-only .vue draws through a functional wrapper, synchronously"; the node can be moved with jQuery and its handler still runs through `.trigger`; "the same source gives the .html() string form"; "nothing joined the outlet".
- **Detached leaves are collected; outlet controllers are not.** One run: `GC: functional leaves still alive 0/200, stateful leaves still alive 0/200, controllers still alive 200/200`.
- **No speed gain from functional, and the outlet's cost grows faster than linear.** One run (jsdom; the script says to compare, not to read as browser numbers). Timings vary between runs; a second run gave 2485 / 1872 ms for the outlet at n = 1000, same shape:

| n | Controllers via outlet: create / destroy all | One parent: functional / stateful | Detached: functional / stateful |
| ---: | ---: | ---: | ---: |
| 100 | 62 / 24 ms | 21 / 28 ms | 18 / 24 ms |
| 300 | 365 / 209 ms | 56 / 72 ms | 53 / 72 ms |
| 1000 | 3423 / 2511 ms | 115 / 117 ms | 153 / 196 ms |

## Why it didn't work

- `index.html`, "Ruled out": the row "Functional components and a detached `draw()` helper (v6)" reads "Rejected. Functional gave no speed gain over stateful." The root `README.md` table: "Rejected: no gain; found the outlet's cost".
- The table above shows both: functional and stateful leaves cost about the same (115 vs 117 ms at n = 1000 in one parent), while controllers through the outlet went from 62 ms at n = 100 to 3423 ms at n = 1000.
- What replaced it: the outlet was the cost to remove, not the component kind. Issue #1 flaw 1 in the root `README.md` ("Outlet create/destroy cost grew with n²") was fixed in v5 by giving each controller its own small Vue root (n = 1000 in a real desk: create 1008 → 57 ms, destroy 843 → 9 ms). v7 tried no outlet with each controller teleporting from its own detached root.

## What it cost / what broke

- Controllers through the outlet: 3423 ms to create and 2511 ms to destroy 1000 in jsdom (table above).
- Controllers in `frappe.ui.views` are never collected when dropped (200/200 alive after GC); issue #1 flaw 7 records the same ("Dropped controllers were never collected").
- Hooks in a class's `<script setup>` don't run: the run logs `HOOKS onMounted calls: [] | box ref: null` with Vue warnings that `onMounted` and `useTemplateRef` were called with no active component instance (issue #1 flaw 9).
- A functional view has no setup state and no proxy (`instance.proxy === null`), so anything that needs a component's own state cannot live in it.

## Carried forward

- Kept: the stateful view (`view_for()` returning a component with `setup()`) stays in [`../v7/define.js`](../v7/define.js) and [`../v5/define.js`](../v5/define.js).
- Dropped: functional views, `BadgeLeaf.vue`, `draw()` and the outlet. No code file in `v5/`, `v7/` or `v8/` references `ViewOutlet` or `frappe.ui.outlet` (only `v7/README.md` names `ViewOutlet`, to describe v6), and none builds a functional view.

## Open questions

None for this exploration. The outlet's cost it exposed was answered by issue #1 (root [`README.md`](../README.md), flaw 1), measured in a real desk with the harness in [`../bench/`](../bench/README.md).

## See also

- [`index.html`](../index.html): "Ruled out" (v6) and "Issue #1, fixed" (outlet cost)
- Root [`README.md`](../README.md): the exploration table and issue #1
- [`LEARNINGS.md`](../LEARNINGS.md)
- [`../bench/`](../bench/README.md): the real-desk harness (`pw/perf.cjs` for create/destroy timings)
- [`../v2/README.md`](../v2/README.md) (where the outlet started), `v5/`, `v7/` (no outlet, the measured baseline), [`../v8/README.md`](../v8/README.md)
