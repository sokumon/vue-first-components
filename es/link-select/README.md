# Three ways: frappe-ui in Desk's Link and Select controls

This folder holds the experiment that compares three ways of drawing Desk's Link and Select controls:

- **Legacy Desk.** The baseline.
- **A, "Vue components" (the v8 pattern).** The Control class stays the public API, and a `.vue` file draws it with frappe-ui components, mounted into one `createApp` tree.
- **B, "es-* tags".** The Control class stays legacy jQuery, and `make_input` creates a frappe-ui component as an `es-*` custom element. This uses the runtime in `wc/jq`.

The test controls are Link (with `ControlDynamicLink` and the other subclasses) and Select. The frappe-ui counterparts are Combobox (or Autocomplete) and Select, used unchanged.

Every variant runs the same checks on the same bench, and is diffed against the legacy baseline.

## Layout

| path | what |
|---|---|
| `contract/CONTRACT.md` | **The contract.** Every app-facing use of Link and Select in frappe and erpnext, grouped by API, with counts, and the harness step that checks each item |
| `contract/sweep.py` → `sites.md`, `sweep.json` | The sweep script, every file:line it found, and the counts. Re-run: `python3 contract/sweep.py` |
| `harness/lib.cjs` | Sessions, request capture, and the in-page probe `window.__tw`. The probe reads control state, the public API, legacy structure, visible listbox rows and jQuery events |
| `harness/flows.cjs` | The differential flows: 10 flows, 82 steps |
| `harness/run.cjs` | Runs the flows on the bench's current mode and writes `results/harness-<label>.json` and `results/<label>/shots/*.png` |
| `harness/diff.cjs` | Compares two runs and sorts each difference into a class: behaviour / api / structure / events / requests / errors, plus timings |
| `harness/perf.cjs` | Form open times, synthetic `make_control`, a dialog with many links, JS heap, DOM nodes and listeners per control, and heap growth. Writes `results/perf-<label>.json` |
| `harness/seed.cjs` | Idempotent ERPNext test data on erp.localhost: TW Cust Alpha/Beta/Gamma and TW-ITEM-001..003. Already run |
| `harness/toggle-combobox.cjs` | Switches frappe's own `enable_combobox_link_field` on v5.localhost (see "A free reference" below). It is **off** now |
| `run-all.sh <label>` | Harness, perf, Link/Select specs ×2, the full suite, and the diff against legacy, all under the bench lock. `SKIP_SUITE=1` skips the 17-minute suite |
| `run-specs.sh <label> [repeat]` | `control_link`, `control_link_combobox`, `control_dynamic_link`, `control_select` and `link_selector` specs |
| `run-suite.sh <label>` | `~/fb/pwt/run.sh` (156 specs). Drains RQ first, and copies the result to `results/suite-<label>.txt` |
| `bench-legacy.sh` | Puts the bench in the baseline state (idempotent): one-vue diff, `mode.sh legacy`, full `bench build`, clear-cache, start both servers |
| `bench-backup/` | `NOTE.txt` (the bench matched `wc/one-vue/bench-backup` before anything changed), `assets.json.before`, `mode.before` (v8page), `erpnext-head.txt`, `bench-legacy-onevue.diff` (the tracked diff as left now) |
| `bench.lock` | **Every bench build, server start and Playwright run goes through `flock bench.lock …`.** Only one agent may use the bench at a time |
| `results/` | Baseline outputs (below) |

## Bench state (as left)

- `~/fb/frappe-bench/apps/frappe` is on `v5-desk-probe`, in **mode `legacy`**, with **`wc/one-vue/one-vue.diff` applied** and a full `bench build`. Nothing is committed.
  - Every bundle shares `frappe.Vue` (3.5.43).
  - `assets.json` has `<bundle>:requires: vue.bundle.js`.
  - The user's spike work is intact: `vue_first*/`, `vue_first8/` and `mode.sh`.
- **Sites:**
  - `v5.localhost:8000`: frappe only; the test site for the specs.
  - `erp.localhost:8001`: frappe + erpnext; company "Compat Test Co", INR.
  - Start them with `~/fb/start_server.sh` and `~/fb/start_erp_server.sh`. Log in as Administrator/admin.
  - Open `/desk/<route>` directly, because `/desk` alone loops to the setup wizard.
- **To go back to the state before this experiment** (v8page, no one-vue):
  1. `git apply -R wc/one-vue/one-vue.diff`
  2. `~/fb/pwt/mode.sh v8page`
  3. delete `sites/assets/assets.json` and run a full `bench build`. The one-vue commit message explains why the `:requires` keys would otherwise stay behind.

## How to run

```bash
. ~/fb/env.sh; W=/home/claude/vue-first-components/wc/three-ways; export NODE_PATH=~/fb/pw/node_modules
$W/bench-legacy.sh                                   # only if the bench is not already legacy+one-vue
cd $W/harness
flock ../bench.lock node run.cjs mylabel             # all flows (~2.5 min); or: node run.cjs mylabel v5.dialog erp
node diff.cjs ../results/harness-legacy.json ../results/harness-mylabel.json   # exit 1 on behaviour/api/errors
flock ../bench.lock node perf.cjs mylabel 7          # ~4 min
$W/run-specs.sh mylabel 2                            # ~6.5 min
$W/run-suite.sh mylabel                              # ~17 min
$W/run-all.sh mylabel                                # all of the above, then the diff
```

**Flows** (site.flow, then the steps):

- `v5.form_todo` (24 steps): API surface, focus opens the list, typing filters it, Enter picks, blur, `set_query`, `get_query =`, `fetch_from` (assigned_by → full name), `frm.set_value` and `control.set_value` Promises, invalid value on blur, clearing, read-only display, arrows and Escape, ArrowDown+Enter, Enter refused on an action row, Select options/pick/`set_value`/`set_df_property("options")`, Dynamic Link, Advanced Search, "Create a new".
- `v5.form_user_titles`: title link (Language shows "Deutsch" and stores `de`), `set_value` with title fetch, translated doctype.
- `v5.dialog`: df `get_query`, `only_select` + df `filters`, Escape closes the list and not the dialog, Dynamic Link inside the dialog, Select with `{label, value}`, `set_df_property` options, "Create a new Note" opening Quick Entry with the typed title.
- `v5.grid_workflow`: grid row Link search and pick, `grid.get_field().get_query`, grid Select, arrow keys while the list is open, `update_docfield_property` read_only, `frappe.model.set_value` on a row.
- `v5.quick_entry`: Address quick entry, with a Select and a Link.
- `v5.standalone`: `make_control` with `only_input` and `get_route_options_for_new_doc`, `awesomplete.ul` styling (the bom_creator pattern), `only_select`, Select.
- `v5.translation`: Select option labels through `__()`, and the translated-doctype Link (Role) shown translated while the stored value stays raw.
- `v5.web_form`: `/update-profile/Administrator/edit`, with a Language Link and a time_zone Select.
- `erp.sales_invoice`: customer `party_query` with filters, typing and picking, then the customer fetch; naming_series Select; item_code in the items grid through `item_query`; read-only; `set_value`.
- `erp.stock_entry`: `stock_entry_type` sets `purpose` (a `fetch_from` into a Select); warehouse `get_query` (company, `is_group=0`) in a collapsed section; item_code in the grid.

The flows touch only the public API (`cur_frm.fields_dict.x`, `dialog.fields_dict.x`, `grid_rows[i].on_grid_fields_dict.x`) and visible semantics. Visible semantics means `[role=option]` rows or listbox `<li>` rows, input values, `disp_area` text and links, and modal titles. So the same flows run on A and B.

- **Structure** is the legacy markup apps reach into (`.link-btn`, `.awesomplete`, …). It is recorded under `structure` and counted on its own.
- **Request capture** records `search_link`, `validate_link_and_fetch`, `get_link_title` and `search_widget` calls, with their doctype, txt, query and filters. A variant must send the same query and filters.
- **Click fallback.** If an input is covered and cannot be clicked, the harness focuses it instead and records a `[note]` in the diff.

## Baseline numbers (legacy + one-vue, 2026-11-24)

**Frappe suite** (`results/suite-threeways-legacy-onevue.txt`):
- 135 passed, 14 failed, 7 did not run.
- The 14 failures are the same 14 environmental ones as `~/fb/pwt/baseline.txt` (compared name by name). So one-vue plus legacy adds no failures.

**Link/Select specs ×2** (`results/specs-legacy.txt`):
- 48 passed, 4 failed. These are the same 2 tests on each repeat: `control_link` "Gender … language de" and "Gender … language en".
- They are environmental: v5.localhost has **no Gender records**, so the first row is "Create a new Gender". The harness uses Role, another translated doctype, for that reason.

**Harness** (`results/harness-legacy.json`):
- 10 flows, 82 steps, 0 step errors, 0 console errors.
- legacy vs. a second legacy run (`diff-legacy-vs-legacy-rerun.md`): **0 differences in every class**, so the flows are deterministic. The per-flow wall times agree within 2%:

  | flow | ms |
  |---|---:|
  | form_todo | 38,900 |
  | form_user_titles | 7,600 |
  | dialog | 17,600 |
  | grid_workflow | 11,300 |
  | quick_entry | 5,900 |
  | standalone | 5,600 |
  | translation | 5,100 |
  | web_form | 4,700 |
  | sales_invoice | 18,200 |
  | stock_entry | 17,200 |

**Perf** (`results/perf-legacy.json`, `perf-legacy-rerun.json`; medians of 6 runs after 1 warm-up):

| metric | run 1 | run 2 |
|---|---:|---:|
| open User (106 controls: 6 Link, 5 Select) | 196 ms | 188 ms |
| open ToDo (new) | 69 ms | 70 ms |
| open Workflow (new) | 79 ms | 67 ms |
| open Sales Invoice (new; 208 controls: 52 Link, 4 Select) | 263 ms | 244 ms |
| open Stock Entry (new; 80 controls: 27 Link, 3 Select) | 136 ms | 135 ms |
| make 200 Link controls | 104 ms | 107 ms |
| make 200 Select controls | 99 ms | 109 ms |
| set_input on 200 Link / 200 Select | 10.5 / 5.4 ms | 11.3 / 4.6 ms |
| refresh() on 200 Link | 17 ms | 14 ms |
| Dialog with 40 Link + 10 Select, new+show | 54.5 ms | 54.1 ms |
| JS heap per Link control | 6.0 KB | 6.0 KB |
| JS heap per Select control | about 0 (its cost is DOM, not JS heap) | about 0 |
| DOM nodes per Link / Select control | 71 / 67 | |
| JS listeners per Link / Select control | 17 / 3 | |
| heap growth per new Sales Invoice (5 opens; `locals` keeps each new doc) | 686 KB | 695 KB |

"DOM nodes left after removing 600 controls" shows all 40,800 of them, while the JS heap went back to +436 KB. A CDP GC does not purge Blink's DOM counter, so treat that number as unreliable. Compare the JS heap instead.

**A free reference: frappe's own Combobox Link.** Frappe develop already has a jQuery `frappe.ui.Combobox` Link (`link_combobox.js`), switched on by System Settings → `enable_combobox_link_field`.
- I ran the v5 flows with it on, as a check that the harness can tell implementations apart (`results/harness-legacy-combobox.json`, `diff-legacy-vs-legacy-combobox.md`).
- Result: 85 behaviour, 32 api, 26 structure, 39 events and 17 requests differences, and 0 console errors. Examples:
  - no `awesomplete.list`, `awesomplete.isOpened` or `$link`;
  - no "Advanced Search" row and no "Filtered by" row;
  - rows carry an avatar initial ("A Administrator");
  - clearing by typing keeps the old value;
  - no `awesomplete-*` events.
- It is a useful third reference for A and B. The setting was switched back off through the document API, which also resets `__default`.

## How the variants plug in

Both variants start from the bench state above. Each one adds **its own patch** on top: `git apply` for tracked files, plus copied untracked files. Never commit in the bench. Rebuild, and run `run-all.sh <label>`. To go back, reverse the patch and run `bench-legacy.sh`.

Keep each variant's files in its own folder under `wc/three-ways/` (e.g. `A/`, `B/`), with an `apply.sh` and a `revert.sh`. The frappe-ui `.vue` files must stay unchanged.

**What every variant must keep working:**
- **Subclasses.** `frappe.ui.form.ControlLink` is read at module-evaluation time by the subclasses in `controls.bundle.js`: `dynamic_link.js`, `table_multiselect.js`, `link_combobox.js` and `dynamic_link_combobox.js` (`extends frappe.ui.form.ControlLink`). So either:
  - the new class must exist *before* `controls.bundle.js` and `control.js` must stop importing `./link` (variant A); or
  - the variant patches `ControlLink.prototype` / `ControlSelect.prototype` *after* it (variant B), so the subclasses inherit the change.
- **Globals.** `link.js` and `select.js` also define globals that other code uses, and a port that drops those files must provide them:
  - `frappe.ui.form.recent_link_validations`;
  - the `Awesomplete.prototype.get_item` / `_itemCursor` patch;
  - `frappe.ui.form.add_options`, `$.fn.add_options`, `$.fn.set_working` and `$.fn.done_working`;
  - the `$.fn.val` patch that fires `select-change`.
- **`make_control`** (`control.js:65`) adds `Combobox` to the class name for Link and Dynamic Link when the System Settings toggle is on. Leave the toggle off for variant runs.
- **Desk-core readers of Link internals** (contract §5–6). Either keep these working or patch them in lockstep:
  - `grid_row.js:1250` reads `field.autocomplete_open`;
  - `dialog.js:157-173` reads `.awesomplete input[aria-expanded]`;
  - `field_group.js:91` listens for `awesomplete-selectcomplete`;
  - `grid.js:184` calls `field.awesomplete.close()`.

**A: Vue components (the v8 pattern).**
- **Runtime and classes.** The bench has the v8 runtime in `frappe/public/js/vue_first8/` (`define.js`, `renderer.js`, `controls/Control.vue`, `ControlInput.vue`, `ControlData.vue`). The `vue_first8.bundle.js` entry calls `frappe.ui.define()` for each `.vue` file. Add `controls/ControlLink.vue` and `controls/ControlSelect.vue` (`name: "frappe.ui.form.ControlLink"`, `extends: ControlData`) to the entry's list.
- **Mode.** `~/fb/pwt/mode.sh v8` loads `vue_first8.bundle.js` before `controls.bundle.js`. It strips `base_control`, `base_input` and `data` from `control.js`. Variant A has to strip `./select` and `./link` as well: add a mode such as `v8link` to a copy of `mode.sh` kept in the variant folder, or put the extra strip in its apply script. Then `node esbuild --production --apps frappe --files frappe/vue_first8.bundle.js,frappe/controls.bundle.js`.
- **frappe-ui inside Desk.** Desk's esbuild cannot compile frappe-ui SFCs, so they are prebuilt with Vite in `~/fb/fui-lib`.
  - `entry.js` exports `Button` and `Dropdown` from frappe-ui 1.2.0 (npm). Add `Combobox`, `Select` and (if used) `Autocomplete` there.
  - Build with `cd ~/fb/fui-lib && npx vite build`, then copy `dist/fui-lib.js` to `vue_first8/fui-lib.js`. `vue` stays external, so it uses one-vue's `frappe.Vue`.
  - Note that wc/jq builds from the repo's `frappe-ui/` checkout, not from npm 1.2.0. Use the same frappe-ui source for A and B, or record the difference.
- **Contract rule** (`compat/CONTRACT.md`, `v8/SPEC.md`):
  - `$input`, `input`, `$wrapper` and `disp_area` stay real elements created once;
  - inside handed-out elements, jQuery owns the DOM;
  - `awesomplete` needs a shim with `ul`, `close()`, `isOpened`, `list` and `evaluate()`. `link_combobox.js`'s `awesomplete_shim` is prior art.

**B: es-* tags (wc/jq).**
- **Build.** `wc/jq/build.sh` produces:
  - `dist/esm/es-ui.js`, which leaves `vue` as a bare import, so Desk's esbuild and the one-vue shim resolve it to `frappe.Vue`;
  - `dist/es-ui.scoped.css` (wc/jq `CONTRACT.md` §1, §9).
- **Load it in Desk.** Add an untracked entry to the bench, for example `frappe/public/js/es_link.bundle.js`, that:
  - imports `{ ES }` from the built ESM, or copies `dist/esm` into `frappe/public/js/es_ui/`, because sources must be under the app;
  - patches `frappe.ui.form.ControlLink.prototype.make_input` (and the related `set_formatted_input`, `get_input_value`, …) and `ControlSelect.prototype`, so that `make_input` appends `<es-combobox>` / `<es-select>` into `this.input_area`.

  List it in `hooks.py` `app_include_js` **after** `controls.bundle.js`, and the CSS in `app_include_css`. Patch `hooks.py` from `git show HEAD:frappe/hooks.py` the way `mode.sh` does, then rebuild that bundle.
- **Known runtime issues and their generic fixes:**
  - `wc/jq/review/` (run-all, desk tests);
  - `wc/jq/sweep-{display,inputs,overlays,shell}/runtime.patch`, `sweep-inputs/proto/vite.config.patch`, `sweep-overlays/entry.patch`, `sweep-framework-ui/proto/fix.patch`.

  Apply the ones the variant needs to `wc/jq/src` before building, and list them.

**After a variant run.**
1. Run `node harness/diff.cjs results/harness-legacy.json results/harness-<label>.json`.
2. Every `behaviour`, `api` or `errors` line is either a break or a documented, accepted difference. Compare with `diff-legacy-vs-legacy-combobox.md` to see how frappe's own Combobox port differs.
3. Compare the perf JSONs side by side with the baseline above.
4. Restore the bench to legacy+one-vue before handing it on.

## Gaps (known)

- **Not yet checked in the harness:**
  - `remember_last_selected_value`;
  - `fetch_if_empty`;
  - `page.add_field` Links;
  - report-filter Links;
  - grid Select `update_docfield_property("options")`;
  - the POS / bom_creator reach-ins beyond `awesomplete.ul` and the structure counts.
- **Site data.** The Gender table on v5.localhost is empty, which is why the two Gender specs fail. The `form_user_titles` gender step sets a value that has no record.
- **Run metadata.** `meta.link_class` / `select_class` in a run file are minified names from the production build. Use the `api.chain` in the `api` steps instead, which is resolved through `frappe.ui.form`.
