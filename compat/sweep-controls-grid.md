# Sweep: controls and grid

## Census: controls and grids reached from outside (Frappe and ERPNext)

**How this was counted.** Everything comes from Python regex over the JS files. No file was edited.

- **Segments**
  - **fw**: frappe `public/js`, the framework itself (465 files).
  - **fa**: frappe app JS outside `public/js` (doctype, page, report, website), 298 files. Built `public/studio/assets` files are excluded.
  - **ea**: ERPNext, 706 files, with no `dist/` or `node_modules`.
- **How the code reaches a control.** I counted every `X.fields_dict.<f>`, `X.fields_dict[<f>]` and `X.get_field(<f>)`, then grouped by who owns it:
  - **frm**: `frm`, `this.frm`, `cur_frm`
  - **dlg**: a Dialog or FieldGroup
  - **grid**: `grid.get_field`
- **Aliases.** When the code saves a control in a variable (`const f = frm.get_field(..)`), I followed that variable for the next 40 lines. These rows are marked "~alias".
- **"next"** is the jQuery or DOM method called straight after the member. It is reported per receiver over all segments.
- **Caveat.** One early pass put ERPNext `public/js` in the fw bucket. This was fixed for every table marked [exact]. Tables marked [pre-fix] have exact **fa** numbers, but their **ea** column leaves out ERPNext `public/js`, which was counted under fw.

### 0. Totals: who reaches into controls

| access | fw | fa | ea |
|---|---|---|---|
| `frm.fields_dict.x` (any member) | 20 | 91 | 275 |
| `frm.get_field(x)` | 5 | 66 | 68 |
| `dialog/fieldgroup.fields_dict.x` | 77 | 34 | 113 |
| `dialog.get_field(x)` | 37 | 11 | 28 |
| `grid.get_field(x)` | 4 | 0 | 43 |
| grid_row / grid_form `.fields_dict`, `.get_field` | 4 | 5 | 3 |
| other owners (`slide.form`, `me`, `this.layout`...) | 138 | 34 | 34 |

### 1. Form controls: `frm.fields_dict.x.*` and `frm.get_field(x).*` [exact]

Usage codes: (a) only called. (b) return value used through its own API. (c) return value changed with jQuery or the DOM. (d) DOM reached by selector from outside.

| member | fw | fa | ea | how used | examples |
|---|---|---|---|---|---|
| `.grid` | 3 | 34 (+1 alias) | 197 | (b): see §3. next = update_docfield_property 72, get_field 43, grid_rows 10, set_column_disp 10, toggle_enable 9, wrapper 7, set_multiple_add 6, get_selected_children 6, toggle_reqd 5, reset_grid 5, only_sortable 4, cannot_add_rows 3 | E:stock/doctype/stock_entry/stock_entry.js:822, E:crm/doctype/opportunity/opportunity.js:33 |
| `.$wrapper` | 1 | 43 (+13 alias) | 29 | (c): next = empty 18, html 10, on 3, hide, get, find, detach, before, closest, addClass. Often passed as a mount parent (`frappe.ui.chart(...$wrapper)`, `scroll_to($wrapper)`, `{wrapper: ...$wrapper.empty()}`) | F:printing/doctype/print_settings/print_settings.js:8, E:projects/doctype/project/project.js:158, E:accounts/doctype/bisect_accounting_statements/bisect_accounting_statements.js:50 |
| `.wrapper` (DOM) | 2 | 23 | 25 | (c) almost always as `$(…wrapper).empty()/.html()/.closest()`, or passed as `notes_wrapper: $(frm.fields_dict.notes_html.wrapper)`. On Section Break it is jQuery: `.wrapper.addClass/removeClass` (E:buying/doctype/purchase_order/purchase_order.js:286,288) and `.wrapper.find(".section-head.collapsible")` (E:stock/doctype/item/item.js:144-145) | E:crm/doctype/lead/lead.js:225, E:manufacturing/doctype/job_card/job_card.js:307, F:desk/doctype/dashboard_chart/dashboard_chart.js:304 |
| `.get_query` | 0 | 4 | 16 | assigned a function (property write, not a call) | F:website/doctype/portal_settings/portal_settings.js:6 |
| `.df` | 2 | 3 (+5 alias) | 6 | read or changed: `.df.options =`, `.df.read_only =`, `.df.ignore_validation =`, `.df.default` | F:flow/doctype/flow_provider/flow_provider.js:7 |
| `.set_data` | 0 | 5 (+2) | 3 | (a) on Autocomplete | |
| `.html()` | 0 | 6 (+3) | 1 | (a) on HTML control | |
| `.disp_area` | 0 | 7 (+1) | 0 | (c) `.disp_area.innerHTML = ...` (6 writes). `$(df.disp_area).toggleClass` | F:custom/doctype/custom_field/custom_field.js:82, F:core/doctype/audit_trail/audit_trail.js:123, F:desk/doctype/system_health_report/system_health_report.js |
| `.set_label` | 0 | 1 | 3 | (a) | |
| `.set_description` | 0 | 2 | 0 (+4 alias) | (a) | |
| `.tab` | 0 | 1 | 2 | `.tab.set_active()` | |
| `.datepicker` | 0 | 0 | 3 | (b) air-datepicker instance | |
| `.map` | 0 | 0 | 3 | (b) Leaflet: `getCenter`, `setView` | |
| `.collapse` / `.section.collapse` | 0 | 2 | 1 | (a) | |
| `.row.wrapper` | 0 | 0 | 2 | (c) | |
| `.toggle`, `.toggle_label`, `.toggle_description` | 0 | 1 each | 0 | (a) | |
| `.refresh` | 0 | 1 (+2) | 0 | (a) | |
| `.$input` | 0 | 1 | 0 | (c) | |
| `.input.disabled =` | 0 | 0 | 1 | (c) raw DOM write | E:manufacturing/doctype/bom_update_tool/bom_update_tool.js:31 |
| `.value`, `.get_precision`, `.hide`, `.$input_wrapper`, `.make_input`, `.parse`, `.format_for_input`, `.parse_validate_and_set_in_model`, `.set_language`, `.get_input_value`, `.change` | 0 | 0 to 1 each | 0 to 1 each | internals reached through an alias in frappe doctypes | |

`set_value`, `get_value` and `set_input` are almost never called on frm controls. Apps use `frm.set_value` instead. These methods show up only on dialog and make_control controls.

**Fieldtype behind each access.** This covers literal fieldnames looked up in the doctype JSON, frm only, fa plus ea, without ERPNext `public/js`.

| member | fieldtypes |
|---|---|
| `$wrapper` | HTML 60, Table 4, Small Text 1 |
| `wrapper` | HTML 37, Code 4, Section Break 4, JSON 2 |
| `html()` | HTML 7 |
| `disp_area` | HTML 6 |
| `get_query` | Link 15, Dynamic Link 4 |
| `set_data` | Autocomplete 8 |
| `df` | Attach 5, Select 2, Autocomplete 1 |
| `$input` | Password 1 |

In short, about 90% of wrapper reach-ins treat an HTML field as a mount point.

**The 15 places that reach the wrapper of a non-HTML field:**

| site | fieldtype | what it does |
|---|---|---|
| F:website/doctype/web_form/web_form.js:180,277 | JSON | `$(wrapper).empty()` |
| F:desk/doctype/dashboard_chart/dashboard_chart.js:304,438 | Code | `$(wrapper).empty()` |
| F:desk/doctype/number_card/number_card.js:201,329 | Code | `$(wrapper).empty()` |
| F:website/doctype/website_theme/website_theme.js:53 | Table | `$wrapper.hide()`, then `insertAfter` |
| F:workflow/doctype/workflow/workflow.js:230 | Table | `insertAfter($wrapper)` |
| F:core/doctype/data_import/data_import.js:360 | Table | `$wrapper.detach()` |
| E:manufacturing/doctype/master_production_schedule/master_production_schedule.js:11 | Table | `$wrapper.find("[data-action='duplicate_rows']").css(...)` |
| F:core/doctype/security_settings/security_settings.js:6 | Section Break | `.find(".section-body").prepend` |
| E:stock/doctype/item/item.js:144 | Section Break | |
| E:buying/doctype/purchase_order/purchase_order.js:286,288 | Section Break | |
| E:accounts/doctype/pos_closing_entry/pos_closing_entry.js:48 | Small Text | `scroll_to` |

### 2. Dialog and FieldGroup controls: `d.fields_dict.x.*` and `d.get_field(x).*` [exact]

| member | fw | fa | ea | how used |
|---|---|---|---|---|
| `.grid` | 16 | 2 | 42 (+6 alias) | (b): next = refresh 24 (+6), get_selected_children 11, grid_rows_by_docname 4, update_docfield_property 2, get_field 2, get_data 2, set_value, get_selected, grid_buttons.hide (E:manufacturing/doctype/work_order/work_order.js:543) |
| `.df` | 12 (+30 alias) | 1 (+1) | 39 (+13) | the live df object is changed: `.df.data` 35 (+10) (push rows, then `grid.refresh()`), `.df.onchange =` 9, `.df.hidden =` 3, `.df.read_only` 2, plus label, reqd, options, invalid. Examples: E:selling/doctype/sales_order/sales_order.js:771, E:edi/doctype/code_list/code_list_import.js:137, E:stock/dashboard/item_dashboard.js:254 |
| `.$wrapper` | 29 | 15 | 15 | (c): html 10, append 5, hide 2, empty 2, show, find("iframe"), before, on, addClass, get. Examples: E:buying/doctype/request_for_quotation/request_for_quotation.js:312-321, E:public/js/bank_reconciliation_tool/dialog_manager.js:158,165, F:printing/page/print_designer_migration/print_designer_migration.js:156 |
| `.wrapper` | 4 | 0 | 4 | (c)/(d) `$(wrapper).closest(".form-column" or ".form-section").hide()` (E:public/js/utils/crm_activities.js:78,80,95). Also passed to a datatable (E:public/js/utils/ledger_preview.js:79) |
| `.value` | 2 | 13 | 3 (+3) | read. Also `get_field("target").value = target` (E:stock/dashboard/item_dashboard.js:266) |
| `.refresh` | 5 (+3) | 0 | 8 (+3) | (a) |
| `.get_value` | 7 | 1 | 3 | (a) |
| `.set_value` | 1 | 0 | 7 | (a) |
| `.get_query` | 6 | 0 | 1 | assigned |
| `.set_input` | 2 | 3 | 2 | (a) |
| `.$input` | 2 | 2 | 2 | (c) trigger("focus"), val(), on(), attr("autocomplete") (F:email/doctype/email_account/email_account_list.js:164,178, F:desk/page/setup_wizard/setup_wizard.js:643) |
| `.input` | 1 | 0 | 2 | (c) `d.fields_dict.send.input.onclick = fn` (E:public/js/sms_manager.js:91) |
| MultiCheck `get_checked_options`, `setup_select_all`, `get_unchecked_options` | 0 | 5 | 0 | (a) |
| `.new_doc =` | 0 | 1 | 0 | method override (F:core/doctype/role/role.js:269) |
| `.set_focus` | 0 | 0 | 1 | (a) |

How dialogs get built:

| constructor | fw | fa | ea |
|---|---|---|---|
| `new frappe.ui.Dialog` | 99 | 37 | 123 |
| `frappe.prompt(` | 12 | 8 | 35 |
| `new frappe.ui.FieldGroup` | 6 | 6 | 2 |
| `extends frappe.ui.Dialog` | 3 | 1 | 0 |
| `extends frappe.ui.FieldGroup` | 2 | 0 | 0 |
| `new frappe.ui.form.MultiSelectDialog` | 0 | 0 | 1 (E:public/js/utils.js:1281) |
| `frappe.ui.form.make_quick_entry` | 10 | 0 | 5 |

Inside a dialog Table field, a df `onchange` reaches across rows with `this.grid_row.on_grid_fields_dict.<f>.get_value()` and `.set_value()` (in ERPNext utils `select_alternate_items`).

### 3. Grid API: `<...>.grid.*` from any owner [pre-fix: fa exact; ea leaves out ERPNext public/js, which is counted under fw]

| member | fw (+erp public) | fa | ea | how used | examples |
|---|---|---|---|---|---|
| `update_docfield_property` | 9 | 17 | 58 | (a) | ERPNext utils `toggle_serial_batch_fields` |
| `refresh` | 26 | 7 | 20 | (a). Also overridden: `grid.refresh = () => {…}` (F:core/doctype/data_import/data_import.js:1761) | |
| `get_field(x)` | 14 | 0 | 33 | then `.get_query =` (36 of 47) | |
| `grid_rows` | 29 | 3 | 5 | `grid_rows[i].remove()` ea 5 (E:stock/doctype/shipment/shipment.js:454, E:accounts/doctype/payment_entry/payment_entry.js:1346, E:buying/doctype/request_for_quotation/request_for_quotation.js:525). `grid_rows.forEach(row => $(row.columns[f]).css/toggleClass)` (F:core/doctype/recorder/recorder.js:71, F:desk/doctype/system_health_report/system_health_report.js:84) | |
| `grid_rows_by_docname[cdn]` | 6 | 3 | 1 | `.grid_form.fields_dict[f].wrapper` then appendTo (F:core/doctype/recorder/recorder.js:107). `.doc` (E:selling/doctype/sales_order/sales_order.js:363) | |
| `get_selected_children` | 3 | 0 | 14 | (b) | |
| `set_column_disp` | 2 | 0 | 15 | (a) | |
| `set_column_disp_in_list_view` | 0 | 0 | 2 | (a) | |
| `toggle_enable` | 4 | 0 | 10 | (a) | |
| `toggle_reqd` | 0 | 0 | 5 | (a) | |
| `wrapper` | 1 | 4 | 7 | (c)/(d): see §5 | |
| `add_new_row` | 8 | 0 | 2 | (b) returns a row doc (E:accounts/doctype/journal_entry/journal_entry.js:413) | |
| `reset_grid` | 4 | 0 | 3 | (a) | |
| `set_multiple_add` | 1 | 0 | 5 | (a) | |
| `cannot_add_rows =` | 1 | 1 | 3 | property write | E:subcontracting/doctype/subcontracting_order/subcontracting_order.js:47 |
| `df.cannot_delete_rows =` | 0 | 1 | 0 | property write | |
| `only_sortable()` | 0 | 3 | 1 | (a) | |
| `editable_fields =` | 0 | 0 | 2 | property write | E:support/doctype/service_level_agreement/service_level_agreement.js:7 |
| `grid_pagination.page_length =` | 4 | 3 | 0 | property write | F:core/doctype/recorder/recorder.js:13 |
| `docfields` | 8 | 2 | 0 | read | |
| `data` | 11 | 1 | 0 | `grid.data.sort(...)` (recorder) | |
| `get_data` | 5 | 0 | 1 | (b) | |
| `get_row(cdn)` | 3 | 0 | 1 | (b) | |
| `refresh_row` | 0 | 0 | 1 | (a) | |
| `set_value` | 2 | 0 | 2 | (a) | |
| `fields_map.x` | 1 | 0 | 2 | (b) | E:accounts/doctype/financial_report_template/financial_report_template.js:289 |
| `add_custom_button(label, fn, "top")` | 1 | 1 | 0 | (a), and in ERPNext public `this.grid.add_items_button = this.grid.add_custom_button(...)` | F:automation/doctype/assignment_rule/assignment_rule.js:46, F:core/doctype/recorder/recorder.js:33 |
| `grid_buttons.hide()` | 0 | 0 | 1 | (c) | |
| `setup_toolbar`, `refresh_remove_rows_button`, plus ad-hoc expando properties `_value_mapping_hooks`, `_value_mapping_scroll_handler` | 0 | 1 to 4 | 0 | internals and expando | data_import.js |

The rest (`df` 34, `frm` 21, `doctype` 13, `meta`, `is_editable`, `visible_columns`...) is used only inside the framework.

### 4. Grid rows and grid forms [pre-fix, same caveat]

| member | fw (+erp public) | fa | ea | notes |
|---|---|---|---|---|
| `grid_row.doc` | 12 | 9 | 3 | |
| `grid_row.grid_form` (`.fields_dict`) | 2 | 8 | 0 | |
| `$grid_row.find` (jQuery row) | 0 | 0 | 6 | item.js, item_group.js |
| `grid_row.on_grid_fields_dict` / `on_grid_fields` | 5 | 3 | 0 | plus ERPNext utils |
| `grid_row.refresh_field` | 3 | 0 | 1 | |
| `grid_row.row` (jQuery) | 0 | 4 | 0 | addClass, removeClass, hasClass, css (F:custom/doctype/customize_form/customize_form.js:40-50) |
| `grid_row.get_field(f).$wrapper` | 0 | 2 | 1 | E:accounts/doctype/financial_report_template/financial_report_template.js:68 |
| `grid_row.columns[f]` (with `.df`, `.field`, `.field_area.empty()`) | 1 | 3 | 0 | |
| `grid_row.make_control(column)` | 0 | 1 | 0 | |
| `grid_row.select`, `grid_row.refresh_check` | 0 | 0 | 1 each | E:manufacturing/doctype/bom_creator/bom_creator.js:251-252 |
| `grid_rows[i].toggle_view`, `.toggle_editable_row`, `.select`, `.show_form` | 1 to 4 | 0 | 0 | |

**Grid events apps depend on:**
- `form_render` in `frappe.ui.form.on(child)`: fw 2, fa 6, ea 3 (item, item_group, financial_report_template).
- `<table>_on_form_rendered(doc, grid_row)` controller methods: about 10 in ERPNext (sales_invoice, delivery_note, purchase_order, material_request, stock_entry, quotation, asset_repair). They are fired by grid_row.js:1450 through `script_manager.trigger(parentfield + "_on_form_rendered")`.
- jQuery event `$(frm.wrapper).on("grid-row-render", (e, grid_row) => …)` (F:custom/doctype/customize_form/customize_form.js:38).
- `<table>_add` / `_remove` / `_move` were not separately quantified in this pass.

### 5. DOM reached by selector from outside (string selectors in find, $, closest, querySelector) [pre-fix, same caveat]

| selector token | fw | fa (files) | ea (files) | app sites |
|---|---|---|---|---|
| `[data-fieldname=…]` | 12 | 4 (3) | 9 (5) | E:stock/doctype/shipment/shipment.js:71-74 `$("div[data-fieldname=pickup_address] > div > .clearfix").hide()`; E:accounts/doctype/shareholder/shareholder.js:46; E:public/js/print.js:34 `$('input[data-fieldname="print_format"]').val()`; E:stock/doctype/item/item.js:624; E:setup/doctype/item_group/item_group.js:287; F:core/page/permission_manager/permission_manager.js:268 |
| `.grid-row[data-name=cdn]` | 15 | 0 | 4 (3) | E:stock/doctype/item/item.js:411,619; `closest(".grid-row").attr("data-name")` in E:selling/doctype/sales_order/sales_order.js:361 and E:public/js/stock_reservation.js:97 |
| `.grid-form-body` | 2 | 0 | 2 | prepend banner (item.js:414, item_group.js:182) |
| `.column-label` | 0 | 0 | 1 | `.eq(1).text()` (item_group.js:174) |
| `.control-label` | 4 | 1 | 4 | `grid.wrapper.find("> .control-label").text(label)` (E:manufacturing/doctype/work_order/work_order.js:139); `$wrapper.find(".control-label, .help-box").hide()` (E:public/js/utils/serial_batch_inline_editor.js:427) |
| `.grid-row-check`, `.grid-heading-row` | 9 / 9 | 2 / 0 | 1 / 1 | `dialog.wrapper.find(".grid-heading-row .grid-row-check").click()` (E:selling/doctype/sales_order/sales_order.js:1829); F:core/doctype/installed_applications/installed_applications.js:65-66 remove and replaceWith |
| `.grid-footer` | 3 | 1 | 0 | toggleClass (F:core/doctype/recorder/recorder.js:30) |
| `.form-grid input`, `.link-field input`, `.form-in-grid`, `.awesomplete` | n/a | 4 | 1 | data_import delegated `on("awesomplete-open" / "input focus")` |
| `[data-action='duplicate_rows']` | n/a | 0 | 1 | `.css("display","none")` |
| `.form-section` / `.form-column` | 6 / 2 | 2 / 2 | 3 / 1 | `closest(...).hide()`/`toggle()` (E:public/js/utils/crm_activities.js, E:public/js/utils/serial_batch_inline_editor.js:63,1445) |
| `.section-head.collapsible`, `.section-body` | 3 / 6 | 1 / 2 | 1 / 0 | |
| `.frappe-control` | 13 | 2 | 2 | E:public/js/setup_wizard.js:329; E:selling/page/point_of_sale/pos_payment.js:488 |
| `.control-input`, `.link-btn`, `.btn-open`, `.btn-clear` | 7 / 7 / 3 / 1 | 0 | 1 / 4 / 1 / 1 | POS item selector (E:selling/page/point_of_sale/pos_item_selector.js:312-331); dialog `.link-btn` (E:public/js/utils/barcode_scanner.js:290, E:public/js/utils/serial_no_batch_selector.js:61) |
| `.control-value` / `.control-input` | n/a | 1 | 1 (telephony) | |
| `.form-control` | 9 | 4 | 3 | E:public/js/payment/payments.js:21,127; E:public/js/utils/item_selector.js:43 |

### 6. `frappe.ui.form.make_control` and Control classes [exact]

| API | fw | fa | ea | notes |
|---|---|---|---|---|
| `frappe.ui.form.make_control(...)` | 22 | 11 | 24 | ERPNext: POS 11, plant_floor and visual_plant 6, shop_floor 2, party_overview 2, coa importer, bom_creator, serial_batch_inline_editor. Not assigned: fa 3, ea 5 dynamic `this[\`${x}_control\`]` |
| `new frappe.ui.form.ControlX(...)` | 0 | 0 | 0 | never constructed directly |
| `extends frappe.ui.form.ControlX` | 37 | 0 | 1 | ERPNext E:public/js/telephony.js:1 replaces the global: `frappe.ui.form.ControlData = class extends frappe.ui.form.ControlData { make_input(){…} }`. It uses `this.df`, `this.frm.fields_dict` (walks all controls: `field.df`, `field.disp_area.style`, `field.has_icon`, `field.setup_phone`), `this.$wrapper.find(".control-value" or ".control-input").append(...)`, and `get_value()` |
| `ControlX.prototype.<m>` borrowed | 2 | 1 | 0 | `frappe.ui.form.ControlBarcode.prototype.get_options.bind({df})` (F:printing/page/print/print.js:833) |
| `extends frappe.ui.form.Controller` | 1 | 0 | 7 | class-based form controllers |

Members used on what make_control returns (fa / ea, plus POS dynamic names):

| member | fa | ea | detail |
|---|---|---|---|
| `get_value` | 13 | 21 (+12 POS) | |
| `$wrapper` | 13 | 18 | find 11, addClass 7, length 4, detach, get, parent, remove |
| `$input` | 3 | 21 | on 9, val 4, prop 2, addClass, get, trigger, one |
| `set_input` | 7 | 2 | |
| `df` | 8 | 0 | plus POS `df.read_only`, `df.onchange`, `df.get_query`, `df.reqd` (15) |
| `refresh` | 3 | 5 (+7) | |
| `set_value` | 0 | 6 (+15) | |
| `set_focus` | 0 | 7 | |
| `toggle_label` | 0 | 6 | |
| `parent` | 2 | 3 | attr, is |
| `awesomplete` | 0 | 3 | `.ul`, `.close` |
| `get_checked_options` | 4 | 0 | |
| `toggle`, `refresh_input` | 3 each | 0 | |
| `value` | 0 | 2 | |
| `wrapper` | 1 | 1 | |
| `$checkbox_area.css` | 1 | 0 | |

### 7. Property writes on controls and grids [exact]

| target | fw | fa | ea |
|---|---|---|---|
| `.get_query =` (frm field and grid field) | 8 | 4 | 53 |
| `.disp_area.innerHTML =` | 0 | 6 | 0 |
| `.df.read_only =` | 1 | 3 | 2 |
| `.df.options =` | 0 | 2 | 3 |
| `.df.onchange =` | 4 | 0 | 4 |
| `.df.data =` | 4 | 0 | 3 |
| `.df.hidden =` | 1 | 0 | 2 |
| `.df.reqd =` | 0 | 2 | 0 |
| `grid.cannot_add_rows =` | 0 | 1 | 3 |
| `grid.editable_fields =` | 0 | 0 | 2 |
| `grid_pagination.page_length =` | 0 | 2 | 0 |
| `df.cannot_delete_rows =` | 0 | 1 | 0 |
| `grid.refresh =` (override) | 0 | 1 | 0 |
| `.new_doc =` | 0 | 1 | 0 |
| `.input.disabled =` | 0 | 0 | 1 |
| `.input.onclick =` | 0 | 0 | 1 |
| `.value =` | 0 | 0 | 1 |
| `grid.add_items_button =` | 0 | 0 | 1 |

Scratch scripts and raw outputs are in /tmp/claude-1001/-home-claude-vue-first-components/313d7bfe-ea88-4553-bd60-dbabf7777d42/scratchpad/ctl/. The most useful are main.py, main.out, grid.out, gr1.out, gr2.out, mk.out, mc.py, sel.py, asg.py, ft.py and wrap.py.

## Top risks

- HTML fields used as mount points: about 100 frm sites plus about 60 dialog sites take an HTML field's $wrapper or wrapper and call empty(), html(), append() or appendTo() on it, or hand it to charts, datatables and app widgets. The compat layer must give them a stable, persistent jQuery node that Vue never re-renders. For Section Break, `.wrapper` must stay a jQuery object (purchase_order.js calls addClass on it), while for controls `.wrapper` is a DOM element.
- The grid's imperative API is heavily used, and with live semantics. grid.update_docfield_property has 72 frm sites. get_query is assigned on about 53 ERPNext controls and grid fields. Also used: set_column_disp, toggle_enable, toggle_reqd, reset_grid, set_multiple_add, get_selected_children, add_new_row (which returns the doc), refresh_row, get_row, and property writes cannot_add_rows, editable_fields and grid_pagination.page_length that must take effect on the next refresh.
- Live df mutation in dialogs and controls. Code pushes into d.fields_dict.t.df.data (about 45 sites) and then calls grid.refresh(). It also assigns df.onchange, read_only, options, hidden and reqd and then calls refresh(). df has to stay the same mutable object the renderer reads, not a copy.
- Raw DOM reach-ins into the legacy grid and control markup. Examples: .grid-row[data-name=cdn] then .grid-form-body prepend; .column-label eq(1).text; grid.wrapper '> .control-label'; .grid-heading-row .grid-row-check click(); [data-action=duplicate_rows]; .grid-footer; div[data-fieldname=x] > div > .clearfix; .control-input, .link-btn, .btn-open and .btn-clear inside POS make_control controls; delegated on() over '.form-grid .link-field input'. Each one needs the same class names and DOM structure.
- Class monkey-patching. ERPNext telephony.js swaps the global frappe.ui.form.ControlData for a subclass that overrides make_input and reads $wrapper, .control-value, .control-input, disp_area.style and frm.fields_dict. data_import replaces grid.refresh on the instance, and print.js borrows ControlBarcode.prototype. make_control must look up frappe.ui.form['Control'+fieldtype] when it runs, and those classes must stay subclassable with the same hook methods.
- Grid-row internals and events. Apps use grid_rows[i].remove(), grid_rows_by_docname[cdn].grid_form.fields_dict[f].wrapper, row.columns[f] (css, toggleClass, .df, .field, .field_area), grid_row.row as jQuery (addClass and hasClass), grid_row.on_grid_fields_dict.x.get_value/set_value, select() and refresh_check(). They also rely on the form_render event, the <table>_on_form_rendered(doc, grid_row) controller hook, and the jQuery 'grid-row-render' event fired on frm.wrapper.
- make_control used standalone outside forms: 24 ERPNext sites (POS, shop floor, plant floor) and 11 Frappe app sites. They rely on $input.on, val and prop; $wrapper.find, addClass and detach; awesomplete.ul and close(); parent.attr; set_focus; toggle_label; refresh_input; and get_checked_options. new frappe.ui.form.ControlX(...) is never constructed directly, so make_control is the only factory that needs to stay.
- disp_area and input as raw DOM: disp_area.innerHTML is written in 6 places, and there is input.disabled = x and input.onclick = fn. Read-only display areas and the input elements must be real DOM nodes that survive a refresh.
