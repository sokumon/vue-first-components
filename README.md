# Vue-first frappe.ui

Design spikes for drawing Frappe's legacy `frappe.ui.*` classes with Vue, while their public API stays the same: names, constructor signatures, prototype methods, and the jQuery fields (`$wrapper`, `page.main`, `$items_container`, ...) that client scripts and apps rely on.

Each folder is one iteration. Open `index.html` for the full write-up, and `LEARNINGS.md` for what the spikes taught us. `compat/` holds the compatibility contract the ports are tested against.

| Folder | Idea | Outcome |
| --- | --- | --- |
| `spike.cjs` | Class is the controller, `static view` SFC, constructor returns `shallowReactive(this)`, one `createApp` | 24/24 |
| `v2/` | No mount in the class: controllers join `frappe.ui.views`, a `ViewOutlet` in the App teleports each view into its host | 21/21, then 23/23 without regions |
| `v3/` | `frappe.ui.Sidebar` and `sidebar_item.Type*` with their real API; a desk renderer that survives jQuery `.html()` and routes listeners through jQuery so `.trigger()` reaches them | 31/31 |
| `v4/` | The `.vue` file *is* the class: an Options API component with `name: "frappe.ui.Sidebar"` is compiled into a real class (`define.js`) | 42/42 |
| `v5/` | v4 plus `<script setup>` next to the public `<script>`; its bindings read as `this.x`. Since issue #1: each controller is its own small Vue root, no shared outlet | **Chosen design**. 57/57 in jsdom; 122/122 in a real desk (see `bench/`) |
| `v6/` | Functional components / detached `draw()` for leaves | Rejected: no gain; found the outlet's cost |
| `v7/` | No outlet: each controller teleports from its own detached root | Rejected; kept as the measured baseline |
| `v8/` | One `createApp` tree: `new` mounts its view as a real child through the renderer's `patch()`; template-first controls (`make_*()` switches parts on, `set_*()` sets state); complete ports of base_control/base_input/data | 107/107 in jsdom; real desk: 154/154 probe checks (including 13 regression checks for the break-report fixes), frappe's suite 135 passed with no new failures. `frappe.ui.Page` ported (`v8/ui/Page.vue`): a 48-spec page set fails exactly as legacy does, 33/33 probe checks (see `v8/README.md`, `v8/SPEC.md`, `bench/v8/`) |
| `es/` | frappe-ui components as `<es-*>` custom elements that Desk's jQuery creates and drives, on one Vue shared by every bundle. Also: petite-vue as a runtime, Link/Select built as Vue components (A) vs `es-*` tags (B), speed work, and frappe-ui's Combobox internals | petite-vue: rejected (14 of 319 components render the same). One Vue across bundles: 699 → 417 KB gz. B chosen for existing controls: 0 behaviour differences, Link/Select specs as legacy; first form open +34–63 ms after speed fixes, dialogs faster than legacy. Combobox patch −15% mount, −49–82% updates (see `es/README.md`) |
| `browser/` | Probe for a real desk in a browser | |
| `bench/` | The real-desk harness: probe classes, frappe-ui prebuild, Playwright probes, perf and build-time scripts | |

## Running

The spikes run in Node with jsdom. They load Vue, `@vue/compiler-sfc` and jQuery from a Frappe checkout, and jsdom from its `flow/` app:

```sh
FRAPPE=/path/to/apps/frappe node v5/spike5.cjs
```

`FRAPPE` defaults to `../../frappe` relative to this folder. Node 22 or newer. The browser probe needs Playwright (`PLAYWRIGHT=/path/to/playwright` if it isn't resolvable).

## Issue #1: what changed in v5

[Issue #1](https://github.com/sokumon/vue-first-components/issues/1) listed ten flaws from the first real-browser run. All ten are fixed, along with 58 more defects that four adversarial review rounds found (21, 15, 14, then 8) in the fixes and confirmed by reproducing them.

| # | Flaw | Fix |
| --- | --- | --- |
| 1 | Outlet create/destroy cost grew with n² | No outlet. `new` renders the view into a `mount_point` (renderer.js) whose first top-level insert goes to `host`. Each view also re-renders from its own queue (`vue_internals.schedule_apart`), so Vue's global queue stays one job long |
| 2 | Every read went through the reactive proxy | The n² outlet re-render was most of it. Internals now read `toRaw(this)` and live on the raw object as non-enumerable fields |
| 3 | `host` ran jQuery on every render | Resolved once, after `created()`, with the same `$(parent)[0]` rule as before |
| 4 | `flush()` missed `<Transition>` enters | The cause was child components' queued render jobs, not the post queue. `flush()` now runs watchers, the view's and its descendants' dirty renders, and the post queue, until nothing changes |
| 5 | frappe-ui `Menu` warned about a missing router | `desk_router.js` answers frappe-ui's `routerKey`/`routeLocationKey` with `frappe.set_route` |
| 6 | Merged listeners broke | `call_handlers` in `renderer.js`; listener return values no longer reach jQuery |
| 7 | Dropped controllers were never collected | Nothing global holds a controller. jQuery's `cleanData` destroys a view whose top-level node it removes; `destroy()` also destroys controllers drawn inside the view |
| 8 | `flush()` relied on Vue internals | All of them are in `vue_internals.js`, and `verify()` checks them against the loaded Vue at startup |
| 9 | Hooks in the class's `<script setup>` didn't run | Setup, `created()` and `renders()` run inside the view's own `setup`, so `onMounted`, `useTemplateRef` and `ref="x"` work |
| 10 | Setup imports were public as `this.x` | The build lists imports as `__imports`; without it, a narrow heuristic |

Real desk, Chromium, n = 1000 controllers (same production build for both):

| | Before | After | Plain Vue Teleports |
| --- | ---: | ---: | ---: |
| create | 1008 ms | 57 ms | 38 ms |
| destroy | 843 ms | 9 ms | 7 ms |
| set every row, then flush every row | | 18 ms | |

Desk asset build time is unchanged: `node esbuild --production --apps frappe` takes 5.2–5.4 s with or without the v5 bundle (median of 5, noise ±0.4 s), the v5 bundle alone builds in ~0.18 s, and `bench build --app frappe` takes ~32 s warm and ~43–47 s with island caches cleared, most of it the studio and flow Vite builds. See `bench/results-*.txt`.

## Forms: the field controls on v5

To test whether the design holds for forms, the three classes every form field inherits from are ported to v5: `frappe.ui.form.Control`, `ControlInput` and `ControlData` (`v5/controls/`). On the test bench they replace frappe's own (`bench/frappe-branch.diff`), so every other control (Int, Float, Currency, Select, Link, Date, Text, Table, Check, ...) still extends them unchanged, and every form, grid and dialog in the desk runs on them.

What moved into templates: the field wrapper (label, input area, read-only display, help box) and the input itself. Everything else is frappe's code as it was. A subclass that builds its own wrapper or input (Check, Switch, Comment; Link, Attach, Button) keeps doing so, because the template draws them only when the base method is what asks for them. (A first version missed one case, found by the review below: Check and Switch build their own wrapper but take the base class's input, and got none. They now get it the legacy way.)

| | Original controls | v5 controls |
| --- | --- | --- |
| Frappe's own Playwright specs: controls, forms, grids, dialogs, validation (156) | 135 passed, 14 failed, 7 not run | **the same 135 passed**, the same 14 failed, 7 not run |
| The 14 failures with no v5 code loaded at all | the same 14 | |

The 14 failures (datepicker, autocomplete, multiselect specs) fail identically on this bench without any v5 code, so they are environmental.

### Speed (Chromium, medians of 3 runs of `bench/pw/perf_forms.cjs`)

| | Original controls | v5 controls | |
| --- | ---: | ---: | --- |
| `refresh()` on 500 Data fields, nothing changed | ~24 ms | **~15 ms** | 1.6× faster |
| `set_input()` on 500 Data fields | ~11.5 ms | **~8 ms** | 1.4× faster |
| Create 500 Select controls | ~375 ms | **~305 ms** | 1.2× faster |
| Open the User form (106 fields) / System Settings (118) | ~160 / ~100 ms | ~160 / ~105 ms | same |
| Create 500 Data / Int controls | ~137 / ~158 ms | ~175 / ~165 ms | 1.3× / 1.05× slower |
| `refresh()` on 500 fields where every field changes (`reqd` toggled) | ~28 ms | ~53 ms | 1.9× slower |

Where it's faster, it's because the template owns the state legacy code re-wrote with jQuery on every call: the field's classes (hidden, error, required, bold), input-or-display, `disabled`, the input's attributes, the tooltip. A `refresh()` that changes nothing now writes no DOM at all, and the input's value is written only when it differs. Where it's slower, it's Vue's floor: mounting a component with ~13 nodes costs ~35 µs where jQuery parses the same HTML in ~25, and re-rendering a control after a change costs ~15–25 µs where one `toggleClass` costs ~4. A form refresh usually changes a few fields and leaves the rest, which is the case v5 wins.

The port found one real conflict: Vue re-applies an input's `value` on every render, so a re-render threw away what the user typed or legacy code `.val()`-ed since. The desk renderer now writes `value` only when the bound value changes, and the control templates don't bind `value` at all: the input owns it, as it always did (`bench/pw/probe_forms.cjs` checks it).

Not covered: web forms, which load `controls.bundle.js` without the desk's v5 runtime (they would need their own copy), and controls ported further than their wrapper and input (labels, descriptions and read-only display still go through jQuery).

## Does it work? An independent review

Three agents tried to break it, each finding reproduced by a second agent (`/tmp` scripts, not kept in the repo).

**What works.** Real desk use end to end on the v5 controls, with no console errors or Vue warnings: typing and saving; child tables (inline edit, row form, insert, delete, drag reorder); Link search and `set_query`, including in grids; Date, Datetime and Time pickers; Text Editor; mandatory and `depends_on`; save, submit, update after submit, cancel, amend; quick entry; dialogs with inline tables; list filters; report view inline editing. Over a long session, removed grid rows, dialogs and filters are destroyed and collected; the growth that remains is frappe's own (form sidebar, Awesomplete, escape handlers) and happens with the original controls too.

**What it found that v5 caused**, and its state:

| | Severity | State |
| --- | --- | --- |
| Check and Switch had no checkbox (they build their own wrapper but take the base input) | blocker | Fixed; `probe_forms.cjs` ticks them |
| Each desk bundle has its own Vue: a v5 class compiled into another bundle never updates | blocker for adoption | Open. Needs one shared Vue for all desk bundles |
| `new Control()` inside a Vue post flush (`onMounted`) returns before `$wrapper` and `$input` exist | major | Open. Shows up once Vue is shared |
| Web forms load the controls without the v5 runtime; a fresh build breaks them | major | Open |
| The desk renderer drops Vue's guard against listeners attached during the same click (vuejs/core#1004) | major | Open, small fix |
| `flush()` and cleanup rely on Vue 3.5 internals; `verify()` only logs | major | Open. Every Vue minor needs checking |
| No build step yet emits `frappe.ui.define` or `__imports`; frappe-ui must be prebuilt | major | Open |
| Renderer semantics differ from Vue: controlled inputs, jQuery event objects, `.off()` removes template listeners, shared class ownership | minor | Open |
| A Check whose wrapper is replaced leaves its controller and a comment node behind; destroyed controllers keep their unmounted Vue tree | minor | Open |
| No provide/inject or devtools tree across classes (each instance is its own root) | minor | By design |

**Verdict.** The architecture works for what it set out to prove: legacy classes drawn by Vue, with their public API and frappe's own tests intact, inside one bundle. It is not ready to adopt: that needs one shared Vue runtime for the desk, construction that stays synchronous inside Vue's own flushes, a web-form runtime, and the build step.
