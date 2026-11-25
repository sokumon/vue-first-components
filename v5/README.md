# v5: `<script setup>` beside the public `<script>`, one small Vue root per controller

| | |
| --- | --- |
| **Status** | Chosen |
| **Builds on** | v4 |
| **Question** | Can the `.vue` file that is the class (v4) also use `<script setup>` composition, and does the design hold on a real desk, including forms? |
| **Answer** | Yes: setup bindings read as `this.x`, each controller became its own small Vue root after [Issue #1](https://github.com/sokumon/vue-first-components/issues/1), and the ported form controls pass frappe's own specs with no new failures. Not ready to adopt yet (see the review verdict in the root [`README.md`](../README.md#does-it-work-an-independent-review)). |
| **Checks** | `57/57` in jsdom; real desk: `122/122` probe checks in Chromium (see [`bench/`](../bench/README.md)); frappe's own Playwright specs: 135 passed on the v5 controls, the same as the original controls |

## Idea

- v4 made an Options API `.vue` named `frappe.ui.*` into a real class through `frappe.ui.define` ([`define.js`](define.js)). v5 adds an optional `<script setup>` next to the public `<script>`: its refs, computeds and watchers read and write as `this.x`, while `methods` stay on the prototype so patches and `extends` still work ([`Counter.vue`](Counter.vue)).
- The rule (from [`index.html`](../index.html), "What you write"): anything callers or patches can reach goes in `methods`; everything else can be composition. A pure `<script setup>` file can't be the public API, because nothing is on the prototype at load and internal calls skip patches ([`PureSetup.vue`](PureSetup.vue) shows it).
- The build adds one line per compiled file: `__imports` (the setup's imports, kept off `this`) and, for a name starting with `frappe.ui.`, a call to `frappe.ui.define`. Here that line is in the spikes' `.vue` loader.
- Since Issue #1 there is no shared outlet: `new` renders the view into its own `mount_point` ([`renderer.js`](renderer.js)) in one synchronous `render()`, whose top-level nodes go to `host`. Setup, `created()` and `renders()` run inside the view's own `setup`, so `onMounted`, `useTemplateRef` and `ref="x"` work ([`HookSetup.vue`](HookSetup.vue)). Nothing global holds a controller.
- Every Vue internal the runtime relies on is in [`vue_internals.js`](vue_internals.js), and `verify()` checks them against the loaded Vue at startup. [`desk_router.js`](desk_router.js) answers frappe-ui's `routerKey`/`routeLocationKey` with `frappe.set_route`.
- Forms: `frappe.ui.form.Control`, `ControlInput` and `ControlData` are ported ([`controls/`](controls/)). Only the field wrapper and the input moved into templates; every other control still extends them unchanged.

## What's here

| File | What it is |
| --- | --- |
| [`spike5.cjs`](spike5.cjs) | The jsdom spike: compiles the `.vue` files, boots the desk renderer app, runs 57 checks on Sidebar, the sidebar items, Badge, PureSetup, Counter and HookSetup |
| [`spike5_real.cjs`](spike5_real.cjs) | The same spike, but the loader also runs `compileScript` on files with only a plain `<script>`, as a real build would |
| [`define.js`](define.js) | `frappe.ui.define` and the base `Component`: builds the class, draws each controller as its own root, `flush()`, `destroy()`, jQuery `cleanData` cleanup |
| [`renderer.js`](renderer.js) | Desk renderer over Vue's `nodeOps`/`patchProp`: a node keeps its Vue parent, Vue changes only its own classes, `value` is written only when the binding changes, listeners go through jQuery; `mount_point` |
| [`vue_internals.js`](vue_internals.js) | Every Vue internal used (`settle`, `run_pending_renders`, `flush_queues`, `schedule_apart`, ...) and `verify()` |
| [`desk_router.js`](desk_router.js) | vue-router stand-in for frappe-ui, backed by the desk router |
| [`App.vue`](App.vue) | The one app: `#fui-overlays` |
| [`Sidebar.vue`](Sidebar.vue), [`TypeLink.vue`](TypeLink.vue), [`TypeSectionBreak.vue`](TypeSectionBreak.vue), [`TypeSpacer.vue`](TypeSpacer.vue), [`TypeButton.vue`](TypeButton.vue) | `frappe.ui.Sidebar` and `frappe.ui.sidebar_item.*` with their public API |
| [`Badge.vue`](Badge.vue) | One file used both as a class and as a plain Vue component |
| [`Counter.vue`](Counter.vue) | `<script setup>` beside the public `<script>` |
| [`PureSetup.vue`](PureSetup.vue) | Pure `<script setup>`, to show why it can't be the public API |
| [`HookSetup.vue`](HookSetup.vue) | `onMounted` and `useTemplateRef` in the class's setup; imports kept private |
| [`controls/Control.vue`](controls/Control.vue), [`controls/ControlInput.vue`](controls/ControlInput.vue), [`controls/ControlData.vue`](controls/ControlData.vue) | Ports of `base_control.js`, `base_input.js` and `data.js`, run only on the real desk |
| [`compile_show.cjs`](compile_show.cjs), [`compile_real.cjs`](compile_real.cjs) | Print what `@vue/compiler-sfc` emits for `Sidebar.vue` (and `Badge.vue`): render code, bindings, and whether `compileScript` changed the script |

## How to run

From the repository root, `cd` into `v5/` first: the spike reads `.vue` files by relative path (``fs.readFileSync(`${f}.vue`)``), so `node v5/spike5.cjs` run from the root (the form the root `README.md` shows) fails with `ENOENT ... 'TypeLink.vue'`. `FRAPPE` defaults to `../../../frappe` relative to `v5/`; it needs `flow/node_modules/jsdom`, `node_modules/jquery` and `node_modules/vue`. Node 22.

```sh
cd v5
FRAPPE=/path/to/apps/frappe node spike5.cjs
FRAPPE=/path/to/apps/frappe node spike5_real.cjs
```

A passing run prints one `ok` line per check, ends with `57 passed, 0 failed`, and exits 0. Both spikes were run for this README (Node 22, the Frappe checkout of the `~/fb` test bench) and printed exactly that.

The real-desk run needs a Frappe bench (not in this repo). [`bench/README.md`](../bench/README.md) lists what to copy where, the `frappe-branch.diff` that loads the v5 controls, the build command, and the Playwright probes (`bench/pw/`).

## What it proved

- **Composition beside the public class.** "BOTH: a public method reads and writes the ref as this.count", "BOTH: bump's internal this.add goes through a prototype patch", "BOTH: an app's class extends gets its own setup state", "BOTH: destroy stops the setup's watchers".
- **Hooks and private imports.** "HOOKS: onMounted in the class's <script setup> runs once", "HOOKS: useTemplateRef is the element", "HOOKS: no warnings", "PRIVATE: imports aren't this.x".
- **Why pure `<script setup>` is not enough.** "PURE SETUP: nothing is on the prototype at load ..." and "PURE SETUP: make_sidebar's internal add_item call skips a patch".
- **The legacy Sidebar API, with opendesk's patches.** "a patched add_item saw every top-level row", "opendesk: back row first with its title", "rows removed by empty() are destroyed, the new ones live", and the `.trigger('click')` checks.
- **Issue #1 fixed on a real desk.** All ten flaws fixed, plus 58 defects from four review rounds (21, 15, 14, 8). The real-desk probes pass 122/122: `probe.cjs` 41, `probe_fixes.cjs` 24, `probe_review*.cjs` 57 (root [`README.md`](../README.md#issue-1-what-changed-in-v5), [`bench/README.md`](../bench/README.md)).
- **Scale.** Real desk, Chromium, n = 1000 controllers: create 1008 ms before, 57 ms after; destroy 843 ms before, 9 ms after (root [`README.md`](../README.md#issue-1-what-changed-in-v5)). The after run is in [`bench/perf-final.txt`](../bench/perf-final.txt) (57.4 / 9 ms).
- **Forms hold.** With the v5 controls replacing frappe's, frappe's own 156 Playwright specs for controls, forms, grids and dialogs give the same 135 passed, 14 failed, 7 not run as the original controls ([`bench/frappe-ui-tests-legacy.txt`](../bench/frappe-ui-tests-legacy.txt), [`bench/frappe-ui-tests-v5.txt`](../bench/frappe-ui-tests-v5.txt)); the root [`README.md`](../README.md#forms-the-field-controls-on-v5) records that the 14 fail without any v5 code too.
- **Form speed** (`bench/pw/perf_forms.cjs`): a `refresh()` that changes nothing is 1.6× faster and `set_input()` 1.4× faster; opening the User and System Settings forms costs the same. Full table in the root [`README.md`](../README.md#speed-chromium-medians-of-3-runs-of-benchpwperf_formscjs).
- **Build time unchanged.** `node esbuild --production --apps frappe` takes 5.2–5.4 s with or without the v5 bundle ([`bench/buildtime.sh`](../bench/buildtime.sh), [`bench/results-final.txt`](../bench/results-final.txt)).

## What it cost / what broke

- **Vue's floor on create and full re-render** (`perf_forms.cjs`): creating 500 Data controls ~1.3× slower, and a `refresh()` where every field changes ~1.9× slower than the original controls.
- **Vue re-applied `value` on every render**, throwing away what the user typed or `.val()` set. Fixed in the renderer, and the control templates don't bind `value` (`bench/pw/probe_forms.cjs` checks it).
- **Check and Switch had no checkbox** in the first controls port (found by the review; fixed).
- **Open after the independent review** (root [`README.md`](../README.md#does-it-work-an-independent-review)):
  - each desk bundle has its own Vue, so a v5 class compiled into another bundle never updates (blocker for adoption);
  - `new Control()` inside a Vue post flush (`onMounted`) returns before `$wrapper` and `$input` exist;
  - web forms load the controls without the v5 runtime;
  - the renderer drops Vue's guard against listeners attached during the same click (vuejs/core#1004);
  - `flush()` and cleanup rely on Vue 3.5 internals, and `verify()` only logs;
  - no build step yet emits `frappe.ui.define` or `__imports`, and frappe-ui must be prebuilt (`bench/fui-lib/`);
  - no provide/inject or devtools tree across classes, since each instance is its own root (by design).
- **Bundle size** ([`index.html`](../index.html), "Build time"): 375 KB minified: Vue 218 KB (each desk Vue bundle carries its own copy today), frappe-ui's Button and Dropdown 135 KB, the v5 runtime 15 KB.

## Carried forward

- v8 kept the class-from-`.vue` model, `renderer.js` (without `mount_point`, and patching only the classes that changed), `desk_router.js` unchanged, `define_field` (a computed that a caller's own assignment overrides), and `wrap_destroys` ([`v8/README.md`](../v8/README.md), [`v8/SPEC.md`](../v8/SPEC.md) §14).
- v8 dropped one root per controller for one `createApp` tree, which gives provide/inject and error capture across classes and makes `new` work inside `onMounted`. It also dropped `schedule_apart`, the `settle()` queue drain, `vue_internals.js` and the `renders()` hook ([`v8/SPEC.md`](../v8/SPEC.md) §14, [`v8/README.md`](../v8/README.md)).
- v6 and v7 tried alternatives to v5's views: v6 functional components (rejected, no gain), v7 each controller teleporting from its own detached root (rejected, kept as the measured baseline) (root [`README.md`](../README.md)).

## Open questions

- One shared Vue runtime for all desk bundles, and a build step that emits `frappe.ui.define` and `__imports` and compiles frappe-ui.
- Bootstrap's modal JS on a Vue-drawn `$wrapper`; Grid and Dialog markup; web forms ([`index.html`](../index.html), "Not run, and could change the design").
- Known problems listed in [`index.html`](../index.html): a view that re-renders while its root is `.detach()`ed puts a replaced root back into its original host; `watch`, `beforeUnmount` and cached computed options are not emitted yet.
- Synchronous construction inside Vue's own flushes was answered by v8's `patch()` mount ([`v8/SPEC.md`](../v8/SPEC.md), "Inside a Vue flush").

## See also

- [`index.html`](../index.html): the full v5 write-up (the picture, what `new` does, legacy callers, Issue #1, known problems, build time).
- Root [`README.md`](../README.md): the Issue #1 table, the forms port, speed and the independent review.
- [`LEARNINGS.md`](../LEARNINGS.md): what v5 to v8 taught.
- [`bench/README.md`](../bench/README.md): the real-desk harness for v5.
- [`compat/CONTRACT.md`](../compat/CONTRACT.md): the compatibility contract; the v5 bench is its harness.
- [`v4/README.md`](../v4/README.md) (before), [`v8/README.md`](../v8/README.md) (after).
