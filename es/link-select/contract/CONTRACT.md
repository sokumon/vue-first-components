# Link and Select controls: the app-facing contract

What Frappe and ERPNext app code uses from `frappe.ui.form.ControlLink`, `ControlDynamicLink` and `ControlSelect`. Any variant that brings frappe-ui into these controls (A: Vue components; B: es-* tags) must keep all of it working, with no change to app code.

- **Source:** `sweep.py` in this folder, run over `~/fb/frappe-bench/apps`.
  - **App code:** 1,412 files, meaning frappe outside `public/js` and tests, plus all of erpnext.
  - **Desk core:** 600 files in frappe `public/js`, with the `vue_first*` spikes left out.
- **Field types:** each field-handle site is resolved to a field type in this order:
  1. inline df literals in the same file;
  2. the DocType JSON next to the script, with its child tables;
  3. a fieldname that has one type across all DocTypes.
- **Full lists:** `sites.md` has every file:line, and `sweep.json` has the counts.
- **Limits:**
  - The counts come from regexes.
  - Calls on aliases (`const f = frm.get_field(x); f.$input`) are only partly caught.
  - Third-party apps are not in the corpus.
  - The wider control and grid contract is in `compat/CONTRACT.md` §2.3 and §2.4. This file narrows it to Link and Select.

**Check IDs.** `[flow/step]` names a step in `harness/flows.cjs`. Each step records an observation, and `harness/diff.cjs` compares it across modes.

---

## 1. Metadata the controls must honour (DocType JSON, both apps)

| property | Link (2,592 fields) | Dynamic Link (120) | Select (770) | check |
|---|---:|---:|---:|---|
| `fetch_from` (the target field is filled when the link changes) | 125 Link targets; 422 fetch_from fields in all | | 10 Select targets (`Stock Entry.purpose` ← `stock_entry_type.purpose`) | `v5.form_todo/fetch_from`, `erp.stock_entry/type-pick-fetches-purpose`, `erp.sales_invoice/customer-type-pick` |
| `fetch_if_empty` | 27 | 1 | 5 | (not yet in the harness) |
| `link_filters` (JSON filters, `eval:` values) | 34 | | | `set_custom_query` path; covered indirectly by `erp.stock_entry/warehouse-get_query` |
| `ignore_user_permissions` (sent as a search arg) | 173 | | | request capture in every search step |
| `remember_last_selected_value` | 53 | | | (not yet in the harness) |
| `read_only` / `read_only_depends_on` | 613 / 30 | 36 / 1 | 125 / 10 | `*/read-only-display` |
| `reqd` / `mandatory_depends_on` | 580 / 70 | 28 / 7 | 245 / 32 | (mandatory styling: state `label`, `wrapper`) |
| `options` as a newline list, translated with `__(opt, null, doctype)` | | | 770 | `v5.translation/select-option-labels-translated` |
| `sort_options` | | | 2 | |
| DocType `show_title_field_in_link` (the input shows the title, the model holds the name) | 20 doctypes (Contact, Language, ...) | | | `v5.form_user_titles/*`, `v5.web_form/initial` |
| DocType `translated_doctype` (the value is shown through `__()`) | 25 doctypes (Gender, Country, Role, ...) | | | `v5.translation/translated-link-*`, `v5.form_user_titles/translated-doctype-link` |

## 2. Queries: what the search sends

| API | app sites | core | shape apps use | check |
|---|---:|---:|---|---|
| `frm.set_query(field, fn)` / `set_query(field, child_table, fn)` | **624** (237 in the 3-argument child-table form) | 1 | `fn(doc, cdt, cdn)` returns `{filters}`, `{query, filters}`, or a method string; `filters` may be a dict or a list of lists | `v5.form_todo/set_query-filters` |
| `control.get_query = fn` (control or `grid.get_field(f)`) | **61** (51 resolved to Link, 3 to Dynamic Link) | 12 | assigned as a property, and read when the next search runs (`portal_settings.js:6`, `auto_repeat.js:7`) | `v5.form_todo/get_query-assign`, `v5.grid_workflow/grid-get_field-get_query` |
| `get_query:` in a df literal (dialogs, `make_control`, `add_field`) | **190** | 19 | the same shapes; POS item group uses `{query, filters}` (`pos_item_selector.js:284`) | `v5.dialog/link-get_query-in-df` |
| `df.filters` (static, merged into the search) | via df literals | 34 | `{disabled: 0}` | `v5.dialog/only_select-and-df.filters` |
| `link_filters` in JS | 2 | | `delivery_note.js:228` sets `link_filters` on a dialog df | |
| `frappe.desk.search.search_link` args | | | `txt, doctype, ignore_user_permissions, reference_doctype, page_length, link_fieldname, filters, query` plus custom keys spread from get_query | every search step records them (`requests`) |
| Empty-value filter pruning (`set_nulls`) | | | an empty filter on a Link field is dropped, not sent | `set_query-filters` request capture |

A variant may switch the transport (GET or POST, caching), but the args reaching `search_link` and the query method must be the same. The differ reports request differences as their own class.

## 3. Values: reading and writing

| API | app sites (resolved Link / Dynamic / Select) | contract | check |
|---|---:|---|---|
| `frm.set_value(f, v)` / `frappe.model.set_value(dt, dn, f, v)` | 238 / 15 / 50 | the input shows the value (title for title links, translation for translated doctypes); fetches run; the field event fires; a Promise is returned | `v5.form_todo/set_value-from-code`, `v5.grid_workflow/grid-set_value-from-code`, `erp.sales_invoice/set_value-from-code` |
| `control.set_value(v)` returns a Promise; `control.get_value()` | get_value 9+3 (+ aliases); set_value 2+ | | `v5.form_todo/control-set_value-get_value` |
| `control.set_input(v)` (display only, no model write) | 2 Link, 4 Select (setup wizard) | | `v5.standalone/make_control-only_input` |
| `control.value` read directly | 14 (`user_permission_list.js:44-233`) | `.value` holds the last validated value | state `get_value` |
| `get_input_value()` / `get_label_value()` | core: DynamicLink reads `cur_list.page.fields_dict[x].get_input_value()` | the raw text vs. the mapped value (title → name) | |
| Typed but invalid value, then blur | | `validate_link_and_fetch` clears it (no match) and alerts when filters are set | `v5.form_todo/invalid-value-on-blur` |
| Clearing (select all, delete, blur) | | the model becomes empty and the fetch targets are cleared | `v5.form_todo/clear-by-typing` |
| Select: a value not among the options | | `set_formatted_input` writes the first or selected option back to the model | `v5.form_todo/select-set_df_property-options` (`set_missing_option`) |
| Select options given as `[{label, value}]`, `"\nA\nB"`, or an array | 154 df literals with `options` | the label is shown and the value is stored | `v5.dialog/select-label-value`, `v5.standalone/make_control-select` |

## 4. df changes at runtime

| API | app sites on Link / Dynamic / Select | check |
|---|---:|---|
| `set_df_property(f, "options", list)`, then `refresh_field` | Select **46** | `v5.form_todo/select-set_df_property-options`, `v5.dialog/select-set_value-and-options` |
| `grid.update_docfield_property(f, "options", …)` | Select 20 | (grid Select options: not yet in the harness) |
| `set_df_property(f, "read_only", 1)` / `update_docfield_property(f, "read_only")` | Link 9 + 7, Select 4 + 1 | `*/read-only-display`, `v5.grid_workflow/grid-update_docfield_property-read_only` |
| `set_df_property(f, "label")` | Link 12, Dynamic Link 2 | |
| `set_df_property(f, "reqd" / "hidden" / "description")` | Link 6 / 4 / 3, Select 1 / 5 / 3 | |
| `set_df_property(f, "only_select", true)` | 1 (`email_account.js:203`) | `v5.dialog/only_select-and-df.filters` (via df) |
| `toggle_reqd` / `toggle_enable` / `toggle_display` | Link 27 / 13 / 3, Select 3 / 2 / 9 | |
| `df.onchange = fn` / `df.change`, `onchange` in df literals | 9 + 10 | the handler fires once per pick | `v5.dialog/link-pick` events `df:user.onchange`, `v5.standalone/only_input-search-pick` |
| `get_docfield(...).get_route_options_for_new_doc = fn` | **19** (ERPNext `stock_controller.js:29,38`, `serial_no_batch_selector.js:473`, `bom_creator/link_field.js:30`) | `v5.standalone` (df literal) |
| `df.get_options = fn` (Dynamic Link options from a function) | 9 (reports: `addresses_and_contacts.js:24`, `reserved_stock.js:86`) | |

## 5. The dropdown: what the user sees and picks

| behaviour | where it comes from | check |
|---|---|---|
| Focusing an empty input opens the list at once (search with `txt=""`) | `make_input` focus handler | `v5.form_todo/link-focus-opens-list` |
| Typing searches after a 500 ms debounce; the list keeps the server order (no client filter or sort) | `setup_awesomeplete` | `v5.form_todo/link-type-filters-list` |
| Each row shows the bold label (title or translated value) and a description line | `item()` | `rows` in every options observation |
| Trailing rows, in this order: filter description ("Filtered by: …", not pickable), **"Create a new {doctype}"** (if `can_create` and not `only_select`), custom `ControlLink.link_options(this)` rows, **"Advanced Search"** (desk only, not web forms) | `on_input` | `create_new`, `advanced_search`, `filtered_by` in every options observation |
| The first row is active (`autoFirst`); ArrowUp and ArrowDown move; Enter picks; Tab picks only if the input text matches the row; Escape closes and keeps the old value | Awesomplete options and `awesomplete-select` | `v5.form_todo/keyboard-arrows-escape`, `keyboard-arrow-enter-picks-second`, `link-enter-picks-first` |
| In a dialog, Escape closes the open list but not the dialog | `dialog.js:157-173` reads `.awesomplete input[aria-expanded='true']` | `v5.dialog/escape-closes-list-not-dialog` |
| In a grid row, the arrow keys move the list, not the row, while it is open | `grid_row.js:1250` reads `field.autocomplete_open` | `v5.grid_workflow/grid-arrow-keys-while-list-open` |
| "Create a new X": `frappe.route_options = df.get_route_options_for_new_doc(this)` plus `name_field` (the typed text); `frappe._from_link`; `make_quick_entry(doctype, cb)` sets the new name back | `new_doc()` | `v5.form_todo/create-new` (full form), `v5.dialog/create-new-quick-entry` (quick entry) |
| `control.new_doc = fn` override | `role.js:269` | |
| "Advanced Search" opens `frappe.ui.form.LinkSelector({doctype, target: this, txt})` | `open_advanced_search()`; app: `event.js:83` | `v5.form_todo/advanced-search` |
| The link button (arrow to open the doc) and the clear button show on hover or focus when there is a value; `allow_clearing_link_fields` | `show_link_and_clear_buttons` | structure `link_btn`, `btn_open`, `btn_clear` |
| Read-only mode shows a formatted link (an `<a href="/desk/<doctype>/<name>">` with the title) in `disp_area` | formatter | `*/read-only-display` (`disp_text`, `disp_href`) |

## 6. Handles apps hold (the jQuery and DOM tail)

| handle | app sites | what they do | check |
|---|---:|---|---|
| `control.$input` (jQuery, one `<input>`) | 1 frm + about 6 dialog + 24 make_control (compat §2.3) | `.on("input"/"focus"/"awesomplete-open")`, `.val()`, `.trigger("focus").trigger("select")`, `.get(0).getBoundingClientRect()`, `.attr("data-target")` | `api.$input`, `api.input_is_$input`, `api.data_target` |
| `control.input` (DOM element) | 2 | `.disabled =`, `.onclick =` | `api.input_el` |
| `control.awesomplete` | **10 app sites, plus 2 that define their own** | `.ul` (style: `position: fixed`, `min-width`), `.close()`, `.isOpened`, `.evaluate()` (setup wizard), `.list`. ERPNext bom_creator `link_field.js:43-77` and `design_view.js:159-167`; POS `pos_item_selector.js:299`; `setup_wizard.js:600` | `api.awesomplete*`, `v5.standalone/make_control-only_input` (`style_ok`) |
| `awesomplete-open` / `-close` / `-select` / `-selectcomplete` events on `$input` | 5 app, 26 core (`field_group.js:91` listens for `change awesomplete-selectcomplete` to fire `on_change`; `filter.js:550`; `multi_select_dialog.js:417`) | they fire in this order: open, then select, then selectcomplete, then close | `events` in every step (each step records the jQuery events fired on watched `$input`s) |
| `select-change` event on a Select `$input` (fired by the patched `$.fn.val`) | core `select.js` placeholder | | `events` |
| `$wrapper.find(".link-btn" / ".btn-open" / ".btn-clear")` | 8 (POS `pos_item_selector.js:312-331`, `barcode_scanner.js:290`, `serial_no_batch_selector.js:61`) | hide the open button; append their own clear button into `.link-btn` | structure `link_btn`, `btn_open`, `btn_clear` |
| `$(input).closest(".awesomplete").children("ul")` and delegated `.form-grid .link-field input` | 2 (`data_import.js:1818,1844`; core `import_preview.js:620`) | find the dropdown from the input | structure `awesomplete_div`, `link_field` |
| `.awesomplete > ul:not([hidden])` (is any list open?) | 1 (`shop_floor.js:779`) | | |
| `.awesomplete > [role="listbox"] > [role="option"]` CSS | 4 rules (`bom_creator/design_view.js:61-64`) | style the list | |
| `input[data-fieldname="x"]` / `select[data-fieldname="x"]` | 3 (`print.js:34-35`, `rq_job_list.js:19`) | read a value by selector | `api.data_fieldname` |
| `control.$input.find("option")` / `add_options` / `$.fn.add_options` | 9 (setup wizard: `get_input("timezone").empty().add_options(...)`) | rebuild a select's options by hand | `structure.select_el` |
| `frappe.ui.form.ControlLink.link_options = fn` (extra rows) | 0 app, 7 core | | |
| subclasses: `ControlDynamicLink`, `ControlTableMultiSelect` and `ControlLinkCombobox` all `extend frappe.ui.form.ControlLink` | 0 app, 3 core | they override `get_options`, `make_input`, `set_formatted_input` | `api.chain` |

## 7. Factories and contexts

| context | app sites | check |
|---|---:|---|
| Form fields (`frm.fields_dict.x`, `frm.get_field(x)`) | see §2 to §4 | `v5.form_todo`, `v5.form_user_titles`, `erp.sales_invoice`, `erp.stock_entry` |
| Grid rows (`grid_rows[i].on_grid_fields_dict.x`, `grid.get_field(x)`) | `get_query =` 43 (compat) | `v5.grid_workflow`, `erp.sales_invoice/items-grid-*`, `erp.stock_entry/items-grid-item` |
| `frappe.ui.Dialog` / FieldGroup fields | 474 Link and 154 Select df literals | `v5.dialog` |
| Quick Entry (`make_quick_entry`; a Link "Create a new" opens one) | 5 app, 18 core | `v5.quick_entry`, `v5.dialog/create-new-quick-entry` |
| `frappe.ui.form.make_control({df: {fieldtype: "Link"}})` standalone, often `only_input` | 11 Link + 5 Select (POS, shop floor, plant floor, bom_creator, party_overview, print) | `v5.standalone` |
| `page.add_field({fieldtype: "Link"})` | 11 (stock_balance, warehouse_capacity_summary, sales_funnel, permission_manager) | (page fields: not yet in the harness) |
| Web forms (`frappe.web_form.fields_dict.x`) | the `edit-profile` web form has a Language Link and a time_zone Select | `v5.web_form` |
| Report filters (Link / Dynamic Link `get_options`) | 9 `get_options` sites; filters are controls too | (not yet in the harness) |

## 8. Checks turned into harness steps (summary)

| # | contract item | flow / step |
|---|---|---|
| 1 | Keyboard search and pick (focus opens, type filters, Enter picks the first, arrows, Escape) | `v5.form_todo/link-focus-opens-list` … `keyboard-arrow-enter-picks-second` |
| 2 | `set_query`, `get_query =`, df `get_query`, df `filters`, grid `get_field().get_query` reach `search_link` | `set_query-filters`, `get_query-assign`, `v5.dialog/link-get_query-in-df`, `only_select-and-df.filters`, `v5.grid_workflow/grid-get_field-get_query`, `erp.*` |
| 3 | `fetch_from` fills the targets | `v5.form_todo/fetch_from`, `erp.stock_entry/type-pick-fetches-purpose`, `erp.sales_invoice/customer-type-pick` |
| 4 | Title display (the input shows the title, the model holds the name; also on set_value) | `v5.form_user_titles/*`, `v5.web_form/initial` |
| 5 | `set_value` from code, Promise, events | `set_value-from-code`, `control-set_value-get_value` |
| 6 | Read-only display link | `read-only-display` (form, SI), `grid-update_docfield_property-read_only` |
| 7 | "Create a new X" (full form route and quick entry), `get_route_options_for_new_doc`, `name_field` | `create-new`, `create-new-quick-entry` |
| 8 | "Advanced Search" → LinkSelector | `advanced-search` |
| 9 | Clearing, and an invalid value on blur | `clear-by-typing`, `invalid-value-on-blur` |
| 10 | Select option translation, label/value options, set_df_property options, missing value | `v5.translation/*`, `v5.dialog/select-*`, `select-set_df_property-options` |
| 11 | Dynamic Link takes its doctype from the other field (form and dialog) | `dynamic-link`, `dynamic-link-in-dialog` |
| 12 | Public surface: `$input`, `input`, `$wrapper`, `wrapper.fieldobj`, `disp_area`, `awesomplete{ul, close, list, isOpened}`, methods | `api` step in every flow, `v5.standalone/make_control-only_input` |
| 13 | Legacy markup apps reach into | `structure` (reported apart; it must hold for the selectors listed in §6) |
| 14 | Events on `$input` and form/df handlers | `events` on every step |
| 15 | No new console errors | `errors` on every step |

**Not yet in the harness:** `remember_last_selected_value`, `fetch_if_empty`, `page.add_field`, report filters, and grid Select `update_docfield_property("options")`. The POS and bom_creator reach-ins are covered only through the `standalone` flow's `awesomplete.ul` style and the structure counts.
