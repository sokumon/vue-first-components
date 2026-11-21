# Sweep: DOM reach-ins

## DOM reach-in census: frappe desk + ERPNext

**Method.** These are scripted counts from Python and grep. I made no edits.

- **Files scanned:** Frappe has 748 JS files (465 under public/js, plus doctype, page and report JS). ERPNext has 706 JS files. I also scanned 165 Frappe stylesheets and every ERPNext .scss and .css file.
- **Step 1, collect selectors.** I pulled every selector string passed to `$()`, `.find`, `.closest`, `.parents`, `.parent`, `.children`, `.siblings`, `.filter`, `.is`, `querySelector(All)` and delegated `.on(evt, sel)`. That gives 2,829 sites: 2,153 in Frappe and 676 in ERPNext.
- **Step 2, keep only desk classes.** I matched those selectors against the class names that the desk modules themselves render. The vocabulary is 941 classes taken from 147 files in form/, form/controls, grid, layout, ui/page, dialog and list. "Fout" below means a Frappe file outside the module that owns that DOM.
- **Step 3, read every line.** I read each ERPNext hit by hand. About 85% of the 676 raw ERPNext hits select into HTML that ERPNext builds itself (POS, shop floor, BOM creator and so on), so they are not desk reach-ins.

**Result.** 83 ERPNext lines in 42 files reach into DOM that Frappe builds. About 100 Frappe lines outside the owning modules do the same. ERPNext also has about 18 stylesheet rules that target Frappe structure.

### 0. ERPNext reach-ins by structure (83 lines, 42 files)
| Structure | Lines |
|---|---|
| Control internals | 30 |
| Grid | 14 |
| Form layout (section, column, message, footer) | 12 |
| Page chrome and body slots | 12 |
| Timeline | 8 |
| Dialog chrome | 4 |
| Form sidebar | 3 |

---

### A. Control DOM. Keep it exactly as it is.

This is the markup from base_input.js and link.js:

`div.frappe-control[data-fieldtype][data-fieldname] > div.form-group > (div.clearfix > label.control-label + span.help) + div.control-input-wrapper > (div.control-input > input.input-with-feedback.form-control[data-fieldname] | div.link-field > input + span.link-btn > a.btn-clear + a.btn-open) + div.control-value.like-disabled-input + div.help-box`

Two public properties expose it: `$input_wrapper` (which is `.control-input-wrapper`) and `$wrapper`.

| Selector / pattern | ERPNext | Frappe outside owner | Examples (file:line) | How it is used |
|---|---|---|---|---|
| `.control-input` / `.control-value` | 2 (telephony picks one of the two by read_only), 1 (POS) | 1 `.control-value` + 2 `.control-value a` | erpnext public/js/telephony.js:23; pos_item_selector.js:316; frappe core/doctype/file/file.js:51; ui/link_preview.js:36 | (c) `.append(button)`, `.html()`. Apps inject buttons into the input box and overwrite the read-only display. |
| `.link-btn`, `.btn-open`, `.btn-clear` | 6 | 0 | pos_item_selector.js:312, 324, 330, 331; serial_no_batch_selector.js:61; barcode_scanner.js:290 | (c) `.css("display","none")`, `.append(icon)`; the element is also stored and later rebound with `.on("click")` |
| `.control-label` (alone or with `label`), `.help-box`, `.form-group`, `.clearfix` | 9 | 3 (`.label-area`) | serial_batch_inline_editor.js:427-428 (`.hide()`, `.css({margin,min-height})`); item.js:624-625 and item_group.js:287 (`[data-fieldname=X] .control-label` then `.text()` with `.data("base-label")`); plant_floor.js:140, 159 (`.clearfix` hide); frappe roles_editor.js:63, side_panel.js:178 | (c) `hide`, `css`, `text` |
| `.form-control` | 3 | 5 | payments.js:21, 127 (`.click(select)`); frappe setup_wizard.js:192, 337 and slides.js:228, 335 (`.first().focus()`) | (c) focus, click |
| `.frappe-control` | 2 | 6 + 2 `.frappe-control[data-fieldname=...]` | erpnext setup_wizard.js:329 (`.css margin`); pos_payment.js:488 (`.length`); frappe communication.js:196 (moves `.frappe-control[data-fieldname=X]` into slots with `.append`); web_form.js:345, 354 (`:not(.hide-control)`); data_export.js:127; kanban_settings.bundle.js:352 | (c) css, re-parenting with append, visibility tests through the `.hide-control` class |
| `[data-fieldname=X]` on the control div or the input (global selector) | 9 lines in 5 files | 9 lines in 8 files | **shipment.js:71-74** `$("div[data-fieldname=pickup_address] > div > .clearfix").hide()`; **shareholder.js:46** `$("div[data-fieldname=contact_html] > .address-box").each(innerText)`; print.js:34-35 `$('input[data-fieldname="print_format"]').val()`; frappe find.js:7 `[data-fieldname=X] :input`; treeview.js:312 `.trigger("change")`; permission_manager.js:268, 486 | (d) global queries. They also depend on **exact child nesting** (`>`) of the HTML-field content, and on the `data-fieldname` attribute being on both the `div` and the `input` |
| `[data-fieldtype="MultiCheck"]`, `.checkbox input` | 1 | 2 | dialog_manager.js:548 `.each(read checked)`; frappe utils.js:1062; data_export.js:134 | (c) and (d) |
| `.awesomplete > ul`, `.input-with-feedback` | 2 | 3 | shop_floor.js:779 (global `.awesomplete > ul:not([hidden])` used as a "dropdown open?" guard); pos_item_details.js:451 (delegated click); frappe data_import.js:1818, import_preview.js:620 | (d) |
| `$wrapper.parent()` / `$input.parents(".modal-dialog")` | 3 | 2 (`.parent().parent()`) | party_overview.js:162, 175 (`.parent().hide()` and `.toggle()`); item.js:1563 | (c). These assume the control's parent is a real container element. |
| HTML-field `$wrapper` / `wrapper` used as a raw mount point | 33 lines in 21 files | about 32 lines in about 22 files | project.js:158 `.$wrapper.empty()`; bank_statement_import.js:301-557 `.html()`; chart_of_accounts_importer.js:27 `$(wrapper).html() != ""`; frappe version.js:21, web_form.js:180 | (b) and (c): `empty`, `html`, `append`, `on`, `hide`. The wrapper must be a real element, and `.empty()` must not remove anything the framework put there. |

**ERPNext stylesheets for controls (14 rules):**
- erpnext.scss:54 `.frappe-control[data-fieldname="result_html"]`
- erpnext.scss:609-618: 10 rules of the form `.frappe-control[data-fieldname="*address_display"] .ql-editor`
- point-of-sale.scss:13 `.frappe-control`, :18 `.form-group`, :1428 `.control-input-wrapper`, all under `.point-of-sale-app`

**Frappe stylesheets for controls:**

| Selector | Lines | Files |
|---|---|---|
| `.frappe-control` | 64 | 23 |
| `[data-fieldtype]` | 60 | 13 |
| `.form-group` | 31 | 19 |
| `.control-input` | 13 | 8 |
| `.control-label` | 12 | 7 |
| `.help-box` | 9 | 9 |
| `.control-value` | 9 | 4 |
| `.label-area` | 8 | 8 |
| `.like-disabled-input` | 7 | 7 |
| `.ql-editor` | 73 | 17 |

### B. Form layout DOM

Structure: `.form-layout > .form-message-container + (.form-tabs-list | .form-tab-content > .tab-pane) > .form-page > .form-section[data-fieldname](.card-section | .empty-section | .hide-border) > (.section-head(.collapsible) > .collapse-indicator) + .section-body > .form-column[data-fieldname] > form > .frappe-control`.

Related properties: `frm.form_wrapper`, `frm.layout.wrapper`, and `section.row.wrapper`, which is a legacy shim pointing at the section wrapper.

| Selector / pattern | ERPNext | Frappe outside owner | Examples | Use |
|---|---|---|---|---|
| `.closest(".form-section")` / `.closest(".form-column")` from a field wrapper | 4 | 1 (`.form-column`) | serial_batch_inline_editor.js:63 (`.toggle(show)`), :1445 (`.hide()`); crm_activities.js:78 (`.form-column` hide), :80 (`.form-section` hide); frappe data_import.js:782 | (d) and (c). Apps hide a whole section or column by walking up from a field. **The field must stay nested inside a section and a column.** |
| `.section-head(.collapsible)`, `.collapse-indicator` | 1 | 3 | item.js:145 (`wrapper.find(".section-head.collapsible")`, then a banner is rendered into it); frappe list_settings.js:44 (`.hide()`); data_import.js:431 (`.before($count)`), :1730 | (c) |
| `.section-body`, `.form-section > .section-body` | 0 | 4 | frappe security_settings.js:10 (`.prepend(alert)`); list_settings.js:45, manage_layouts_dialog.js:19 (`.css(padding)`); bootstrap-4-web.bundle.js:65 | (c) |
| Section wrapper class toggles (`hide-border`) and the `.row.wrapper` shim | 4 | 0 | purchase_order.js:286, 288 (`fields_dict.items_section.wrapper.addClass/removeClass("hide-border")`); sales_common.js:432, 445 (`$(fields_dict.packing_list.row.wrapper).toggle()`) | (c). The section `wrapper` and the legacy `.row.wrapper` must exist. |
| `.form-message` | 1 (global) | 3 | asset.js:239 `$(".form-message").text(...)`; frappe doctype.js:133, 137 and web_form.js:51 (`frm.form_wrapper.find(".form-message").hide/show/toggle`) | (d) and (c) |
| `.form-footer` | 2 | 0 | crm_activities.js:13, 16 (`form_wrapper.find(".form-footer")` used as an anchor to insert activities) | (d) |
| `.tab-pane`, `.form-tabs-list` | 0 | 4 | frappe doctype_layout.js:119 (`closest(".tab-pane")`); layout.js:641 and utils.js:431 (global `.form-tabs-list:visible` height) | (d) |
| `.user-action-row`, `.unit-price-items-note` | 2 | 0 | project.js:105 (`frm.web_link.closest(".user-action-row").remove()`); transaction.js:3544 (`frm.layout.wrapper.find(own note)`, then `.parent().remove()`) | (c) |

**ERPNext stylesheet:** erpnext.scss:362 `.form-section-heading`, under `body[data-route="pos"]`.

**Frappe stylesheets for layout:**

| Selector | Lines | Files |
|---|---|---|
| `.form-section` | 34 | 11 |
| `.section-body` | 26 | 10 |
| `.form-column` | 22 | 10 |
| `.section-head` | 16 | 10 |
| `.form-layout` | 7 | 4 |
| `.form-page` | 4 | 3 |
| `.form-tabs-list` | 3 | 3 |
| `.form-tabs` | 2 | 2 |
| `.std-form-layout` | 3 | 2 |

### C. Grid DOM

Structure: `grid.wrapper > .control-label + .grid-field > .grid-custom-buttons + .form-grid-container > .form-grid > (.grid-heading-row > .grid-row > .data-row > .row-check > input.grid-row-check) + .grid-body > .rows > .grid-row[data-name][data-idx] > .data-row.row > .row-check | .row-index.grid-static-col | .col.grid-static-col[data-fieldname][data-fieldtype] | .btn-open-row`.

When a row is open: `.grid-row-open > .grid-form-body`, where `.column-label` and `.frappe-control` live. Below the grid: `.grid-footer > .grid-buttons > [data-action=add_row | duplicate_rows | delete_rows]`.

| Selector / pattern | ERPNext | Frappe outside owner | Examples | Use |
|---|---|---|---|---|
| `grid.wrapper.find('.grid-row[data-name="cdn"]')`, then `.grid-form-body`, `.column-label`, `[data-fieldname] .control-label` | 8 | 0 | item.js:411, 414, 619; item_group.js:171, 174 (`.column-label.eq(1).text()`), :177, 182 (`.grid-form-body.prepend(html)`), :281 | (d) and (c). Apps inject HTML into the **open row form**, keyed by `data-name`. |
| `$(e.currentTarget).closest(".grid-row").attr("data-name")` | 2 | 2 | stock_reservation.js:97; sales_order.js:361; frappe kanban_settings.bundle.js:357; grid.js:271 | (d). The row name is read from the DOM attribute. |
| `.grid-row-check` (delegated click, or `.grid-heading-row .grid-row-check` to select all) | 2 | 2 | payment_reconciliation.js:262 (`grid.wrapper.on("click.pr_totals", ".grid-row-check")`); sales_order.js:1829 (`.click()` to select all); frappe installed_applications.js:65-66 (`.remove()`, `.replaceWith(icon)`) | (c) and (d) |
| `[data-action='duplicate_rows']` | 1 | 0 | master_production_schedule.js:11 (`.css("display","none")`) | (c) |
| `grid.wrapper > .control-label` | 1 | 0 | work_order.js:139 (`.find("> .control-label").text(label)`) | (c). Depends on a direct child of the grid wrapper. |
| `.grid-footer`, `.form-grid input`, `.form-grid .link-field input` | 0 | 4 | frappe recorder.js:30 (`toggleClass`); data_import.js:1841, 1844, 1852 (delegated awesomplete and focus handlers) | (c) and (d) |
| `grid_row.row` / `row.columns[f]` jQuery objects | 0 (`grid_rows[i].remove()` occurs 7 times, but that is the API) | 6 | customize_form.js:40-50 (`.row.addClass/removeClass("highlight")`, `.css`); recorder.js:73; system_health_report.js:86 (`$(row.columns[f]).toggleClass`); side_panel.js:682 | (c) |
| `.grid-row-open` (global) | 0 | 4 | frappe keyboard.js:99, 357; side_panel.js:436 | (d). Used as a modal-like guard. |

**ERPNext stylesheet:** project.scss `.budget-periods .row-check { display: none }`, where project.js:898 adds `budget-periods` to the field's $wrapper.

**Frappe stylesheets for the grid:**

| Selector | Lines | Files |
|---|---|---|
| `.grid-static-col` | 25 | 2 |
| `.grid-row` | 15 | 3 |
| `.data-row` | 13 | 6 |
| `.row-index` | 12 | 1 |
| `.form-grid` | 12 | 3 |
| `.row-check` | 8 | 1 |
| `.grid-body` | 8 | 4 |
| `.form-in-grid` | 7 | 4 |
| `.editable-row` | 6 | 2 |

### D. Page chrome and body slots

Structure (ui/page.html and container.js): `.page-container.content[data-page-route][id=page-X] > .page-head > .container > .page-head-content > .page-title > .title-area` and `.page-actions > .custom-actions + .standard-actions > .menu-btn-group + .primary-action`.

The body is `.container.page-body > .page-toolbar + .page-wrapper > .page-content > .layout-main > .layout-side-section + .layout-main-section-wrapper > .page-form + .layout-main-section`.

| Selector / pattern | ERPNext | Frappe outside owner | Examples | Use |
|---|---|---|---|---|
| `$(wrapper).find(".layout-main-section")` used as a mount point | 3 | 4 | pos_controller.js:3; manufacturing/page/shop_floor/shop_floor.js:11; visual_plant_floor.js:9; frappe workflow_builder.js:21; print_format_builder.js:33; workspace.js:119; shortcut.js:39 (global `[0].offsetWidth`) | (b) and (d). The app passes the element as a parent and renders into it. |
| `.layout-main`, `.layout-main-section-wrapper` | 4 | 9 | sales_funnel.js:11 (`.layout-main.addClass("row")`), :12 (`.layout-main-section-wrapper.addClass("col-md-12")`), :45 (mount); stock_analytics.js:8 (mount); frappe list_view.js:151, 157 (`.hide()` and `.show()`); attachments.js:189, 535; data_import.js:1090; image_view.js:62; file_view.js:21; dashboard_view.js:51 | (c) and (b) |
| `page.wrapper.find(".page-form")` | 2 | 1 | warehouse_capacity_summary.js:64; stock_balance.js:46 (`parent:` for ItemDashboard filters); frappe query_report.js:2471 | (b) mount |
| `.page-head`, `.page-head-content` | 1 | 9 | production_plan_visualizer.js:36 (`.css("border-bottom","none")`); frappe utils.js:430, common.js:141, date.js:327 (global height, offsets, getBoundingClientRect); mobile_nav.js:56 (`.page-head .page-back-button` delegated); workspace.js:1023; list_view.js:537; query_report.js:2469 | (c) and (d). The height and offset math depends on the head being a single sticky element. |
| `.page-actions:visible .primary-action`, `.page-content` | 0 | 4 | frappe find.js:3 (test helper); list_view.js:149 (`.page-content.append(skeleton)`); dashboard_view.js:36 | (d) |
| `.page-container[data-page-route=X] .layout-side-section` | 0 | 1 | frappe container.js:110 | (d) |
| `frm.page.*` DOM handles mutated directly | 4 (+2 `btn_primary`) | 13 | job_card.js:308-311 (`dashboard.find(".btn-primary")` and `.toggleClass("btn-primary")` on `frm.page.btn_primary`); bom_creator.js:27-28 (`frm.page.sidebar.toggle`, `wrapper.css("--page-max-width")`); cheque_print_template.js:76, 96 (`frm.page.wrapper.prop("inert")`); frappe attachments.js (6 add/removeClass on `frm.page.wrapper`); doctype_layout.js:6; web_form.js:930 | (c) |

**ERPNext stylesheets:** erpnext.scss:45 `#page-stock-balance .dashboard-list-item` (depends on the `#page-<name>` id), :82 `body[data-route="pos"]`, :437 `.page-actions`.

**Frappe stylesheets for page chrome:**

| Selector | Lines | Files |
|---|---|---|
| `.layout-main-section-wrapper` | 14 | 10 |
| `[data-route]` | 14 | 6 |
| `.layout-main-section` | 13 | 10 |
| `.page-head` | 10 | 7 |
| `.layout-side-section` | 10 | 6 |
| `.indicator-pill` | 10 | 4 |
| `.page-title` | 8 | 3 |
| `.layout-main` | 7 | 7 |
| `.page-form` | 6 | 5 |
| `.page-actions` | 4 | 4 |
| `[data-page-route]` | 3 | 2 |

Frappe also queries the app container globally with `$(".main-section")` 14 times.

### E. Form sidebar, timeline and dashboard

| Pattern | ERPNext | Frappe outside owner | Examples | Use |
|---|---|---|---|---|
| `frm.timeline.wrapper.find('.timeline-item[data-doctype="Communication"]')` → `.actions` | 5 | 0 | issue.js:88, 95-96 (`.prepend(btn)`), :99 (delegated click `.btn-split-issue`), :120 (`closest(".timeline-item").getAttribute("data-name")`), :137 (`.data()`) | (c) and (d) |
| Global `.timeline-actions .btn-default`, `.comment-box`, `.timeline-content .nav-link` | 3 | 0 | crm_activities.js:23, 25 (`.hide()`), :27 (`.tab("show")`) | (d) global |
| `frm.sidebar.sidebar.find(".sidebar-meta-details")`, `frm.sidebar.image_wrapper.find(".sidebar-image")` | 2 | 2 (`.form-sidebar-items`, `.liked-by`) | employee.js:147 (`insertAfter`); workstation.js:9 (`.attr("src")`); frappe tags.js:26; like.js:106 | (c) |
| `frm.dashboard.stats_area`, `stats_area_row`, `progress_area.body.find(".progress-bar")` | 4 | 2 | erpnext public/js/utils.js:282-313 (`.show`, `.addClass("flex")`, `.css`, `appendTo`); frappe background_task.js:47-48 | (b) and (c) |
| `$(frm.wrapper).find(".form-print-wrapper")` / `.print-letterhead` | 0 | 2 | frappe communication.js:1850-1851 | (d) |

### F. Dialog chrome (when it is reached from form code)

| Pattern | ERPNext | Examples |
|---|---|---|
| `dialog.header.find(".indicator").attr("class")` | 1 | call_popup.js:31 |
| `.modal-dialog` / `.modal:visible` | 3 | item.js:1563 (`$input.parents(".modal-dialog")`); timer.js:144; shop_floor.js:1336 |

Frappe itself has 37 lines of `dialog.$wrapper/body.find` and ERPNext has 22. Most of them target the dialog's own field HTML.

### G. The jQuery event bus on DOM wrappers. Real elements are required.

| Target | ERPNext | Frappe |
|---|---|---|
| `$(frm.wrapper).on(...)` | 10 listeners: `grid-row-render` (accounts.js:13), `dirty` (job_card.js:6), `refresh-fields` (pos_item_cart.js:1066), and 5 custom events in project.js:22-37 | `dirty`, `render_complete`, `grid-row-render`, `attachments_change`, `refresh-fields`. Triggers in grid_row.js:179, 312, grid.js:1012, layout.js:401, attachments.js:72, toolbar.js:951 (`attr data-state`), save.js:23 (`addClass validated-form`) |
| `$(wrapper)` / `$(page.wrapper)` `"show"` / `"hide"` | 0 | 16 listeners in 9 files (pageview.js:122-157, query_report.js:27, workspace.js:47, print.js:10-11, dashboard_view.js:40, 63, form.js:627) |
| `$(document)` | 3 × `app_ready` | 8 × `page-change`, plus `form-refresh`, `form-load`, `form-unload` |

### H. Frappe CSS classes that ERPNext writes into its own HTML (approximate)

| Class | Uses | Files |
|---|---|---|
| `indicator` | 17 | 12 |
| `indicator-pill` | 6 | 5 |
| `btn-default` | 22 | 9 |
| `form-control` | 11 | 6 |
| `text-muted` | 58 | 31 |

These are not reach-ins, but the port's CSS must keep styling these classes. Note that Frappe's own page status pill is now `es-badge page-indicator-pill`.

### What must stay verbatim, in priority order

1. **Control markup and `data-fieldname`.** The control nesting and attributes must stay: `.frappe-control[data-fieldname][data-fieldtype] > .form-group > .clearfix > .control-label` and `.control-input-wrapper > .control-input`, `.control-value`, `.help-box`, plus `.link-btn > .btn-open` and `.btn-clear`. `data-fieldname` currently appears on the control div, the input, `.form-section`, `.form-column`, the tab link and `.grid-static-col`.
2. **Grid row markup.** The grid row nesting and its `data-name` / `data-idx` attributes must stay, including `.grid-form-body`, `.column-label`, `.grid-row-check`, the `.grid-heading-row` check, `[data-action=duplicate_rows]` and `grid.wrapper > .control-label`.
3. **Field → column → section → tab nesting.** `.closest(".form-section")` and `.closest(".form-column")` must keep working, as must `section.wrapper`, `section.row.wrapper` and the `.section-head.collapsible` class.
4. **Page body slots.** `.layout-main`, `.layout-main-section-wrapper`, `.layout-main-section`, `.page-form` and `.page-head` must exist inside `page.wrapper` and remain real mount points.
5. **Timeline and sidebar hooks:** `.timeline-item[data-doctype][data-name] .actions`, `.comment-box`, `.timeline-actions`, `.sidebar-meta-details`, `.sidebar-image`, `.user-action-row`, `.form-footer`, `.form-message`.
6. **Real elements behind wrappers.** `frm.wrapper`, `page.wrapper` and every control's `$wrapper` must be real elements, because of the event bus (section G) and the HTML-field mounts.

**Nothing in ERPNext reaches into** these, so they are free to change: `.grid-static-col`, `.grid-body`, `.rows`, `.page-content`, `.standard-actions` / `.custom-actions` / `.menu-btn-group`, `.form-tabs-list`, `.form-page`, `.form-layout`, `.like-disabled-input`, `.row-index`, `.indicator-pill` on page chrome. Only Frappe-internal code uses them.

**Files:**
- Working data: /tmp/claude-1001/-home-claude-vue-first-components/313d7bfe-ea88-4553-bd60-dbabf7777d42/scratchpad/c/sel.json (all 2,829 selector sites), /tmp/claude-1001/-home-claude-vue-first-components/313d7bfe-ea88-4553-bd60-dbabf7777d42/scratchpad/c/res.json, /tmp/claude-1001/-home-claude-vue-first-components/313d7bfe-ea88-4553-bd60-dbabf7777d42/scratchpad/c/e_curated.txt, and the per-pattern lists in /tmp/claude-1001/-home-claude-vue-first-components/313d7bfe-ea88-4553-bd60-dbabf7777d42/scratchpad/c/p_{F,E}_*.txt.
- Scripts: /tmp/claude-1001/-home-claude-vue-first-components/313d7bfe-ea88-4553-bd60-dbabf7777d42/scratchpad/c/sel.py, /tmp/claude-1001/-home-claude-vue-first-components/313d7bfe-ea88-4553-bd60-dbabf7777d42/scratchpad/c/vocab.py and /tmp/claude-1001/-home-claude-vue-first-components/313d7bfe-ea88-4553-bd60-dbabf7777d42/scratchpad/c/an.py.

## Top risks

- Control DOM is a de facto API. ERPNext appends into `.control-input`, `.control-value` and `.link-btn`, and hides `.btn-open`, `.clearfix`, `.control-label`, `.help-box` and `.form-group`: 30 lines (telephony.js:23, pos_item_selector.js:312-331, barcode_scanner.js:290, serial_batch_inline_editor.js:427-428, plant_floor.js:140). Re-rendering a control with Vue would drop these injected nodes.
- Child-combinator selectors on `data-fieldname` (shipment.js:71-74 `div[data-fieldname=X] > div > .clearfix`, shareholder.js:46 `> .address-box`, work_order.js:139 `grid.wrapper > .control-label`) break if even one wrapper div is added or removed. ERPNext SCSS also styles `.frappe-control[data-fieldname=...] .ql-editor` (11 rules).
- Grid open-row injection: item.js and item_group.js find `.grid-row[data-name=cdn]`, then `.grid-form-body.prepend(html)` and `.column-label.eq(1).text()`. sales_order.js:1829 clicks `.grid-heading-row .grid-row-check` to select all. payment_reconciliation.js:262 delegates on `.grid-row-check`.
- Walking up from a field: `.closest('.form-section')` / `.closest('.form-column')` (serial_batch_inline_editor.js:63, 1445; crm_activities.js:78-80), plus `section.row.wrapper` (sales_common.js:432) and the `hide-border` class on `section.wrapper` (purchase_order.js:286). The field → column → section nesting must be kept.
- Page body slots used as mount points: `$(wrapper).find('.layout-main-section' | '.layout-main' | '.layout-main-section-wrapper' | '.page-form')` in 7 ERPNext pages (POS, shop_floor, visual_plant_floor, sales_funnel, stock_balance, warehouse_capacity_summary, stock_analytics) and 13 Frappe sites outside the page module. sales_funnel adds bootstrap `row` / `col-md-12` classes to them.
- Global document-wide selectors assume only one live form or page in the DOM: asset.js:239 `$('.form-message')`, print.js:34 `$('input[data-fieldname=print_format]')`, shipment and shareholder, crm_activities `$('.comment-box')` / `$('.timeline-actions')`. If the port keeps hidden form instances alive (keep-alive or caching), these will match stale nodes.
- A jQuery event bus runs on real wrapper elements: `$(frm.wrapper).on('dirty' | 'refresh-fields' | 'grid-row-render' | custom)` (10 listeners in ERPNext, project.js among them) and `$(page.wrapper).on('show' | 'hide')` (16 in Frappe). `frm.wrapper` and `page.wrapper` must stay DOM elements that the framework keeps triggering.
- HTML-field `$wrapper` is used as a raw mount: `.empty()` and `.html()` appear 33 times in 21 ERPNext files. A Vue-owned control element would be wiped, or would fight with these calls.
- Timeline and sidebar hooks: issue.js `frm.timeline.wrapper.find('.timeline-item[data-doctype=Communication]').find('.actions').prepend(...)` and `closest('.timeline-item').getAttribute('data-name')`; employee.js `.sidebar-meta-details` insertAfter; workstation.js `.sidebar-image` src; project.js `.user-action-row` remove.
- `frm.page.btn_primary` is mutated through `toggleClass('btn-primary')` (job_card.js:311), even though Frappe already moved its own primary action to `es-segmented-button` / `es-button`. Old bootstrap class names are still toggled on the new elements.
