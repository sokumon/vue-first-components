# Sweep: Form API

## How this census was done
Everything below came from scripts, not samples. Scripts and intermediate files are in `/tmp/claude-1001/-home-claude-vue-first-components/313d7bfe-ea88-4553-bd60-dbabf7777d42/scratchpad/` (`sub.py`, `calls.py`, `argc.py`, `ev.py`, `sel2.py`, `prop.py`, `members.txt`). Nothing in the sources was edited.

**Codebases** (each JS file list is in the scratchpad):
- **FD**: Frappe app code outside `public/js`, 390 files (258 of them are `*/doctype/*/*.js`; the rest are page, report and template JS).
- **ERP**: all ERPNext JS, 706 files (doctype JS, `public/js` controllers and utils, page and report JS).
- **FP**: Frappe `public/js`, 454 framework-internal files. These are listed for reference only. They are not app call sites.

**Receivers matched:** `frm.`, `cur_frm.`, `this.frm.` and `me.frm.` (regex `\b(?:cur_frm|frm)\.`). Second-level counts allow whitespace or newlines and `?.` between the parts.

**How each call site's return value was classified:** the scripts match parentheses, then look at what follows the closing `)` and at what precedes the call on its line.
- (a) only called: a plain statement
- (b) return value used through its own API: `.then`, `await`, assigned and then read
- (c) return value changed with jQuery or the DOM
- (d) DOM reached from outside with a selector

## 1. Top-level `frm.*` members (Form class API) by total sites

| member | FD | ERP | FP | usage (scripted) | examples |
|---|---|---|---|---|---|
| doc | 1145 | 5124 | 261 | model access. 173 direct `frm.doc.x =` writes in app code | everywhere |
| set_value | 164 | 530 | 18 | (a) 677 statements. (b) `.then` 4, `.finally` 1, `await` 5, `return` 4. Arity: 2 args 670, object form 21, 4 args 3 | erpnext/projects/doctype/project/project.js:738; erpnext/public/js/controllers/transaction.js:181; erpnext/accounts/doctype/payment_entry/payment_entry.js:1470 |
| trigger | 232 | 458 | 6 | (a) 634. Used as an expression or in arrow callbacks 48. (b) `.then` 8, `return` 7 (returns a promise) | frappe/printing/doctype/print_format/print_format.js:46,101 |
| set_query | 62 | 561 | 0 | (a) 100%. Arity: (field, fn) 397; (field, table, fn) 226 | frappe/website/doctype/website_settings/website_settings.js:3 |
| add_custom_button | 134 | 446 | 0 | (a) 573. (b)/(c) 7 assigned: 2 passed as `frappe.call({btn})`, which does `$(btn).prop('disabled')`; 1 `$btn.attr/removeAttr('aria-busy')`; 3 `this.$x_btn` stored; 1 stored and unused. Arity: 2 args 214, 3 args (group) 343, 4 args 23 | frappe/integrations/doctype/google_contacts/google_contacts.js:28; frappe/email/doctype/email_account/email_account.js:315; frappe/email/doctype/email_queue/email_queue.js:7; erpnext/accounts/doctype/sales_invoice/sales_invoice.js:385 |
| events | 122 | 427 | 21 | `frm.events.<handler>(frm)` is called 543 times in app code. Handlers call each other through the handler map. No writes to it | erpnext doctype JS passim |
| fields_dict | 91 | 275 | 20 | see section 3 | |
| set_df_property | 109 | 178 | 1 | (a) 283. 3 args 283, 6 args (child row) 3 | frappe/flow/doctype/flow_agent/flow_agent.js:36 |
| doctype / docname / meta | 18/6/7 | 92/21/17 | 120/74/72 | read-only properties. App code reads `meta.default_print_format` 10 times | |
| is_new | 74 | 97 | 29 | (b) boolean | frappe/printing/doctype/letter_head/letter_head.js:13 |
| call | 40 | 134 | 1 | (a) 76. (b) `.then` 46, `return` 49, `await` 11, `r.message` 3 | frappe/flow/doctype/flow_knowledge_source/flow_knowledge_source.js:53; erpnext/accounts/doctype/pos_invoice/pos_invoice.js:122 |
| get_field | 66 | 68 | 5 | (b)/(c): see section 3 | |
| page | 43 | 69 | 23 | see section 4 | |
| toggle_display | 44 | 88 | 0 | (a) 100%. Array of fields as first argument: 27 sites (shared count with reqd/enable) | frappe/printing/doctype/print_format/print_format.js:47 |
| refresh_field | 19 | 103 | 7 | (a) | frappe/contacts/doctype/address/address.js:29 |
| reload_doc | 26 | 88 | 12 | (a) 104. (b) `.then` 2, `await` 3 | frappe/core/doctype/data_import/data_import.js:834 |
| dashboard | 51 | 49 | 6 | see section 5 | |
| refresh | 15 | 41 | 6 | (a) | erpnext/selling/page/point_of_sale/pos_controller.js:504 |
| script_manager | 3 | 36 | 21 | `trigger` 26 (await 2), `copy_from_first_row` 12, `has_handlers` 1 | erpnext/buying/doctype/purchase_order/purchase_order.js:649 |
| cscript | 2 | 47 | 11 | `frm.cscript.x(...)` 33. Class controllers: `frappe.ui.form.Controller` subclasses 19+8 ERP, `set_controller` 26 | erpnext/crm/doctype/lead/lead.js:8; erpnext/public/js/controllers/stock_controller.js:10 |
| dirty / is_dirty | 9/13 | 29/16 | 16/18 | (a)/(b) boolean | frappe/contacts/doctype/contact/contact.js:97 |
| refresh_fields | 4 | 47 | 3 | (a) | |
| save | 12 | 30 | 11 | (a) 38. (b) `.then` 5, `await` 8, `return` 3 | erpnext/selling/page/point_of_sale/pos_controller.js:274 |
| add_fetch | 6 | 46 | 1 | (a) | frappe/printing/doctype/print_format/print_format.js:5 |
| add_child | 11 | 38 | 2 | (b) The returned row is a model object, and fields are written on it in 25 sites | erpnext/accounts/doctype/payment_entry/payment_entry.js:1056; frappe/desk/doctype/kanban_board/kanban_board.js:62 |
| toggle_reqd | 4 | 46 | 0 | (a) | frappe/integrations/doctype/webhook/webhook.js:122 |
| clear_table | 1 | 49 | 0 | (a) | |
| has_perm | 12 | 23 | 6 | (b) boolean | frappe/desk/doctype/note/note.js:9 |
| disable_save / enable_save | 24/7 | 14/2 | 0 | (a) | frappe/printing/doctype/letter_head/letter_head.js:10,20 |
| wrapper / $wrapper | 6/0 | 13/2 | 19 | (c)/(d): see section 6 | |
| set_intro | 10 | 27 | 0 | (a) 100%. 1 arg 27, 2 args (color) 9, 0 args (clear) 1 | frappe/printing/doctype/letter_head/letter_head.js:18 |
| toggle_enable | 11 | 23 | 0 | (a) | |
| get_docfield | 2 | 22 | 8 | (b) returns the docfield: 17 ERP sites assign `.get_route_options_for_new_doc`, plus `.label`, `.reqd`, `.depends_on` | erpnext/assets/doctype/asset_repair/asset_repair.js:78; erpnext/public/js/controllers/accounts.js:55 |
| layout | 15 | 4 | 11 | see section 5 | |
| perm | 3 | 1 | 20 | read | |
| set_indicator_formatter | 0 | 21 | 0 | (a), 2 args | erpnext/assets/doctype/asset_maintenance/asset_maintenance.js:24 |
| set_read_only | 10 | 8 | 0 | (a) | |
| sidebar | 5 | 3 | 10 | `add_user_action` 3 FD, whose return is changed with `.attr('href'/'target')` and `.on('click')`. `sidebar.sidebar` 2 and `image_wrapper.find('.sidebar-image').attr()` 1 | frappe/website/doctype/contact_us_settings/contact_us_settings.js:3; frappe/website/doctype/web_form/web_form.js:843; erpnext/manufacturing/doctype/workstation/workstation.js:9; erpnext/setup/doctype/employee/employee.js:184 |
| timeline | 0 | 10 | 7 | `timeline.wrapper.find/on/data` 10, all in erpnext/support/doctype/issue/issue.js:88-137 (c)+(d) | |
| get_active_tab | 5 | 7 | 0 | (b) `.label`, `.df` | erpnext/public/js/party_overview.js:53 |
| change_custom_button_type | 0 | 10 | 0 | (a), 3 args | erpnext/accounts/doctype/bank_clearance/bank_clearance.js:40 |
| remove_custom_button | 1 | 4 | 0 | (a), 1 or 2 args (with group) | frappe/desk/doctype/note/note.js:12; erpnext/manufacturing/doctype/work_order/work_order.js:177 |
| clear_custom_buttons | 2 | 2 | 0 | (a) | frappe/website/doctype/website_theme/website_theme.js:10 |
| disable_form | 12 | 0 | 0 | (a) | frappe/website/doctype/web_form/web_form.js:30 |
| scroll_to_field | 2 | 0 | 4 | (a) | frappe/desk/page/backups/backups.js:10 |
| fields | 5 | 2 | 2 | read | |
| states | 7 | 0 | 1 | read | |
| attachments | 0 | 0 | 24 | framework only | |
| open_grid_row / get_selected / copy_doc / email_doc | 0/0/0/1 | 2/2/1/0 | 2/1/1/2 | (b) `get_selected().forEach/.length` | erpnext/accounts/doctype/payment_request/payment_request.js:131 |
| savesubmit / savetrash / refresh_header / validate_form_action / add_web_link / is_dialog / get_sum / get_title / set_dirty / amend_doc / rename_doc | 0 | 1 each | 0-1 | (a) | |
| toolbar | 0 | 0 | 2 | **not used by apps** | |
| set_currency_labels | 0 | 23 | 0 | ERPNext controller method on `frm`, not a Form API method | |

**App-private expando properties.** Apps attach their own state to `frm`: 158 distinct names are assigned across 354 sites (for example `frm._import_preview_*`, `frm.roles_editor`, `frm.compare_button`, `frm.get_items_btn`, `frm._jcd_timer_interval`). The `frm` object must stay open to new properties: no freeze, seal or strict Proxy.

**App-set properties the framework reads:**

| property | sites | where Frappe reads it |
|---|---|---|
| `ignore_doctypes_on_cancel_all` | 22 | form.js:1151 |
| `custom_make_buttons` | 21 | form.js:2461 |
| `make_methods` | 17 | form.js:2484 |
| `email_field` | 8 | communication.js:1192, form_timeline.js:619 |

## 2. `frappe.ui.form.on` event keys
There are 672 `frappe.ui.form.on` calls (244 FD, 428 ERP). 44 of them use the `(dt, field, fn)` form instead of an object.

| key class | FD | ERP | examples |
|---|---|---|---|
| fieldname or helper (field change handlers, and helpers called through `frm.events.x`) | 218 | 620 | frappe/printing/doctype/print_settings/print_settings.js |
| refresh | 147 | 165 | frappe/printing/doctype/print_style/print_style.js |
| setup | 20 | 109 | frappe/printing/doctype/letter_head/letter_head.js |
| onload | 26 | 58 | frappe/printing/doctype/network_printer_settings/network_printer_settings.js |
| validate | 13 | 14 | frappe/contacts/doctype/address/address.js |
| `<table>_add` | 6 | 15 | frappe/flow/doctype/flow_agent/flow_agent.js |
| `<table>_remove` | 7 | 12 | frappe/workflow/doctype/workflow/workflow.js |
| before_save | 7 | 4 | frappe/desk/doctype/dashboard_chart/dashboard_chart.js |
| after_save | 8 | 3 | frappe/contacts/doctype/address/address.js |
| form_render (child row form) | 5 | 3 | frappe/desk/doctype/form_tour/form_tour.js |
| `before_<table>_remove` | 4 | 1 | frappe/custom/doctype/customize_form/customize_form.js |
| onload_post_render | 1 | 3 | erpnext/assets/doctype/location/location.js |
| before_load | 2 | 1 | frappe/core/doctype/user/user.js |
| on_tab_change | 2 | 0 | frappe/core/doctype/doctype/doctype.js |
| before_submit | 0 | 2 | erpnext/assets/doctype/asset/asset.js |
| `<table>_on_form_rendered` | 0 | 2 | erpnext/assets/doctype/asset_repair/asset_repair.js |
| after_delete | 1 | 0 | frappe/printing/doctype/print_format/print_format.js |
| on_submit | 0 | 1 | erpnext/subcontracting/doctype/subcontracting_receipt/subcontracting_receipt.js |
| timeline_refresh | 0 | 1 | erpnext/support/doctype/issue/issue.js |
| before_cancel | 0 | 1 | erpnext/accounts/doctype/payment_entry/payment_entry.js |

**Other event plumbing apps use:**
- `frappe.ui.form.trigger(dt, field)`: 4 ERP sites.
- `frappe.model.set_value`: 8 FD, 314 ERP. It fires the field and child events.
- `locals[`: 24 FD, 300 ERP.
- `frappe.ui.form.set_controller`: 26.
- `frappe.ui.form.make_control`: 35 sites in 20 files.
- `frappe.ui.form.make_quick_entry`: 5.

**Framework classes apps extend or construct:**
- erpnext/public/js/telephony.js:1 reassigns `frappe.ui.form.ControlData`, overrides `make_input`, appends into `.control-value`/`.control-input`, and reads `field.disp_area.style`.
- erpnext/public/js/utils/item_quick_entry.js:3 subclasses `QuickEntryForm`.
- erpnext/selling/page/point_of_sale/pos_controller.js:597 builds a headless form with `new frappe.ui.form.Form(doctype, $('<div>'), false)`, then calls `frm.refresh(name)`.

**Events the framework fires that apps listen to with `$(frm.wrapper).on(...)`:**
- `grid-row-render` ×2: frappe/custom/doctype/customize_form/customize_form.js:38; erpnext/public/js/controllers/accounts.js:13
- `dirty` ×2: erpnext/manufacturing/doctype/job_card/job_card.js:6
- `refresh-fields` ×3, including `off` and `trigger`: erpnext/selling/page/point_of_sale/pos_item_cart.js:1065

Apps also fire custom events on `frm.wrapper`: 5 in erpnext/projects/doctype/project/project.js:22-37, plus `frm.wrapper.dispatchEvent` at :115, and 3 in data_import.

## 3. Controls: `frm.fields_dict.<f>` and `frm.get_field(f)` (receiver is `frm`; newline-tolerant)

| prop | FD | ERP | FP | usage |
|---|---|---|---|---|
| grid | 34 | 197 | 3 | (b): see the grid table below |
| $wrapper | 43 | 29 | 1 | (c) |
| wrapper | 23 | 25 | 2 | (c), usually wrapped in `$()` |
| get_query (assigned) | 4 | 16 | 0 | (b) property write. `.grid.get_field(x).get_query =` adds 33 ERP |
| df | 3 | 6 | 2 | read and write df |
| set_data | 5 | 3 | 0 | (a) |
| html | 6 | 1 | 0 | (a), HTML control |
| disp_area | 7 | 0 | 0 | `.innerHTML` written directly, 7 sites (c) |
| set_label / set_description / toggle_label / toggle_description / toggle / refresh / hide | 1-3 each | | | (a) |
| tab / collapse / section / row | 1/1/1/0 | 2/1/0/2 | | section and tab handles |
| map / datepicker / input / $input / value / get_precision / clear_attachment | 0-1 | 1-3 | | control internals: Geolocation map, datepicker, raw input |

**How the 122 `$wrapper`/`wrapper` handles are used (scripted):**

| usage | sites |
|---|---|
| chained jQuery or DOM call | 31 (`empty` 14, `html` 9, `on` 3, `hide` 1, `get` 1, `find` 1, `addClass`/`removeClass` 2) |
| `$(x.wrapper)` then chained | 16 (`empty` 13, `closest('.tab-pane')` 1, `html` 1, `find` 1) |
| assigned to a variable | 26; the variable is later used with `empty` 12, `find` 9, `html` 3, `addClass` 3, `append` 3, `on` 1, `show` 1 |
| passed as an option (`{wrapper|parent|notes_wrapper: x}`) to a component | 11 |
| passed as a function argument (`DataTable`, `frappe.ui.chart`, `scroll_to`, `render_heatmap`) | 6 |
| used as an `appendTo` target | 3 |
| other | 8 |

Examples:
- frappe/printing/doctype/print_settings/print_settings.js:8: `.$wrapper.html(`
- frappe/desk/doctype/system_console/system_console.js:76: `new DataTable($wrapper.get(0))`
- erpnext/crm/doctype/lead/lead.js:225: `notes_wrapper: $(frm.fields_dict.notes_html.wrapper)`
- erpnext/buying/doctype/purchase_order/purchase_order.js:286: section `wrapper.addClass("hide-border")`
- frappe/core/doctype/data_import/data_import.js:2528: `$wrapper.on("click", ".skip-row-btn")`

**`get_field()` return value at the call site** (134 FD+ERP sites):

| how the return is used | FD | ERP |
|---|---|---|
| chained `.$wrapper` | 19 | 22 |
| chained `.grid` | 3 | 27 |
| chained `.html` | 6 | 1 |
| chained `.wrapper` | 7 | 0 |
| chained `.df` | 1 | 3 |
| assigned (then `$wrapper`, `html`, `find`, `closest`, `hide`, `show`, `querySelector`, `insertAdjacentHTML`, `set_description`, `set_column_disp`) | 12 | 7 |
| plain statement | 10 | 3 |

**`frm.<ctrl>.grid.*`** (newline-tolerant):

| member | FD | ERP | note |
|---|---|---|---|
| update_docfield_property | 15 | 57 | |
| get_field(x).get_query = | 0 | 43 | 33 of these assign `get_query` |
| set_column_disp | 0 | 10 | |
| toggle_enable | 0 | 9 | |
| grid_rows | 2 | 7 | `[i].remove()` in 6 ERP sites, `forEach` in 2 FD |
| wrapper | 0 | 7 | `.find('.grid-row[data-name=..]')` 6 times, `.find('> .control-label')`, `.off` (c)+(d) |
| get_selected_children | 0 | 6 | |
| set_multiple_add | 0 | 6 | |
| toggle_reqd | 0 | 5 | |
| reset_grid | 0 | 5 | |
| only_sortable | 3 | 1 | |
| grid_rows_by_docname | 3 | 1 | used for `.grid_form.fields_dict` |
| cannot_add_rows = | 0 | 3 | property write |
| get_row | 0 | 3 | |
| grid_pagination.page_length = | 2 | 0 | |
| set_column_disp_in_list_view | 0 | 2 | |
| refresh | 0 | 2 | |
| editable_fields | 0 | 2 | |
| add_custom_button | 1 | 1 | |
| refresh_row / add_new_row / fields_map / docfields | 0 | 1 each | |

## 4. `frm.page.*` (newline-tolerant)

| member | FD | ERP | FP | usage |
|---|---|---|---|---|
| set_inner_btn_group_as_primary | 0 | 27 | 0 | (a) depends on the group passed to `add_custom_button` |
| set_primary_action | 7 | 9 | 0 | (a), 2 args. Also chained after a bare `frm.page` (erpnext/accounts/doctype/chart_of_accounts_importer/chart_of_accounts_importer.js:121) |
| btn_primary | 3 | 8 | 3 | (c) `hide` 6, `toggle` 1, `toggleClass` 1, `get(0)` 1, `trigger('click')` 1. Passed as `frappe.call({btn})` 4 times. Passed to `.dress()` (erpnext/manufacturing/doctype/job_card/job_card.js:310, 1014) |
| btn_secondary | 0 | 5 | 1 | (c) `.hide()` 5 times (gl_entry, payment_ledger_entry, stock_ledger_entry, and others at line :6) |
| wrapper / main / sidebar | 4 | 4 | 8 | (c) `addClass` 2, `toggleClass` 1, `prop('inert')` 2, `css('--page-max-width')` 1, `toggle` 1. frappe/core/doctype/doctype_layout/doctype_layout.js:6; erpnext/accounts/doctype/cheque_print_template/cheque_print_template.js:76; erpnext/manufacturing/doctype/bom_creator/bom_creator.js:27-28; frappe/website/doctype/web_form/web_form.js:930 |
| set_indicator / clear_indicator | 4/3 | 6/2 | 0 | (a) |
| clear_primary_action | 3 | 3 | 0 | (a) |
| hide_icon_group | 1 | 2 | 0 | (a) |
| add_menu_item | 1 | 1 | 0 | (a) |
| add_action_icon | 0 | 1 | 0 | (b) stored, later `.remove()` (erpnext/manufacturing/doctype/bom_creator/bom_creator.js:93-96) (c) |
| set_view / current_view_name / previous_view_name | 1/1/2 | 0/1/0 | | (a)/read |
| clear_inner_toolbar / hide_sidebar / add_inner_message / clear_icons / set_title / clear_actions | 1 each | 0 | | (a) |
| bare `frm.page` passed on | | | | `frappe.ui.keys.add_shortcut({page})` (system_console.js:9), `get_shortcut_group(page)`, `builder.page = frm.page` ×2, `frappe.get_current_page() !== frm.page` |

## 5. `frm.dashboard.*` and `frm.layout.*`

| member | FD | ERP | FP | usage |
|---|---|---|---|---|
| dashboard.set_headline | 12 | 4 | 0 | (a) |
| dashboard.clear_headline | 7 | 4 | 1 | (a) |
| dashboard.show_progress | 6 | 4 | 1 | (a) |
| dashboard.set_headline_alert | 5 | 4 | 1 | (a), 1 or 2 args |
| dashboard.add_progress | 1 | 8 | 0 | (a) |
| dashboard.add_comment | 5 | 2 | 0 | (a) |
| dashboard.hide_progress | 4 | 2 | 0 | (a) |
| dashboard.add_indicator | 0 | 6 | 0 | (a), 2 args |
| dashboard.add_section | 1 | 3 | 0 | (c) the returned jQuery is used as an `appendTo` target ×2 (erpnext/assets/doctype/asset_maintenance/asset_maintenance.js:50; erpnext/stock/doctype/batch/batch.js:115) and with `.on('click', '.invoice-link')` ×1 (erpnext/accounts/doctype/opening_invoice_creation_tool/opening_invoice_creation_tool.js:142) |
| dashboard.show / reset / hide / clear_comment | 1/1/2/3 | 3/2/1/0 | 0 | (a) |
| dashboard.render_graph / refresh | 0 | 1/1 | | (a) |
| dashboard.stats_area / stats_area_row | 0 | 1/3 | | (c) `show`, `addClass('flex')`, `css('flex-wrap')`, `appendTo(stats_area_row)` (erpnext/public/js/utils.js:282-313) |
| dashboard.progress_area | 2 | 0 | 1 | (d) `.body.find('.progress-bar')` (frappe/core/doctype/background_task/background_task.js:47) |
| layout.show_message | 2 | 1 | 2 | (a) |
| layout.message | 2 | 0 | 0 | (c) `.empty()` (frappe/workflow/doctype/workflow/workflow.js:8; frappe/desk/doctype/workspace/workspace.js:22) |
| layout.sections_dict | 5 | 0 | 0 | internal map read |
| layout.refresh_dependency | 2 | 0 | 3 | (a) |
| layout.tabs | 2 | 1 | 1 | (b) `.find(t => t.df.fieldname === x)?.set_active()` (erpnext/projects/doctype/project/project.js:33) |
| layout.wrapper | 2 | 1 | 0 | (d) `.find('.unit-price-items-note')` (erpnext/public/js/controllers/transaction.js:3544) |
| layout.refresh_sections | 0 | 1 | 0 | (a) |

## 6. DOM reached directly (category d)
These counts cover doctype JS plus ERPNext `public/js` only (258 FD + 463 ERP files).
- **Form-level handles:** `$(frm.wrapper)` 25 uses, all event on/trigger except one. `frm.$wrapper.find('.variants-intro').on` (erpnext/manufacturing/doctype/bom/bom.js:427). `frm.$wrapper.on('click', '.btn-clear-last-scanned-warehouse')` (erpnext/public/js/utils/barcode_scanner.js:596).
- **Framework-owned selectors:** 132 selector sites (42 FD, 90 ERP) target 65 class or `data-*` names that are defined in Frappe `public/js` and not created by the calling script:

| selector target | FD | ERP | example |
|---|---|---|---|
| `[data-fieldname=]` | 3 | 9 | erpnext/stock/doctype/shipment/shipment.js:71 `$('div[data-fieldname=pickup_address] > div > .clearfix')` |
| `.grid-row` | 1 | 7 | erpnext/stock/doctype/item/item.js:411 |
| `[data-action=]` | 1 | 7 | erpnext/projects/doctype/project/project.js:268; also `[data-action='duplicate_rows']` with `.css('display','none')` in erpnext/manufacturing/doctype/master_production_schedule/master_production_schedule.js:11 |
| `[data-name=]` | 0 | 6 | |
| `.clearfix` | 0 | 6 | |
| `.form-message` | 3 | 1 | |
| `.form-section` | 1 | 3 | |
| `.grid-row-check` | 2 | 2 | |
| `.timeline-item` | 0 | 4 | |
| `.form-grid` | 3 | 0 | |
| `.control-label` | 0 | 3 | |
| `.frappe-control` | 1 | 1 | |
| `.section-head` | 1 | 1 | |
| `.user-action-row` | 1 | 1 | |
| `.grid-form-body` | 0 | 2 | |
| `.modal-dialog` | 0 | 2 | |
| `.btn-primary` | 0 | 2 | |
| `.awesomplete` | 1 | 1 | |
| `.tab-pane` | 1 | 0 | |
| `.section-body` | 1 | 0 | |
| `.layout-main-section-wrapper` | 1 | 0 | |
| `.grid-footer` | 1 | 0 | |
| `.grid-heading-row` | 0 | 1 | |
| `.column-label` | 0 | 1 | |
| `.control-value` | 1 | 0 | |
| `.help-box` / `.form-group` | 0 | 1 each | |
| `.timeline-actions` / `.timeline-content` | 0 | 1 each | global `$()` |
| `.layout-main` | 0 | 1 | |
| `$('.btn:contains(...)')` | 0 | 2 | global (erpnext/accounts/doctype/shareholder/shareholder.js:38) |
| `$('.modal:visible')` | 0 | 1 | global |

The full list of 65 names is in the scratchpad output of `sel2.py`.

## Top risks

- Control DOM handles are the biggest contract. frm.fields_dict.X.$wrapper and .wrapper (and the same via get_field) appear in 122 frm-receiver sites. They must stay real jQuery objects or wrappable DOM elements that apps can empty() 27x, html(), find(), on(), appendTo() into, and hand to DataTable, charts and CRM activity widgets. disp_area.innerHTML is written directly in 7 places.
- The grid API surface is wide, and some of it is private. update_docfield_property (72 sites), grid.get_field(f).get_query assignment (33+), set_column_disp, toggle_enable/reqd, get_selected_children, grid_rows[i].remove(), grid_rows_by_docname[cdn].grid_form.fields_dict, grid_pagination.page_length, and cannot_add_rows written as a property. grid.wrapper.find('.grid-row[data-name=..]') is used 6x in ERPNext.
- add_custom_button must keep returning a jQuery-wrappable button. Its return is used through frappe.call({btn}) prop('disabled') and .attr/removeAttr('aria-busy'). The group argument is used in 343 of 580 sites, and page.set_inner_btn_group_as_primary (27 ERP) and change_custom_button_type (10) both depend on how groups render.
- jQuery custom events on frm.wrapper must still fire: grid-row-render, dirty and refresh-fields. Apps also trigger their own events on frm.wrapper. ERPNext constructs a headless new frappe.ui.form.Form(dt, $('<div>'), false) for POS, and it reassigns or subclasses frappe.ui.form.ControlData and QuickEntryForm.
- frm must stay an open, mutable object. Apps assign 158 expando properties across 354 sites. The framework reads app-set config properties custom_make_buttons (21 sites), make_methods (17), ignore_doctypes_on_cancel_all (22) and email_field (8). Handlers call each other through frm.events.x(frm) 543 times.
- Page and dashboard handles are changed with jQuery. frm.page.btn_primary/btn_secondary get hide, toggle, toggleClass, get(0) and trigger('click'). frm.page.wrapper/sidebar get addClass, prop('inert') and css. dashboard.add_section's return is used as an appendTo target and for delegated on. dashboard.stats_area_row gets addClass and css. sidebar.add_user_action's return gets attr and on. timeline.wrapper gets find, on and data.
- 132 selector sites reach framework DOM by class or data-attribute (for example [data-fieldname], .grid-row, [data-action], .form-section, .control-label, .form-message, .timeline-item, .section-head, .tab-pane). A Vue port that changes this markup breaks them silently, with no error thrown.
