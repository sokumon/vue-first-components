# es/: frappe-ui components as `<es-*>` tags in jQuery Desk

23–25 Nov 2026. All work is local: nothing is committed to the bench and nothing is pushed.

## The question

Can every frappe-ui and @framework/ui component be turned into a tag like `<es-button>` that Desk's jQuery code creates and drives? Components must be used **unchanged**: no hand ports, only generic shared fixes. Bundle size was the original worry, and petite-vue was a nice-to-have.

## Answers in short

| Question | Answer |
|---|---|
| Do the components run on petite-vue? | **No.** petite-vue has no components, slots, render functions, provide/inject or Teleport. Of 319 components, 14 render identically. Making it work would mean re-implementing Vue. |
| Can they become custom elements that jQuery drives? | **Yes**, with a shared runtime (`runtime/`): 155 tags register, and most work or work with caveats. |
| Does every bundle carry its own Vue? | It did: 9 of 54 bundles. **One Vue across all bundles works** (`one-vue` branch): the 7 Vue bundles drop from 699 to 417 KB gz. |
| Vue components or `es-*` tags for Desk's existing controls? | **`es-*` tags.** Both match legacy behaviour, but the tags keep Desk's control code unchanged. |
| Are they fast enough? | **Nearly.** After the fixes, a form's first open is +34 to +63 ms over legacy, re-opens are level, and dialogs are faster than legacy. |
| Why still slower? | Each Combobox is 20 Vue component instances, 17 of them reka-ui's. Vue charges for each instance. |
| Can frappe-ui's Combobox get faster? | **Somewhat.** A patch gives −15% on mount and −49% to −82% on updates. The bigger levers are in reka-ui. |

## 1. petite-vue

petite-vue 0.4.1 only provides `createApp`, `reactive` and `nextTick`, and its last release was May 2022.
- **Differential run:** 319 components against real Vue. 263 threw errors, 41 rendered differently and 14 were identical (about 5 of frappe-ui's 200 and about 7 of framework-ui's 119).
- **Generic shims:** they barely changed the result. Going further means re-implementing Vue.
- **petite-vue only as page glue, around Vue custom elements:** 71 works, 39 with caveats, 23 broken and 4 not usable on their own. It also injected attribute `{{}}` content into Vue's output and cost 3.3× the mount time and 2.3× the memory.

**Verdict:** petite-vue is not a runtime for these components.

## 2. Custom elements driven by jQuery (`runtime/`)

A shared es-runtime (`runtime/src/runtime.js`) runs one Vue app for all `<es-*>` elements, with one Teleport per element.
- **jQuery contract:** `.attr()` for strings and booleans, `.prop()` for objects, and events read from `e.originalEvent.detail`.
- **Sweep of 155 tags:** 96 work, 51 with caveats, 20 broken, and 2 are not usable on their own. Prototype fixes bring framework-ui to about 326/330 and the menus to 47/47.
- **Compared with one Vue app per element:** about the same mount time, 30–40% less memory, and no duplicate ids.

**Why a runtime, not plain `defineCustomElement`:**
- one app per element;
- light-DOM child content never reaches the component as a slot (a Button's text rendered outside the button);
- attributes arrive as strings;
- elements built while detached don't render until attached, and Desk builds controls detached;
- jQuery's `.html()`, `.empty()` and `.remove()` need handling.

(`update:*` events reach jQuery fine. They are only lost when a Vue template hosts the element.)

**Size:** all 155 tags come to about 1 MB gz, so each bundle should include only the tags it needs.

## 3. One Vue across all bundles (`one-vue/`)

- **How it works:**
  - `vue.bundle.js` sets `frappe.Vue`;
  - an esbuild plugin points every `vue` and `@vue/*` import at it;
  - `assets.json` records `"<bundle>:requires": "vue.bundle.js"`;
  - a shared `asset_loader` loads it in the right order;
  - the file uploader loads lazily.
- **Bundle sizes:** the 7 Vue bundles drop from 698.8 to 416.5 KB gz, with one Vue copy and reactivity shared between bundles.
- **Page loads:** Desk's first load drops from 1614 to 1500 KB, and the login page from 274 to 214 KB.
- **Your MobileNav:** about 31 KB to 4 KB, with no hand-kept list of Vue names (`vue_global.js` is deleted).
- **Tests:**
  - Frappe suite: 134 passed / 15 failed / 7 did not run. The one extra failure is the grid dropdown position check on a web form, caused by the spike's `control.js`, not by one-vue.
  - Targeted checks: 49/1. Lazy-uploader checks: 26/26.
- **Minor issues left:**
  - `_executed` stays an array after a rebuild;
  - a website page hangs when an asset fails to load;
  - Desk needs a full reload to retry a failed load;
  - the freeze overlay shows on the first upload;
  - deep `@vue/*/dist` and `vue.cjs` imports aren't redirected;
  - the Vite-built islands (chart, flow.chat) still carry their own Vue.

**This is the clearest win of the exploration, whichever UI direction is chosen.**

## 4. Three ways to build Desk's Link and Select (`link-select/`)

Built on the bench against legacy, with one Vue, and frappe-ui unchanged.
- **A: Vue components.** The Control class stays the API, and a `.vue` file in the v8 app tree draws frappe-ui's Combobox and Select.
- **B: `es-*` tags.** The legacy jQuery class stays, and only `make_input` and `set_formatted_input` change, to create `<es-combobox>` / `<es-select>`.

The app-code contract was taken from about 1,400 Frappe and ERPNext files: `set_query` (624 call sites), `$input`, `awesomplete`, `fetch_from`, `set_df_property` and so on.

| | Legacy | A | B |
|---|---|---|---|
| Link/Select specs | 48/4 | 46/6 | **48/4** |
| Full suite | 135/14 | 133/16 | **134/15** |
| Behaviour differences (82 steps, including ERPNext) | – | **0** | **0** |
| Other differences (internals, markup) | – | 27 | **0** |
| Copied Desk code | – | ~860 lines generated from `link.js`, plus a `select.js` port | none |

The 4 legacy failures are the Gender tests, which fail because the site has no Gender records. The new failure in both versions is a test of Desk moving the dropdown list out of a grid cell; frappe-ui's list floats, so there is nothing to move.

The judge recommended **B for existing controls** and **A (v8) for new Vue-first screens**. Both control types cost 15–20× legacy memory; that comes from frappe-ui, not from either approach.

## 5. Making B fast (`link-select/speed/`, `link-select/speed2/`)

**Corrections found first:**
- **Broken test forms:** a new Sales Invoice (and Purchase Invoice) doesn't render on this bench. ERPNext uses an arrow function in a `depends_on`, and this Frappe checkout's evaluator rejects it. The earlier "+92%" was measured on that broken form.
- **Wrong "legacy" baseline:** the same-build legacy was too slow. B's scoped CSS slowed style recalculation for the whole page, legacy controls included.

**Fixes kept:**

| Fix | Effect |
|---|---|
| **CSS:** a `:where(tag) X` per scope instead of nested universal rules, and the unused `.prose` and `::backdrop` rules removed | the biggest win: about 50–75 ms off every form open, legacy controls included |
| A setting moved from right after mount to the first open | removes a second render of every Combobox |
| The runtime skips setting a prop to the value it already has | fewer re-renders |
| **Lazy Link:** Desk's plain `<input>` stands in until the field is near the screen, focused, or its `$input`/`awesomplete` is touched | only on-screen fields mount (Sales Order: 10 of 32) |
| **Lazy Select**, plus mounting before a dialog's first frame | the native `<select>` stays `$input`, so the API is unchanged |
| Select renders only the selected option until it is first used | reka rendered every option even while closed |

**Results** (independent re-measure, ready ms; the base column is B before these fixes):

| | Legacy | B base | B final |
|---|---|---|---|
| Sales Order, first open | 384 | 510 | 418 |
| Delivery Note, first open | 366 | 513 | 418 |
| Stock Entry, first open | 288 | 380 | 324 |
| ToDo, first open | 207 | 314 | 270 |
| Re-opens | – | – | level with legacy |
| Dialog, 40 Link + 10 Select (painted) | 58–62 | 144 | **50–55** |

**Correctness:**
- UI checks: 10/10.
- Link/Select specs: only the Gender failures.
- Harness: 0 differences in behaviour, API, markup or errors.
- Full suite: unchanged.
- Break tests (hidden tabs, collapsed sections, `set_value` while hidden, dialogs, grid with Tab, keyboard only): no differences.

## 6. Why it is still slower: anatomy of one closed Combobox

```
Combobox (frappe-ui) > LabelingWrapper (frappe-ui) > ComboboxRoot > PopperRoot > ListboxRoot > Primitive
  ├─ ComboboxAnchor > PopperAnchor > Primitive > PrimitiveSlot > Primitive
  │     ├─ ComboboxInput > ListboxFilter > Primitive
  │     └─ ComboboxTrigger > Primitive
  └─ ComboboxPortal > Teleport > ComboboxContent > Presence      (popover, mounted while closed)
```

- **Instances:** 20 per field: frappe-ui 2, reka-ui 17, Vue 1.
- **Reactive state:** 40 effects, 59 computeds, 95 refs and 139 dependency trackers.
- **Memory:** about 118 KB, against about 2 KB for a legacy Link.
- **Where mount time goes:** Vue's machinery 66%, reka's own code 7%, frappe-ui's own code 5%, garbage collection 9%.
- **Scale (100 fields, warm):** plain `<input>` 0.7 ms, minimal Vue input 11 ms, Combobox 175 ms.

Vue costs about 0.1 ms per simple component; it gets heavy here because one field is 20 instances. On top of that:
- the 5 `Primitive` wrappers are the biggest single item;
- the popover is mounted before anyone opens it;
- reka renders 7 instances a second time right after mounting;
- any prop change re-renders 15–17 of the 20 instances.

**Remaining gap:** about 2.7 ms and about 115 KB per on-screen Link, which is +34 to +63 ms on a form's first open.

## 7. Can frappe-ui's Combobox get faster? (`combobox-speed/`)

A patch on a local frappe-ui branch, `combobox-perf` (uncommitted; `Combobox.vue` plus a new `shared/slotOutlet.ts`):
- mounts the popover on first open;
- uses a slot outlet so slot content stops forcing reka's parts to re-render;
- runs filtering only while the list is open and the user is typing;
- memoizes slot presence and the wrapper class.

| | Before | After |
|---|---|---|
| Mount 100 fields | 241 ms | 206 ms (−15%) |
| Update query on 100 closed fields | 71 ms | 36 ms (−49%) |
| Update options on 100 closed fields | 53 ms | 9.5 ms (−82%) |
| Memory per field | 123 KB | 103 KB |
| Instances per field | 20 | 16 |
| Re-opening a list | 21 ms | 24 ms (slightly slower) |

**Tests:** Cypress 127/127, vitest 11/11, type check clean, and 86 + 114 behaviour checks.

**Regression:** a `#trigger` slot that renders a Fragment (forwarded slot, `<template v-if>`, several root elements) no longer opens on click. The fix is in `combobox-speed/verify/slotOutlet-fragment-fix.patch`; it is **not yet applied to the branch**.

**For Desk:** about −0.35 ms and −19 KB per Link, so only 3–5 ms per form; a refresh across 13 Links goes from about 8–9 ms to about 4 ms.

**reka-ui proposals:**
- **R1** (first priority): reorder `isFormControl && name` in about 17 components. This removes the extra render after mount; measured at −15 to −30% on scratch copies, not on top of the patch.
- **R1b:** make `contentId` reactive, so the patch's workaround can go.
- **R2:** remove the extra anchor wrapper layer (2 fewer instances per field).
- **R3:** build the exposed-props proxy lazily.
- **R4:** make `Primitive` render children through `renderSlot`.

## 8. Recommendations

1. **Ship one Vue across bundles.** It is independent of everything else; fix its minor issues first.
2. **Existing Desk controls: `es-*` tags, driven by jQuery** (variant B with the speed fixes).
3. **Next speed step: mount on intent.** Visible fields also start as a stand-in styled exactly like frappe-ui's input, and the Combobox mounts on hover or focus. This should bring first open and memory close to legacy and also removes the reveal flicker. Not built yet.
4. **Upstream:** the frappe-ui Combobox patch with the trigger fix and new tests (Fragment triggers, `aria-controls` right after open, server rendering), and reka R1.
5. **Consider B2: no separate runtime,** in the style of `<frappe-mobile-nav>`: `defineCustomElement` from `frappe.Vue` plus about 50 lines of glue (attach or mount before reading `$input`, and handle Link's custom HTML rows). Same speed, about 820 fewer lines; it gives up the "any component works as a tag" generality.
6. **New Vue-first Desk screens:** the v8 single-app pattern (variant A's style).

## 9. Known issues and gaps

- **Lazy mounting:**
  - newly shown fields display the stand-in for 1–3 frames after a tab switch or section expand;
  - unmounted controls are never released from the internal list.
- **Behaviour differences:**
  - picking a Select with the mouse doesn't fire `input` on `$input`;
  - after removing 200 fully mounted controls, about 14–17 MB of memory stays held.
- **Not ported to frappe-ui in B** (they keep the legacy input): web forms (they load their own bundles), TableMultiSelect, LinkCombobox, and subclasses that use `custom_awesomplete_filter`.
- **Never checked:** `remember_last_selected_value`, `fetch_if_empty`, `page.add_field`, report filters, POS, bom_creator, dark mode, RTL, mobile.
- **Changed for app code:** `.awesomplete > ul` selectors (data_import, shop_floor, grid row parking) no longer find the list, and styling `awesomplete.ul` (bom_creator) has no effect.
- **Bench hazards:** the erp site sometimes serves stale asset hashes after `clear-cache`. A server restarted while the bench lock is held keeps the lock (start it with `9>&-`).

## 10. State and layout

**State of things:**
- **Bench:** restored to `v5-desk-probe` at 7cc7280, in v8page mode. The v8 probes pass (41/41, 33/33).
- **`frappe/` clone:** branch `one-vue`, local only. `one-vue/one-vue.diff` is the same change as a diff.
- **`frappe-ui/` clone:** branch `combobox-perf` with uncommitted changes, still missing the trigger fix. `combobox-speed/frappe-ui-combobox-perf.patch` is the same change as a patch.
- **Nothing is pushed.**

**What is in this folder:** sources, scripts, patches and the small result files. It was curated from the working folder `wc/`, which is not in the repo (3.5 GB with node_modules, builds and CPU profiles). Scripts still use their original `wc/...` and `~/fb` paths.

| Folder | What it holds | Was |
| --- | --- | --- |
| `spike/` | The first custom-element spike: `define-es.js` (one app per element) and `entry.js` registering every capitalised frappe-ui export | `wc/src` |
| `petite/` | The petite-vue differential run (`analyze.mjs`, `harness.js`, `run.mjs`, `classify.mjs`), the generic shims and their results | `wc/petite-all` |
| `per-element/` | Sweeps of per-element custom elements with petite-vue as page glue, the generic fixes and the adversarial review | `wc/sweep` |
| `runtime/` | The jQuery-driven shared runtime (`src/runtime.js`), its contract (`CONTRACT.md`), smoke test and the `sweep-*` fix patches | `wc/jq` |
| `one-vue/` | `one-vue.diff` (one Vue across all bundles) and its checks: smoke, targeted, lazy uploader, sizes | `wc/one-vue` |
| `link-select/` | Link and Select built three ways: `contract/` (what app code uses), `harness/` (differential flows and diff), `A-vue-components/`, `B-es-tags/` (final sources), `judge/`, `results/`, `speed/` and `speed2/` (speed fixes, measurements, independent verification) | `wc/three-ways` |
| `combobox-speed/` | The frappe-ui Combobox benchmark (`bench/`), baseline (`baseline/`, including `instance-tree.txt`), the patch, behaviour checks and verification | `wc/combobox-speed` |
