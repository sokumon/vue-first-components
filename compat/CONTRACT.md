# Compatibility contract: Page and Form APIs

This contract lists what Frappe and ERPNext code actually uses from the legacy desk classes (`frappe.ui.Page`, `frappe.ui.form.Form` / `frm`, controls, grid, layout, dashboard, and the DOM they render). The Vue / Frappe UI port must keep these working. Anything not listed here can change.

The owner's rule is: **apps work as before without any change.** Every count below comes from four scripted sweeps over the source. The full sweep reports are in this folder:

| sweep | file | scope |
|---|---|---|
| Page API | [sweep-page.md](sweep-page.md) | every `*.page.<member>` access |
| Form API | [sweep-form.md](sweep-form.md) | `frm.*`, `frappe.ui.form.on` events, `frm.page/dashboard/layout`, selectors |
| Controls and grid | [sweep-controls-grid.md](sweep-controls-grid.md) | `fields_dict` / `get_field` on forms, dialogs and grids; `make_control`; property writes |
| DOM reach-ins | [sweep-dom.md](sweep-dom.md) | 2,829 selector sites matched against the 941 classes the desk modules render |

**Corpus.** The Frappe tree at `~/fb/frappe-bench/apps/frappe` (the in-progress port branch) and ERPNext at `~/fb/frappe-bench/apps/erpnext`, which has 706 JS files.

**Terms used throughout:**
- **App code** means Frappe JS outside `public/js` (doctype, page, report and website scripts) plus all of ERPNext. This is the code the rule protects.
- **Desk core** means Frappe `public/js`. It ships with the port and can be changed in lockstep with it.
- **Usage codes:**
  - (a) only called
  - (b) return value used through its own API
  - (c) return value changed with jQuery or the DOM
  - (d) DOM reached from outside by selector

**Limits of the counts:**
- The counts are regex-based.
- Aliases are followed only when they are obvious.
- Third-party apps are not in the corpus, so "unused" means unused in Frappe and ERPNext only.
- The sweeps scoped their files slightly differently, so the same API can carry two different counts. Where that happens, both are given.
- The scripts and raw outputs cited inside the sweep files were kept in a session scratchpad and may no longer exist. The tables in the sweep files are the durable record.

---

## 1. Summary: what apps depend on, in numbers

| surface | size of the dependency |
|---|---|
| **Page** | 653 member sites in total, 333 of them in app code. **74 of the 130 public members are used, and only 43 of those by app code.** 56 have no callers. |
| **Form (`frm`)** | `frm.doc` is read or written about 6,270 times in app code. The top methods are `set_value` 694, `trigger` 690, `set_query` 623, `add_custom_button` 580, `frm.events.x(frm)` 549, `fields_dict` 366, `set_df_property` 287 and `toggle_display` 132. |
| **Form events** | 672 `frappe.ui.form.on` calls in app code (244 Frappe, 428 ERPNext), using 20 distinct lifecycle keys plus fieldname and child-table keys. |
| **Open objects** | Apps put 158 distinct expando properties on `frm` across 354 sites. About 55 ERPNext sites put expando properties on the Page instance. |
| **Control handles** | 122 `frm` sites take a control's `$wrapper` or `wrapper` and mutate it. About 60 more do the same on dialogs. About 90% of these are HTML fields used as mount points. |
| **Grid** | `update_docfield_property` 72 `frm` sites; `get_query =` on grid fields 43; `set_column_disp` 10; `toggle_enable` 9; `grid_rows[i].remove()` 7. Property writes: `cannot_add_rows`, `editable_fields`, `grid_pagination.page_length`. |
| **`make_control`** | 35 standalone uses in app code (24 in ERPNext POS, shop floor and plant floor). They use `$input` and `$wrapper` with jQuery. |
| **DOM reach-ins (d)** | 83 ERPNext lines in 42 files reach into DOM that Frappe renders. Another 132 selector sites (42 Frappe, 90 ERPNext) target 65 framework class or `data-*` names. About 40 sites target page-chrome classes. About 18 ERPNext stylesheet rules target Frappe structure. |
| **jQuery event bus** | 10 ERPNext listeners on `$(frm.wrapper)` (`dirty`, `refresh-fields`, `grid-row-render`, plus custom events). 16 Frappe listeners for `show` / `hide` on page wrappers. |

**What the numbers mean for the design:**
- **Most app code uses the API correctly**, calling a method and ignoring the result (code (a)). Examples: `set_value`, `set_query`, `set_df_property`, `toggle_*`, `set_indicator`, `add_action_item`, `set_inner_btn_group_as_primary`, and the dashboard headline and progress methods. A Vue port can implement these however it likes.
- **A smaller but steady tail treats returned objects and wrappers as live jQuery or DOM nodes** (code (c)): about 300 sites across Page, Form, controls and grid.
- **A few dozen sites rely on exact markup** (code (d)).

The compat layer exists for that tail.

---

## 2. Tier 1: API members that must stay exactly as they are

Breaking any of these breaks app code. "Returns" is the type callers depend on. "Mutated with" lists the jQuery or DOM operations that callers perform on the returned object.

### 2.1 Page (`frappe.ui.Page`, `frm.page`, `listview.page`, `report.page`, page scripts)

Counts are app / desk-core.

**Methods**

| member | app / core sites | returns | mutated with / notes |
|---|---|---|---|
| `add_inner_button(label, fn, group)` | 45 / 8 | jQuery button | `.toggle(false)`; stored and later `.remove()`. `frm.add_custom_button` wraps it. |
| `set_inner_btn_group_as_primary(group)` | 27 / 0 (ERPNext only, 19 files) | nothing used | Depends on how groups render (dropdown store, primary styling). |
| `add_action_item(label, fn)` | 28 / 2 | nothing used | |
| `add_menu_item(label, fn, standard, shortcut)` | 29 / 32 | jQuery item | `.parent().addClass("hidden-xl")`, `.toggle()`, `.text()` |
| `set_primary_action(label, fn, icon)` | 24 / 10 | jQuery button | `.addClass("btn btn-primary")` (chart_of_accounts_importer.js:144), `.attr("title").tooltip()`, `.is`, `.prop` |
| `set_secondary_action` | 3 / 4 | jQuery button | `.addClass`, `.prop` |
| `set_indicator(label, color)` / `clear_indicator()` | 16+6 / 14 | nothing used | |
| `set_title(title)` / `set_title_sub` | 7 / 11 | nothing used | |
| `set_breadcrumbs` | 8 / 13 | nothing used | |
| `clear_primary_action`, `clear_secondary_action`, `clear_menu`, `clear_inner_toolbar`, `clear_icons`, `clear_custom_actions`, `clear_actions`, `remove_inner_button` | about 25 / about 30 | nothing used | |
| `add_field(df)` | 11 / 7 | **Control** | `get_value` 13, `set_value` 4, `$input`, `df`, `get_query =`, `set_input`, `on_change` |
| `add_button(label, fn)` | 9 / 7 | jQuery button | `.hide()`, `.toggle`, `.text`, `.remove` |
| `add_action_icon(icon, fn)` | 5 / 14 | jQuery button | `.remove()` (bom_creator.js:93-96), `.css`, `.addClass`, `.attr`; used as a Dropdown trigger |
| `add_custom_button_group(label)` → `add_custom_menu_item(parent, ...)` | 4 / 4 | group handle | The returned group is passed back as `parent` (financial_statements.js:358-376). |
| `add_actions_menu_item` | 4 / 2 | jQuery item | `.addClass` |
| `hide_icon_group` | 3 / 0 | | |
| `set_view`, `current_view_name`, `previous_view_name` | 5 / 2 | | sales_invoice.js:293; print.js:899-903 |
| `add_date`, `add_select` | 3 (sales_funnel) / 0 | Control | passed as an object property |
| `add_inner_message`, `add_divider_to_button_group` | 1 + 1 / 0 | | |

**Properties**

| member | app / core sites | returns | mutated with / notes |
|---|---|---|---|
| `fields_dict.<f>` | 16 / 17 | Control | `.get_value()` 8, `.get_query =` (opportunity_list.js:21), `$wrapper`, `df`, `set_value` |
| `main` | 12 / 25 | **jQuery** | `.on("click", sel)`, `.html()`, `.find()`, `.addClass`, `.closest(".layout-main-section-wrapper")`; passed as `parent:` |
| `body` | 9 / 0 | **jQuery** | `.find`, `.addClass("no-border")`; passed as `body:` / `parent:` |
| `wrapper` | 8 / 19 | **jQuery** (must be the real page element) | `.find(".page-form")`, `.addClass`, `.prop("inert")`, `.css("--page-max-width")`, `.is(":visible")`, `[0]` |
| `btn_primary` | 11 / 4 | **jQuery** | `.toggle`, `.hide`, `.trigger("click")`, `.toggleClass("btn-primary")`, `.is(":visible")`, `.get(0)`; passed as `frappe.call({btn})` and to `.dress()` |
| `btn_secondary` | 6 / 2 | **jQuery** | `.hide()` (×5, in the ledger list views), `.prop("disabled")`, `.addClass("hide")`, `.get(0).innerText =` (pos_controller.js:261) |
| `sidebar` | 7 / 5 | **jQuery** | `.toggle(false)`, `.remove()`, `.toggleClass`, `.addClass`, `.hide`, `.empty` |
| `$title_area` | 3 / 6 | jQuery | `.find().remove()`, `.prepend`, `.toggleClass` |
| `page_head` | 1 / 0 | jQuery | `.hide()` |
| expando properties | about 55 ERPNext | any | stock_balance.js, warehouse_capacity_summary.js: `page.item_field`, `page.item_dashboard`, `page.start` and others |

**Identity and lifecycle**

| contract | where it is used |
|---|---|
| `wrapper.page === page`; `cur_page.page.page` is the Page | ERPNext POS passes it as `page:` to `frappe.ui.keys` (7 sites); keyboard.js:57 `page.wrapper.is(":visible")`; alt_keyboard_shortcuts.js:94 `page.wrapper[0]` |
| `frappe.ui.make_app_page({parent, title, single_column, ...})` and `new frappe.ui.Page` | 25 + 1 creation sites. `$.extend(this, opts)` copies every option onto the instance. |
| `frappe.ui.pages[route]` registry, with `.single_column` readable | container.js:104 |
| `$(page.wrapper)` / `$(wrapper)` fires `"show"` and `"hide"` | 16 listeners (pageview.js, query_report.js, workspace.js, print.js, dashboard_view.js, form.js) |
| The Page object stays a plain, extensible object: not frozen, not a strict Proxy, not a reactive proxy that breaks identity | about 55 ERPNext expando sites; `set_action` uses the instance as a map key |

### 2.2 Form (`frm`)

**Model and events.** Implementation is free, but behaviour must match exactly.

| member | app sites | contract |
|---|---|---|
| `frm.doc` | about 6,270 | The same `locals` object. 173 app sites write `frm.doc.x = v` directly. `locals[dt][dn]` is read 324 times. |
| `frm.set_value(f, v)` / `set_value({..})` | 694 | Returns a Promise (`.then`, `await`, `return`: 14 sites). Fires the field event. |
| `frm.trigger(ev)` | 690 | Returns a Promise (`.then` 8, `return` 7). |
| `frm.events.<h>(frm)` | 549 | The handler map built from `frappe.ui.form.on`. Handlers call each other through it. |
| `frm.script_manager.trigger` / `.copy_from_first_row` / `.has_handlers` | 39 | `trigger` is awaited in some sites. |
| `frm.cscript.x(...)`; `frappe.ui.form.Controller` subclasses; `set_controller` | 49 / 27 / 26 | class-based controllers in ERPNext `public/js/controllers` |
| `frappe.ui.form.on(dt, {…})` and `on(dt, field, fn)` | 672 (44 use the 3-argument form) | Keys and app-site counts: `refresh` 312, `setup` 129, `onload` 84, `validate` 27, `<table>_add` 21, `<table>_remove` 19, `before_save` 11, `after_save` 11, `form_render` 8, `before_<table>_remove` 5, `onload_post_render` 4, `before_load` 3, `on_tab_change` 2, `before_submit` 2, `<table>_on_form_rendered` 2 (plus about 10 controller methods), and `after_delete`, `on_submit`, `timeline_refresh`, `before_cancel` 1 each. Fieldname keys: 838. |
| `frappe.model.set_value` | 322 | Fires field and child events. |
| `frappe.ui.form.trigger(dt, f)` | 4 | |
| `frm.call(method, args)` | 174 | Returns a Promise; `.then` 46, `return` 49, `await` 11. |
| `frm.save()` / `frm.reload_doc()` / `frm.refresh()` / `frm.refresh_field(s)` | 42 / 114 / 56 / 173 | `save` and `reload_doc` return Promises. |
| `is_new`, `is_dirty`, `dirty`, `has_perm`, `doctype`, `docname`, `meta`, `perm`, `get_docfield` | | Read. `get_docfield(...)` returns the **live** df object, and 17 ERPNext sites assign `.get_route_options_for_new_doc` on it. |
| `add_child(tbl)` | 49 | Returns the row doc, which is then written to (25 sites). |
| `clear_table`, `set_query` (2-argument and 3-argument forms, 397 / 226), `add_fetch`, `set_df_property` (3-argument 283, 6-argument 3), `toggle_display`/`reqd`/`enable` (an array of fields is accepted, 27), `set_intro(msg, color)`, `set_read_only`, `disable_save`/`enable_save`, `disable_form`, `set_indicator_formatter`, `scroll_to_field`, `get_selected`, `copy_doc`, `amend_doc`, `email_doc`, `rename_doc`, `savesubmit`, `savetrash` | (a) | |
| `get_active_tab()` | 12 | Returns a tab whose `.label` and `.df` are read. |
| App-set properties the framework reads | 68 | `custom_make_buttons` 21, `make_methods` 17, `ignore_doctypes_on_cancel_all` 22, `email_field` 8 |
| Expando properties on `frm` | 158 names, 354 sites | `frm` must stay open and mutable. |

**Toolbar buttons**

| member | app sites | returns | mutated with |
|---|---|---|---|
| `add_custom_button(label, fn, group)` | 580 (343 with a group, 23 with 4 arguments) | **jQuery button** | Passed as `frappe.call({btn})`, which calls `$(btn).prop("disabled")` (2 sites). `.attr`/`.removeAttr("aria-busy")` (1). Stored as `this.$x_btn` (3). |
| `remove_custom_button(label, group)`, `clear_custom_buttons()`, `change_custom_button_type(label, group, type)` | 5 / 4 / 10 | | `change_custom_button_type` is used in bank_clearance.js:40. |

**Page, dashboard, layout, timeline and sidebar handles reached through `frm`**

| member | app sites | returns | mutated with |
|---|---|---|---|
| `frm.page.btn_primary` / `btn_secondary` / `wrapper` / `sidebar` / `main` | 11 / 5 / 8 total | jQuery | See 2.1. Also `frm.page.add_action_icon(...)` stored, then `.remove()`. |
| `frm.dashboard.add_section(html, label)` | 4 | **jQuery** | used as an `appendTo` target (asset_maintenance.js:50, batch.js:115); `.on("click", ".invoice-link")` (opening_invoice_creation_tool.js:142) |
| `frm.dashboard.stats_area` / `stats_area_row` | 4 | jQuery | `.show`, `.addClass("flex")`, `.css("flex-wrap")`, `appendTo` (erpnext public/js/utils.js:282-313) |
| `frm.dashboard.progress_area.body` | 2 | jQuery | `.find(".progress-bar")` (background_task.js:47) |
| `frm.dashboard.set_headline`, `set_headline_alert`, `clear_headline`, `add_progress`, `show_progress`, `hide_progress`, `add_indicator`, `add_comment`, `clear_comment`, `show`, `hide`, `reset`, `refresh`, `render_graph` | about 90 | (a) | |
| `frm.layout.message` | 2 | jQuery | `.empty()` |
| `frm.layout.wrapper` | 3 | jQuery | `.find(...)` (transaction.js:3544) |
| `frm.layout.tabs[]` | 3 | tab objects | `.find(t => t.df.fieldname === x)?.set_active()` (project.js:33) |
| `frm.layout.show_message`, `refresh_dependency`, `refresh_sections`, `sections_dict` | about 10 | (a) / read | |
| `frm.timeline.wrapper` | 10 | jQuery | `.find(".timeline-item[data-doctype=Communication]")`, `.on`, `.data` (issue.js:88-137) |
| `frm.sidebar.add_user_action(label, fn)` | 3 | jQuery | `.attr("href"/"target")`, `.on("click")` |
| `frm.sidebar.sidebar`, `frm.sidebar.image_wrapper` | 3 | jQuery | `.find(".sidebar-meta-details")` with `insertAfter` (employee.js:147); `.find(".sidebar-image").attr("src")` (workstation.js:9) |
| `frm.wrapper` / `frm.$wrapper` / `frm.form_wrapper` | 21 / 2 / several | **DOM element / jQuery** | `$(frm.wrapper).on("dirty" \| "refresh-fields" \| "grid-row-render" \| custom)`; `.trigger(custom)`; `frm.wrapper.dispatchEvent` (project.js:115); `frm.$wrapper.find(".variants-intro")` (bom.js:427); `frm.$wrapper.on("click", sel)` (barcode_scanner.js:596) |
| `frm.web_link` | 1 | jQuery | `.closest(".user-action-row").remove()` (project.js:105) |

**Framework events that must keep firing on `frm.wrapper`.** These are jQuery events: `dirty`, `refresh-fields`, `grid-row-render(e, grid_row)`, `render_complete`, `attachments_change`, `validated-form` (class). On `document`: `form-refresh`, `form-load`, `form-unload`, `page-change`, `app_ready`.

**Classes apps construct or patch**

- `new frappe.ui.form.Form(dt, $("<div>"), false)` then `frm.refresh(name)`. This is a headless form (pos_controller.js:597).
- `frappe.ui.form.ControlData = class extends frappe.ui.form.ControlData { make_input(){…} }` (telephony.js:1). The override reads `this.$wrapper.find(".control-value"|".control-input")`, `field.disp_area.style` and `frm.fields_dict`.
- `class extends frappe.ui.form.QuickEntryForm` (item_quick_entry.js:3). `frappe.ui.form.make_quick_entry` has 5 sites.
- `frappe.ui.form.ControlBarcode.prototype.get_options.bind({df})` (print.js:833).
- So: `make_control` must look up `frappe.ui.form["Control" + fieldtype]` **when it runs**, and the hook methods (`make_input`, `make_wrapper`, `set_formatted_input` and others) must still be called.

### 2.3 Controls (`frm.fields_dict.x`, `frm.get_field(x)`, dialog and FieldGroup fields, `make_control`)

| member | sites (frm / dialog / make_control) | type | mutated with |
|---|---|---|---|
| `$wrapper` | 72 (+13 alias) / 59 / 31 | **jQuery, a persistent node** | `empty` (about 27), `html` (about 20), `append`, `on`, `find`, `hide`/`show`, `addClass`, `detach`, `before`, `closest`, `get(0)`. Passed as a mount to `new DataTable`, `frappe.ui.chart`, `frappe.utils.scroll_to`, `{wrapper: …}`, `{notes_wrapper: $(…)}`. |
| `wrapper` | 48 / 8 / 2 | **DOM element** for controls; **jQuery** for Section Break | `$(wrapper).empty()/.html()/.closest(".tab-pane"/".form-section"/".form-column")`. Section Break: `.addClass/.removeClass("hide-border")` (purchase_order.js:286,288), `.find(".section-head.collapsible")` (item.js:144). |
| `section.row.wrapper` | 2 | DOM / jQuery | `$(…).toggle()` (sales_common.js:432,445). This is a legacy shim. |
| `df` | 9 / 52 (+14 alias) / 8 (+15 POS) | **the live df object** | Writes: `df.data = / .push` (about 45, then `grid.refresh()`), `df.onchange =` 9, `read_only`, `hidden`, `options`, `reqd`, `label`, `ignore_validation`, `cannot_delete_rows`. |
| `get_query =` | 20 / 7 / POS | function-valued property | Read by the Link control when a search runs. |
| `disp_area` | 7 | **DOM element** | `.innerHTML =` (6 writes); `.style` read (telephony.js); `$(disp_area).toggleClass` |
| `input` | 2 | **DOM element** | `.disabled =` (bom_update_tool.js:31); `.onclick =` (sms_manager.js:91) |
| `$input` | 1 / 6 / 24 | jQuery | `.on` (9), `.val`, `.prop`, `.trigger("focus")`, `.attr("autocomplete")`, `.addClass`, `.one`, `.parents(".modal-dialog")` |
| `html(content)` | 7 | (a) | HTML control |
| `set_data`, `get_value`, `set_value`, `set_input`, `refresh`, `refresh_input`, `set_focus`, `toggle_label`, `toggle_description`, `toggle`, `set_label`, `set_description`, `get_checked_options`, `get_unchecked_options`, `setup_select_all` | a few to 34 each | (a) / (b) | `set_value` returns a Promise. |
| `value =` | 1 | property write | item_dashboard.js:266 |
| `new_doc =` | 1 | method override | role.js:269 |
| `datepicker`, `map`, `awesomplete` | 3 / 3 / 3 | third-party instances | air-datepicker; Leaflet `getCenter`/`setView`; `awesomplete.ul` / `.close()` |
| `tab.set_active()`, `collapse()`, `section.collapse()` | 3 / 4 | (a) | |
| `parent` | 5 | jQuery | `.attr`, `.is` |

### 2.4 Grid (`frm.fields_dict.<table>.grid`, `dialog.fields_dict.<t>.grid`)

| member | app sites | type | notes |
|---|---|---|---|
| `update_docfield_property(f, prop, v)` | 72 | (a) | ERPNext `toggle_serial_batch_fields` and others |
| `get_field(f).get_query =` | 43 | property write | |
| `refresh()` | 27 (+6 alias) | (a), and **overridden on the instance** | `grid.refresh = () => {…}` (data_import.js:1761) |
| `set_column_disp(f, show)`, `set_column_disp_in_list_view` | 15 + 2 | (a) | |
| `toggle_enable`, `toggle_reqd` | 10 / 5 | (a) | |
| `get_selected_children()`, `get_selected()` | 14 + dialog 11 | (b) array | |
| `grid_rows[i]` | 8 | GridRow | `.remove()` (7, in shipment, payment_entry, request_for_quotation); `forEach(row => $(row.columns[f]).css/.toggleClass)` |
| `grid_rows_by_docname[cdn]` | 4 (+4 dialog) | GridRow | `.doc`; `.grid_form.fields_dict[f].wrapper` used as an `appendTo` target (recorder.js:107) |
| `add_new_row()` | 2 | (b) | returns the row doc (journal_entry.js:413) |
| `reset_grid`, `set_multiple_add`, `only_sortable`, `refresh_row`, `get_row(cdn)`, `get_data`, `set_value`, `fields_map.x`, `add_custom_button(label, fn, "top")` | 1 to 6 each | | |
| `cannot_add_rows =`, `editable_fields =`, `grid_pagination.page_length =`, `df.cannot_delete_rows =` | 4 / 2 / 2 / 1 | property writes | Must take effect on the next refresh. |
| `wrapper` | 11 | **jQuery** | `.find('.grid-row[data-name="…"]')` (6), `.find("> .control-label").text()`, `.on("click.ns", ".grid-row-check")`, `.off` |
| `grid_buttons` | 1 | jQuery | `.hide()` |
| GridRow: `doc`, `grid_form.fields_dict`, `on_grid_fields_dict.x.get_value/set_value`, `refresh_field`, `row` (jQuery: `addClass`/`removeClass`/`hasClass`/`css`), `columns[f]` (`.df`, `.field`, `.field_area.empty()`), `get_field(f).$wrapper`, `make_control`, `select`, `refresh_check`, `$grid_row.find` | about 40 | | customize_form.js:40-50; bom_creator.js:251; item.js; item_group.js |
| Events | | | `form_render` (11); `<table>_on_form_rendered(doc, grid_row)` controller hook (about 10, fired at grid_row.js:1450); jQuery `grid-row-render` on `frm.wrapper`; `<table>_add`, `_remove`, `before_<table>_remove`, `_move` |

---

## 3. Tier 2: DOM structure that is reached into (keep class names and nesting verbatim)

These selectors are written in app code. If the port renames a class or adds or removes a wrapper level, the selector **silently matches nothing** and no error is raised. Counts are app sites ("F" for Frappe app code outside the owning module, "E" for ERPNext).

### 3.1 Control markup (base_input.js, link.js)

```
div.frappe-control[data-fieldtype][data-fieldname]          (.hide-control when hidden)
  > div.form-group
      > div.clearfix > label.control-label + span.help
      > div.control-input-wrapper
          > div.control-input > input.input-with-feedback.form-control[data-fieldname]
              | div.link-field.awesomplete > input + span.link-btn > a.btn-clear + a.btn-open
          > div.control-value.like-disabled-input           (= disp_area)
          > div.help-box
```

| selector | E | F | examples | use |
|---|---|---|---|---|
| `.control-input`, `.control-value` | 3 | 3 | telephony.js:23; pos_item_selector.js:316; file.js:51 | `.append(button)`, `.html()` |
| `.link-btn`, `.btn-open`, `.btn-clear` | 6 | 0 | pos_item_selector.js:312-331; serial_no_batch_selector.js:61; barcode_scanner.js:290 | `.css("display","none")`, `.append(icon)`, `.on("click")` |
| `.control-label`, `.help-box`, `.form-group`, `.clearfix`, `label` | 9 | 3 | serial_batch_inline_editor.js:427-428; item.js:624-625 and item_group.js:287 (`[data-fieldname=X] .control-label` with `.text()` and `.data("base-label")`); plant_floor.js:140,159 | `hide`, `css`, `text` |
| `div[data-fieldname=X] > div > .clearfix` (**child combinators**) | 4 | | shipment.js:71-74 | `hide` |
| `div[data-fieldname=X] > .address-box` | 1 | | shareholder.js:46 | reads `innerText` (content of the HTML field) |
| `input[data-fieldname=X]` (global) | 2 | 3 | print.js:34-35 `.val()`; find.js:7; treeview.js:312 `.trigger("change")` | `data-fieldname` must be on **both** the div and the input |
| `.frappe-control`, `.frappe-control[data-fieldname=X]`, `:not(.hide-control)` | 2 | 8 | setup_wizard.js:329; pos_payment.js:488; communication.js:196 (re-parents the control) | `css`, `append`, `length` |
| `.form-control` | 3 | 5 | payments.js:21,127; setup_wizard.js:192 | `focus`, `click` |
| `.awesomplete > ul:not([hidden])`, `.input-with-feedback` | 2 | 3 | shop_floor.js:779 (global "dropdown open?" guard); pos_item_details.js:451 | |
| `[data-fieldtype="MultiCheck"]`, `.checkbox input` | 1 | 2 | dialog_manager.js:548 | reads `checked` |
| `$wrapper.parent()` / `.parent().parent()` | 3 | 2 | party_overview.js:162,175 | `hide`, `toggle`; the parent must be a real container |
| ERPNext SCSS | 14 rules | | erpnext.scss:54, 609-618 `.frappe-control[data-fieldname="*address_display"] .ql-editor`; point-of-sale.scss:13,18,1428 | |

### 3.2 Form layout

```
.form-layout > .form-message-container(.form-message)
             > .form-tabs-list | .form-tab-content > .tab-pane
             > .form-page > .form-section[data-fieldname](.hide-border|.card-section|.empty-section)
                  > .section-head(.collapsible) > .collapse-indicator
                  > .section-body > .form-column[data-fieldname] > form > .frappe-control
.form-footer
```

| selector / contract | E | F | examples |
|---|---|---|---|
| `field.$wrapper.closest(".form-section" \| ".form-column")` (**the field must stay nested inside a column, which is inside a section**) | 4 | 1 | serial_batch_inline_editor.js:63,1445; crm_activities.js:78,80; data_import.js:782 |
| Section wrapper with the `hide-border` class; `section.row.wrapper` | 4 | 0 | purchase_order.js:286,288; sales_common.js:432,445 |
| `.section-head.collapsible`, `.collapse-indicator`, `.section-body` | 1 | 7 | item.js:145; security_settings.js:10 (`.prepend`); list_settings.js:44-45 |
| `.form-message` (global and through `form_wrapper`) | 1 | 3 | asset.js:239 (global `.text()`); doctype.js:133,137; web_form.js:51 |
| `.form-footer` | 2 | 0 | crm_activities.js:13,16 (insertion anchor) |
| `.tab-pane` | 0 | 1 | doctype_layout.js:119 |
| `.user-action-row`, `.unit-price-items-note` | 2 | 0 | project.js:105; transaction.js:3544 |
| `.layout-main-section-wrapper` (from a form) | 0 | 1 | data_import.js:1090 |

### 3.3 Grid

```
grid.wrapper > .control-label                                        (direct child)
             + .grid-field > .grid-custom-buttons + .form-grid-container > .form-grid
                  > .grid-heading-row > .grid-row > .data-row > .row-check > input.grid-row-check
                  > .grid-body > .rows > .grid-row[data-name][data-idx]
                        > .data-row.row > .row-check | .row-index | .col[data-fieldname][data-fieldtype] | .btn-open-row
                        (open:) .grid-row-open > .grid-form-body > .column-label, .frappe-control
             > .grid-footer > .grid-buttons > [data-action=add_row|duplicate_rows|delete_rows]
```

| selector | E | F | examples | use |
|---|---|---|---|---|
| `grid.wrapper.find('.grid-row[data-name="cdn"]')` then `.grid-form-body`, `.column-label`, `[data-fieldname] .control-label` | 8 | 0 | item.js:411,414,619; item_group.js:171-182,281 | `.grid-form-body.prepend(html)`, `.column-label.eq(1).text()` |
| `.closest(".grid-row").attr("data-name")` | 2 | 2 | sales_order.js:361; stock_reservation.js:97 | reads the row name from the DOM |
| `.grid-row-check`, `.grid-heading-row .grid-row-check` | 2 | 2 | payment_reconciliation.js:262 (delegated); sales_order.js:1829 (`.click()` to select all); installed_applications.js:65-66 | |
| `[data-action='duplicate_rows']` | 1 | 0 | master_production_schedule.js:11 | `.css("display","none")` |
| `grid.wrapper > .control-label` | 1 | 0 | work_order.js:139 | `.text(label)` |
| `.grid-footer`; `.form-grid input`; `.form-grid .link-field input`; `.form-in-grid` | 0 | 5 | recorder.js:30; data_import.js:1841-1852 | `toggleClass`; delegated awesomplete and focus handlers |
| `.grid-row-open` (global) | 0 | 4 | keyboard.js:99,357; side_panel.js:436 | modal-like guard |
| ERPNext SCSS `.budget-periods .row-check` | 1 | | project.scss | |

### 3.4 Page chrome and body slots

```
.page-container.content[data-page-route][id=page-<name>]
  > .page-head > .container > .page-head-content > .page-title > .title-area
                                                  > .page-actions > .custom-actions + .standard-actions > .menu-btn-group + .primary-action
  > .container.page-body > .page-toolbar + .page-wrapper > .page-content > .layout-main
        > .layout-side-section + .layout-main-section-wrapper > .page-form + .layout-main-section
```

| selector | E | F | examples | use |
|---|---|---|---|---|
| `.layout-main-section` | 3 | 4 | pos_controller.js:3; shop_floor.js:11; visual_plant_floor.js:9; workflow_builder.js:21; print_format_builder.js:33; shortcut.js:39 | mount point; `[0].offsetWidth` |
| `.layout-main`, `.layout-main-section-wrapper` | 4 | 9 | sales_funnel.js:11-12 (`addClass("row")`, `addClass("col-md-12")`), :45; stock_analytics.js:8; list_view.js:151,157; file_view.js:21; image_view.js:62; dashboard_view.js:51 | mount point; `addClass`; `hide`/`show` |
| `.page-form` | 2 | 1 | stock_balance.js:46; warehouse_capacity_summary.js:64 (`parent:` for SortSelector) | mount point |
| `.page-head`, `.page-head-content` | 1 | 9 | production_plan_visualizer.js:36 (`.css`); utils.js:430, common.js:141, date.js:327, layout.js:641 (global height and rect math); mobile_nav.js:56 (`.page-head .page-back-button`) | `.page-head` must stay **a single sticky element** |
| `.layout-side-section`, `.page-container[data-page-route]` | 0 | 1 | container.js:110 | |
| `.page-actions:visible .primary-action`, `.standard-actions .primary-action` | 0 | 2 | find.js:3 (test helper); form_tour.js:288 | |
| `#page-<name>`, `body[data-route]`, `.page-actions` (SCSS) | 3 rules | | erpnext.scss:45,82,437 | |
| CSS-in-JS on the chrome | 4 | 1 | shop_floor.js:1645-1647; production_plan_visualizer.js:1315; doctype_layout.js:11-12 | |

### 3.5 Timeline, sidebar, dashboard and dialog

| selector | E | F | examples |
|---|---|---|---|
| `.timeline-item[data-doctype][data-name]` then `.actions` | 5 | 0 | issue.js:88-137 (`.prepend(btn)`, delegated click, `getAttribute("data-name")`, `.data()`) |
| `.timeline-actions .btn-default`, `.comment-box`, `.timeline-content .nav-link` (global) | 3 | 0 | crm_activities.js:23-27 |
| `.sidebar-meta-details`, `.sidebar-image`, `.form-sidebar-items`, `.liked-by` | 2 | 2 | employee.js:147; workstation.js:9; tags.js:26; like.js:106 |
| `.progress-bar` inside `progress_area.body` | 0 | 1 | background_task.js:47 |
| `.form-print-wrapper`, `.print-letterhead` | 0 | 2 | communication.js:1850 |
| `dialog.header .indicator`; `.modal-dialog`; `.modal:visible`; `$('.btn:contains(..)')` | 4+2 | | call_popup.js:31; item.js:1563; timer.js:144; shareholder.js:38 |

### 3.6 Global-selector hazard

Several app sites query the whole document and assume only one form or page is live: asset.js:239 `.form-message`, print.js:34, shipment.js:71-74, shareholder.js:46, crm_activities.js `.comment-box` / `.timeline-actions`, shortcut.js:39. Frappe already keeps hidden page containers in the DOM, so these sites already depend on the current visibility conventions. **A port must not keep extra hidden copies of form DOM** (for example through keep-alive caches or offscreen pre-render), because that would make these selectors match stale nodes.

---

## 4. Tier 3: used only inside Frappe's own code (change in lockstep with the port)

None of these has an app-code caller or app-code selector. The callers are in Frappe `public/js` and ship with the port.

- **Page members:**
  - Properties: `page_form` (20), `container` (7), `menu` (7), `standard_actions`, `custom_actions`, `page_actions`, `$sub_title_area`, `menu_btn_group`, `actions_dropdown`, `actions_sheet_title`, `custom_mobile_actions`, `filters`, `hide_dock`, `legacy_breadcrumbs`, `show_breadcrumbs`, `set_document_title`, `title`.
  - Methods: `get_breadcrumbs`, `render_breadcrumbs`, `clear_user_actions`, `clear_actions_menu`, `hide_menu`, `show_menu`, `hide_actions_menu`, `show_actions_menu`, `add_dropdown_item`, `add_divider`, `is_in_group_button_dropdown`, `change_inner_button_type`, `hide_form`, `show_form`, `clear_fields`.
  - Static: `frappe.ui.Page.title_action`.
  - Note that `$title_area` has 3 Frappe app sites (component_explorer, base_list), so it stays in Tier 1.
- **Form members:** `frm.toolbar`, `frm.attachments` (24 core sites), the internals of `frm.sidebar` other than the handles listed in 2.2, `frm.states`, `frm.fields` (read in 7 places; treat as Tier 1 read-only), and `layout.sections_dict` (5 FD reads, internal map).
- **Grid internals:** `df` (34), `frm` (21), `doctype`, `meta`, `is_editable`, `visible_columns`, `docfields` (2 FD reads), `data` (1 FD `grid.data.sort`), `setup_toolbar`, `refresh_remove_rows_button`.
- **DOM classes with no ERPNext reach-in:**
  - grid internals: `.grid-static-col`, `.grid-body`, `.rows`, `.row-index`, `.editable-row`
  - page chrome: `.page-content`, `.standard-actions`, `.custom-actions`, `.menu-btn-group`, `.actions-btn-group`, `.secondary-action`, `.primary-action-menu`, `.page-icon-group`, `.title-area`, `.page-indicator-pill`, `.page-toolbar`, `.page-wrapper`, `.page-body`
  - form layout: `.form-tabs-list`, `.form-page`, `.form-layout`, `.like-disabled-input`
  - Frappe-internal callers of these (list_view.js:149 `.page-content`, utils.js:431 `.form-tabs-list:visible`, find.js:3, form_tour.js:288, container.js:110) must be updated in the same change.
- **Frappe stylesheets** (hundreds of rules on `.frappe-control`, `[data-fieldtype]`, `.form-section`, `.grid-static-col` and others) also ship with the port. They are lockstep, not a contract. But keeping the Tier 2 markup keeps them working for free.

---

## 5. Unused or near-unused (can leave the compat surface)

**Page members with no callers in Frappe or ERPNext (56).** Keep them as one-line shims (or a logged no-op). Third-party apps may still call them, and a shim costs almost nothing:

- **Methods:** `add_check`, `add_data`, `add_label`, `add_break`, `add_view`, `add_help_button`, `add_dropdown_button`, `get_form_values`, `get_title_area`, `get_main_icon`, `get_empty_state`, `get_inner_group_button`, `get_or_add_inner_group_button`, `load_lib`, `show_icon_group`, `set_primary_action_options`, `set_action`, `clear_action_of`, `btn_disable_enable`, `restyle_field`, `prepare_shortcut_obj`, `build_dropdown_options`, `build_inner_group_options`, `clear_btn_group`, `destroy_group_dropdowns`, `clear_mobile_custom_groups`, `get_icon_label`, `make`, `setup_page`, `add_main_section`, `setup_awesomebar`.
- **Properties:** `indicator`, `footer`, `icon_group`, `inner_toolbar`, `actions`, `actions_btn_group`, `btn_primary_menu`, `buttons`, `views`, `current_view`, `breadcrumbs`, `$breadcrumbs`, `menu_dropdown`, `primary_action_dropdown`, `skip_link_to_main`, `hide_mobile_nav`.
- **Options never read back:** `icon`, `required_libs`, `make_page`, `card_layout`, `page_name`. They are still copied onto the instance by `$.extend`.

**Near-unused Form members (1 app site each):** `savesubmit`, `savetrash`, `refresh_header`, `validate_form_action`, `add_web_link`, `is_dialog`, `get_sum`, `get_title`, `set_dirty`, `amend_doc`, `rename_doc`, `copy_doc`, `email_doc`, `open_grid_row`. These must keep working, but each is a thin delegate.

**Dead or missing in core:**
- form/toolbar.js:321 calls `page.add_dropdown`, which does not exist. Its only caller, `get_dropdown_menu`, has no callers, so delete it.
- user_image.js:57 calls `frm.page.close_sidebar?.()`, an optional method Page does not define. Either define it or drop the call.

**Never constructed directly:** `new frappe.ui.form.ControlX(...)` has 0 sites. `make_control` is the only factory apps use. Subclassing is still in use (see 2.2).

---

## 6. Port checklists mapped to differential test scenarios

Each check names the real ERPNext or Frappe screen that exercises it. A differential test opens that screen on the legacy build and on the port, runs the named code path, and compares the observable result: DOM snapshot of the named selectors, visible buttons and their state, model values, and fired events. The v5 bench (`~/fb`, see `bench/README.md`) is the harness.

### 6.1 Page checklist

| # | check | scenario (file) | what to assert |
|---|---|---|---|
| P1 | `make_app_page` options are copied onto the instance; expando properties persist | **Stock Balance** page (erpnext/stock/page/stock_balance/stock_balance.js) | `page.item_field.get_value()` works after filtering; `page.item_dashboard` still set after refresh |
| P2 | `page.add_field` returns a Control (`get_value`, `set_value`, `$input`) | Stock Balance; **Permission Manager** (frappe/core/page/permission_manager/permission_manager.js:45,62) | changing the field fires `change`; `set_value` round-trips |
| P3 | `page.wrapper.find(".page-form")` is a real mount point | Stock Balance:46, **Warehouse Capacity Summary**:64 | SortSelector renders inside `.page-form` |
| P4 | `.layout-main-section` is a mount point | **Point of Sale** (pos_controller.js:3), **Shop Floor** (shop_floor.js:11), **Visual Plant Floor** (:9) | the app renders inside it; `offsetWidth > 0` |
| P5 | `.layout-main` / `.layout-main-section-wrapper` accept `addClass("row")` / `addClass("col-md-12")` | **Sales Funnel** (sales_funnel.js:11-12,45); `add_date` and `add_select` | classes stay after the page is shown again; chart renders |
| P6 | `.page-head` accepts `.css` and is a single sticky element | **Production Plan Visualizer** (:36) | `$(".page-head").length === 1` per visible page; `border-bottom` applied |
| P7 | Page identity: `cur_page.page.page`, `page.wrapper.is(":visible")`, `wrapper[0]` | POS keyboard shortcuts (pos_item_cart.js:267, pos_payment.js:449) | the shortcut fires only while POS is visible |
| P8 | `btn_secondary.get(0).innerText =` and `set_indicator` | POS (pos_controller.js:261,644) | label text changes; indicator shows |
| P9 | `add_inner_button(...).toggle(false)` and stored button `.remove()` | **Accounts Payable** report (accounts_payable.js:200); query_report.js:281 | the button is hidden until rows are selected |
| P10 | `listview.page.fields_dict.<f>.get_query =` | **Opportunity** list (opportunity_list.js:21-22) | the filter Link search uses the custom query |
| P11 | `page.fields_dict.<f>.get_value()` on a tree view | **Task** tree (task_tree.js:79) | value is read correctly |
| P12 | `add_action_item` | **Issue** list (issue_list.js:8); **Contact** list (contact_list.js:10) | the item appears in the Actions menu and runs |
| P13 | `set_inner_btn_group_as_primary(group)` | **Purchase Order** (purchase_order.js:341,430); **Request for Quotation** (:151) | the group dropdown has primary styling and its items work |
| P14 | `add_custom_button_group` → `add_custom_menu_item(parent)` | Financial statements reports (financial_statements.js:358-376), e.g. **Profit and Loss** | the menu items sit under the group |
| P15 | `set_primary_action(...).addClass("btn btn-primary")` | **Chart of Accounts Importer** (:121,144) | the class is applied and survives a refresh |
| P16 | `btn_primary.toggle/hide/toggleClass("btn-primary")`, passed as `frappe.call({btn})` | **Proforma Invoice** (:6); **Job Card** (job_card.js:308-311) | button disabled during the call; class toggle visible |
| P17 | `btn_secondary.hide()` | **GL Entry**, **Payment Ledger Entry**, **Stock Ledger Entry** list views (:6) | button hidden |
| P18 | `sidebar.toggle(false)`, `wrapper.css("--page-max-width")`, `add_action_icon(...).remove()` | **BOM Creator** (bom_creator.js:27-28,93-96) | sidebar hidden; width applied; icon removed |
| P19 | `page.wrapper.prop("inert")` | **Cheque Print Template** (:76,96) | `inert` toggles |
| P20 | `set_view` / `current_view_name` | **Sales Invoice** (sales_invoice.js:293); Print view (print.js:899) | switching views works |
| P21 | `page.body` as a mount point | **BOM Comparison Tool** (bom_comparison_tool.js:59); **Backups** (backups.js:44) | content renders inside it |
| P22 | `"show"` / `"hide"` events on the page wrapper | Query Report (query_report.js:27); Workspace (workspace.js:47) | the events fire on route change |
| P23 | `page.main.on("click", sel)`, `.html()`, `.find()` | **Warehouse Capacity Summary** (warehouse_capacity_summary.js:105); **Report Print** (report_print.js:95-100) | delegated click works |
| P24 | `sidebar.remove()` / `.toggleClass` | **Recorder** list (recorder_list.js:5); **Web Form** (web_form.js:930) | |

### 6.2 Form checklist

| # | check | scenario (file) | what to assert |
|---|---|---|---|
| F1 | Events fire in order: `setup` → `onload` → `refresh` → `onload_post_render`; `validate`, `before_save`, `after_save`, `before_submit`, `on_submit`, `before_cancel` | **Sales Invoice** (controllers/transaction.js); **Asset** (`before_submit`); **Payment Entry** (`before_cancel`); **Subcontracting Receipt** (`on_submit`); **Location** (`onload_post_render`) | compare the event trace with legacy |
| F2 | Field change events; `set_value` and `trigger` return Promises; `frm.events.x(frm)` | **Sales Invoice**, **Payment Entry** (payment_entry.js:1470), **Project** (project.js:738) | trace plus final `frm.doc` equal |
| F3 | Child-table events `_add`, `_remove`, `before_<t>_remove`; `form_render`; `<t>_on_form_rendered` | **Sales Invoice** items; **Asset Repair** (`_on_form_rendered`); **Item** (`form_render`); **Customize Form** (`before_fields_remove`) | |
| F4 | `set_query` (2-argument and 3-argument forms) and grid `get_field(f).get_query =` | **Sales Order**, **Purchase Order**, **Stock Entry** | the Link search payload is equal |
| F5 | `add_custom_button(label, fn, group)` returns a jQuery button; `remove_custom_button`; `change_custom_button_type`; `clear_custom_buttons` | **Sales Invoice** (:385); **Work Order** (:177); **Bank Clearance** (:40); **Website Theme** (:10) | buttons are grouped; the returned button `.prop("disabled")` works through `frappe.call({btn})` (Email Account :315) |
| F6 | `frm.page.set_inner_btn_group_as_primary` after `add_custom_button(.., "Create")` | **Purchase Order** | |
| F7 | `fields_dict.<html>.$wrapper` is a persistent mount: `empty()`, `html()`, `append()`, DataTable and chart inside it, still there after `refresh_field` and after a full `frm.refresh()` | **Project** (project.js:158); **Bank Statement Import** (:301-557); **Lead** notes (lead.js:225); **System Console** (system_console.js:76) | the injected node is still present after refresh |
| F8 | Section Break `.wrapper.addClass("hide-border")`; `section.row.wrapper` toggle | **Purchase Order** (:286,288); **Sales Order** / **Delivery Note** `packing_list` (sales_common.js:432) | |
| F9 | `.closest(".form-section"/".form-column")` from a field hides the section or column | the Serial and Batch inline editor inside **Stock Entry** / **Purchase Receipt** (serial_batch_inline_editor.js:63,1445); CRM activities on **Lead** / **Opportunity** (crm_activities.js:78-80) | |
| F10 | Control internals: `.control-input` / `.control-value` append (telephony subclass of `ControlData`); `.link-btn` / `.btn-open` / `.btn-clear` | any form with a Phone field (telephony.js); **POS** item selector (pos_item_selector.js:312-331); **Barcode scanner** dialog (:290) | the call button renders; link buttons are hidden |
| F11 | Child-combinator selectors | **Shipment** (shipment.js:71-74); **Shareholder** (shareholder.js:46) | `> div > .clearfix` still matches |
| F12 | `[data-fieldname=X] .control-label` text plus `.data("base-label")` | **Item** (item.js:624); **Item Group** (item_group.js:287) | |
| F13 | Grid open-row injection: `.grid-row[data-name]` → `.grid-form-body.prepend`, `.column-label.eq(1)` | **Item** (item.js:411-414,619); **Item Group** (:171-182) | the banner appears in the open row |
| F14 | Grid API: `update_docfield_property`, `set_column_disp`, `toggle_enable`, `toggle_reqd`, `set_multiple_add`, `reset_grid`, `cannot_add_rows =`, `editable_fields =` | **Stock Entry** (:822), **Opportunity** (:33), **Subcontracting Order** (:47), **Service Level Agreement** (:7) | |
| F15 | `grid_rows[i].remove()`, `grid_rows_by_docname[cdn].doc`, `get_selected_children`, `add_new_row` returns the doc | **Shipment** (:454), **Payment Entry** (:1346), **Sales Order** (:363), **Journal Entry** (:413) | |
| F16 | Grid DOM: select all through `.grid-heading-row .grid-row-check`; delegated `.grid-row-check`; `[data-action=duplicate_rows]` hidden; `grid.wrapper > .control-label` | **Sales Order** dialog (:1829); **Payment Reconciliation** (:262); **Master Production Schedule** (:11); **Work Order** (:139) | |
| F17 | Dialog Table: push to `df.data`, then `grid.refresh()`; `df.onchange =` | **Sales Order** dialogs (:771); Code List import (code_list_import.js:137); Item Dashboard (:254) | |
| F18 | `$(frm.wrapper)` events: `dirty`, `refresh-fields`, `grid-row-render`, custom triggers and `dispatchEvent` | **Job Card** (:6); POS cart (pos_item_cart.js:1065); erpnext controllers/accounts.js:13; **Customize Form** (:38); **Project** (:22-37,115) | the listener runs with the same arguments |
| F19 | Dashboard: `add_section` returns jQuery (`appendTo`, delegated `on`); `stats_area_row`; headline, progress, indicators | **Asset Maintenance** (:50); **Batch** (:115); **Opening Invoice Creation Tool** (:142); erpnext utils.js:282 (Customer / Supplier stats); **Background Task** (`progress_area.body`) | |
| F20 | `layout.tabs[].set_active()`, `layout.message.empty()`, `layout.wrapper.find(own)`, `get_active_tab()` | **Project** (:33); **Workflow** (:8); transaction.js:3544; party_overview.js:53 | |
| F21 | Timeline: `.timeline-item[data-doctype=Communication] .actions` prepend; `data-name` | **Issue** (issue.js:88-137) | the Split button appears and works |
| F22 | Sidebar handles | **Employee** (:147 `.sidebar-meta-details`); **Workstation** (:9 `.sidebar-image`); **Contact Us Settings** (`add_user_action` attr/on) | |
| F23 | `frm.web_link.closest(".user-action-row").remove()`; `.form-footer` anchor; global `.form-message` text | **Project** (:105); CRM activities; **Asset** (:239) | |
| F24 | Headless form `new frappe.ui.form.Form(dt, $("<div>"), false)` then `refresh(name)` | **POS** (pos_controller.js:597) | the model, events and `set_value` work with nothing on screen |
| F25 | Class patching: `ControlData` subclass, `QuickEntryForm` subclass, `ControlBarcode.prototype` borrowing | telephony (any form with a Phone field); **Item** quick entry (item_quick_entry.js:3); Print view (print.js:833) | |
| F26 | Raw DOM on controls: `disp_area.innerHTML =`, `input.disabled =`, `input.onclick =` | Custom Field (:82); Audit Trail (:123); **BOM Update Tool** (:31); SMS dialog (sms_manager.js:91) | the value survives until the next explicit refresh |
| F27 | `make_control` standalone: `$input.on/val/prop`, `$wrapper.find/addClass/detach`, `awesomplete.ul/close`, `set_focus`, `toggle_label` | **POS** (11 sites); **Shop Floor**; **Visual Plant Floor**; party_overview | |
| F28 | Framework reads app-set properties: `custom_make_buttons`, `make_methods`, `ignore_doctypes_on_cancel_all`, `email_field` | **Sales Order** (Create menu); **Sales Invoice** cancel; Communication from **Lead** | |
| F29 | `frm` and the page instance accept expando properties | data_import (`frm._import_preview_*`); BOM Creator (`frm.compare_button`) | no TypeError |

---

## 7. Implications for a simple, robust compat layer

### 7.1 The rule that keeps it simple

> **Vue renders the shell and the slots. Every handle the API hands out is a real element that Vue creates once and never replaces, never re-classes and never re-styles. Inside a handed-out element, jQuery owns the DOM. Vue does not.**

In practice, the compat objects (`Page`, `Form`, `Control`, `Grid`) stay plain classes. Their `$wrapper`, `wrapper`, `main`, `btn_primary` and similar fields are `$(templateRef)` captured once after mount. There is no Proxy, no freezing and no reactive wrapper on the objects apps hold.

### 7.2 Hazards that are specific to Vue (each one breaks a Tier 1 or Tier 2 contract)

1. **Vue's class patching overwrites external classes.** When a bound `:class` changes, Vue rewrites `className`. That drops `addClass("hide-border")`, `addClass("btn btn-primary")`, `addClass("row")` and `toggleClass("btn-primary")`. Handed-out elements need **static classes only**, or Vue must touch them only through `classList.add/remove` on the specific classes it owns.
2. **`v-show` and jQuery `.toggle()`, `.hide()` and `.show()` both write `style.display`.** Whichever runs last wins, and Vue re-applies its value on the next render. Every element that apps toggle (buttons, sidebar, sections, `.layout-main`) needs **a single owner** for visibility. The simplest choice is jQuery: the compat method sets the display style, and Vue never binds `v-show` on that element.
3. **`v-if`, `:key` changes and list re-ordering destroy elements.** Any stored handle then points at a detached node: `$x_btn`, `report.create_pe_btn`, `page.item_dashboard`, an HTML field's DataTable. Handed-out elements must be created once per Page or Form instance and survive refresh. This is the existing rule in `v5/` for adopted nodes.
4. **Vue-rendered children of a handed-out element are wiped by `.empty()` and `.html()`.** HTML-field `$wrapper` (about 27 `empty`, about 20 `html`), `layout.message.empty()`, `frm.dashboard` sections. These elements must **have no Vue-owned children**. Vue renders the host element and leaves its inner DOM to the app.
5. **Extra wrapper levels break child combinators** (`div[data-fieldname=X] > div > .clearfix`, `grid.wrapper > .control-label`) and `closest()` chains. Components that render Tier 2 markup must not add fragments or wrapper divs between the levels listed in section 3.
6. **Hidden cached instances (keep-alive) duplicate global selectors** (see 3.6). Keep the current model: one DOM per page container, with hidden containers marked as the legacy code expects.
7. **jQuery events need real elements and jQuery's own dispatch.** `$(frm.wrapper).trigger("dirty")` reaches only handlers bound with `$(el).on`. Vue `emit` does not. The compat layer must keep triggering through jQuery on `frm.wrapper` and `page.wrapper`.

### 7.3 Where Frappe UI components can own the DOM outright

These areas have no app reach-in (Tier 3 or unused), or apps reach them only through method calls whose results they ignore. A Frappe UI component can render them however it likes, as long as the methods keep their behaviour.

| area | why it is free | API to keep |
|---|---|---|
| Page title area internals, indicator pill, breadcrumbs, page icon group | no outside selectors; `set_title`, `set_indicator` and `set_breadcrumbs` are 100% (a) | methods only; keep a `$title_area` element for 3 app sites |
| Page Actions menu and Menu dropdown **contents** | `add_action_item` is (a); `add_menu_item` returns are used only for `.toggle` / `.text` / `.parent().addClass` | return a real per-item element (it can be the Frappe UI item's root) |
| Inner-button group dropdowns | apps call `set_inner_btn_group_as_primary` and `change_custom_button_type` and never select the markup | return a real element per button (for `.toggle` / `.remove` / `prop("disabled")`) |
| Form dashboard headline, progress, indicators, comments | about 90 (a) sites | methods only; `add_section` and `stats_area_row` must still return jQuery hosts |
| Form toolbar (`frm.toolbar`), form tabs bar (`.form-tabs-list`), `.form-page`, `.form-layout` | Tier 3 | `layout.tabs[].set_active()`, `get_active_tab()` |
| Grid body rendering (`.grid-body`, `.rows`, `.grid-static-col`, `.row-index`) | Tier 3 | **but** each row element must keep `.grid-row[data-name][data-idx]`, `.grid-row-check`, and an open-row `.grid-form-body` with `.column-label`, because item.js and sales_order.js reach in. In practice this means keeping the legacy grid in the first port step. |
| Dialog chrome other than `header .indicator` and `.modal-dialog` | 4 sites in total | keep those two |
| Form sidebar layout | only `.sidebar-meta-details`, `.sidebar-image`, `.form-sidebar-items`, `.liked-by` and `add_user_action` are reached | keep those hooks |

### 7.4 Where the layer must preserve legacy DOM and jQuery behaviour

| area | what to preserve | recommended approach |
|---|---|---|
| **Controls** (`frappe-control` markup, `$wrapper`, `$input`, `disp_area`, `input`, live `df`, `get_query`, `make_control`, subclassable `ControlX` classes with their hooks) | all of 2.3 and 3.1 | **Keep the legacy Control classes as they are** and host them in Vue as adopted nodes. Telephony's subclass, the POS `make_control` usage and 30 ERPNext control-internal reach-ins make a Vue re-implementation of controls the riskiest change on the list. A Frappe UI control can come later as an opt-in fieldtype. |
| **Grid** | 2.4 and 3.3 (row `data-name`, open-row form, heading check, `duplicate_rows` action, `> .control-label`, instance-overridable `refresh`) | Keep the legacy Grid in phase 1. If it is ported later, render the Tier 2 classes verbatim and keep `grid_rows[]` objects with `row` / `columns[f]` jQuery handles. |
| **Form layout skeleton** | the section → column → field nesting; `.form-section` / `.form-column` / `.section-head.collapsible` / `.section-body` classes; `[data-fieldname]` on sections and columns; `section.wrapper` as jQuery; the `row.wrapper` shim; `.form-message`; `.form-footer` | A Vue layout component may render it, but with static classes, no extra levels, and each control mounted as an adopted node. |
| **Page body slots** | `.page-head` (single, sticky), `.layout-main`, `.layout-side-section`, `.layout-main-section-wrapper`, `.page-form`, `.layout-main-section`, `#page-<name>`, `[data-page-route]` | The Vue Page template renders exactly this skeleton. `main`, `body`, `wrapper`, `sidebar`, `page_head` and `$title_area` are captured once with `$(ref)`. |
| **Handed-out buttons** | `btn_primary`, `btn_secondary`, and the returns of `add_inner_button`, `add_custom_button`, `set_primary_action`, `add_button` and `add_action_icon` | Each is a real `<button>` created once and handed out as jQuery. Frappe UI can style it through static classes. Vue does not bind its `class`, `style` or `disabled`. |
| **Objects** | Page and `frm` are plain, extensible, identity-stable objects; `wrapper.page === page`; `frappe.ui.pages[route]` | No reactive proxy on these objects. Vue reads state from a separate reactive store that the compat methods update. |
| **Events** | jQuery events on `frm.wrapper` and `page.wrapper`; `frappe.ui.form.on` handler map and order; `frm.events`; `script_manager.trigger` | Keep the legacy event plumbing unchanged. It has no DOM dependency. |
| **Timeline Communication items** | `.timeline-item[data-doctype][data-name] .actions`, `.timeline-actions`, `.comment-box` | Keep the markup if the timeline is ported. |

### 7.5 Suggested order (lowest risk first)

1. **Page chrome in Vue**: title, indicator, breadcrumbs, action and menu dropdowns, inner-button groups. Keep the body-slot skeleton and the hand-out-once buttons. This covers P1 to P24.
2. **Form shell in Vue**: toolbar, tabs bar, dashboard headline and progress, sidebar layout. Legacy layout, controls and grid stay, hosted as adopted nodes.
3. **Form layout skeleton in Vue**, using the verbatim classes and nesting from 3.2.
4. **Controls and grid last**, and only per fieldtype behind a flag. The differential tests F7 to F17, F25 and F27 are the gate.
