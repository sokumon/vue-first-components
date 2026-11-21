# Sweep: Page API

## Page API census: frappe.ui.Page across frappe and ERPNext

**Method.** Two Python scripts parse the source and count every `page.<member>` access. They match any receiver that ends in `page`, with whitespace allowed around the dot so multi-line chains count: `this.page`, `frm.page`, `this.frm.page`, `me.frm.page`, `listview.page`, `list_view.page`, `this.list_view.page`, `report.page`, `treeview.page`, `wrapper.page`, `this.wrapper.page`, `me.page`, `doclist.page`, `cur_list.page`, `cur_frm.page`, `frm.value.page` and a bare `page`.

What was excluded:
- Comments.
- `ui/page.js` itself, the vendored `lib`, `dist`, `node_modules`, the minified `public/studio`, and the port's own `vue_first*/` directories.
- Receivers that are not a Page:
  - namespaces such as `erpnext.selling.page`;
  - workspace and router records stored in a variable called `page`;
  - print-sheet objects;
  - `form/layout.js`, where `this.page` is a `.form-page` div;
  - `views/container.js` and `views/formview.js`, where `this.page` is the container DOM element;
  - the kanban_v2 lane class, where `this.page` is a custom object.

Corpus: 844 frappe JS/Vue files and 706 ERPNext JS files.

For each site the script records how the result is used:
- **(a) called-only:** the call is a statement on its own.
- **(b) own-api:** the result is used through its own API, e.g. `fields_dict.x.get_value`.
- **(c) jQuery:** jQuery or DOM methods are chained on the result, or called on a variable the result was stored in (that variable is followed through the rest of the file).
- **(d) selectors:** searched separately (section 5).

Script and data: `/tmp/claude-1001/-home-claude-vue-first-components/313d7bfe-ea88-4553-bd60-dbabf7777d42/scratchpad/{census.py,analyze.py,rows.json,summary.json,table.md}`

### 0. Totals

| scope | Page-member sites | members used |
|---|---|---|
| frappe desk core (`public/js/**`) | 320 | — |
| frappe app JS (doctype, page and report scripts outside `public/js`) | 140 | — |
| ERPNext | 193 | — |
| **all** | **653** | **74 of 130 public names** (75 counting `get_breadcrumbs`, reached through `...page.get_breadcrumbs()` in breadcrumbs.js:284) |
| used by app code (frappe app JS + ERPNext) | 333 | **43** |

Pages are created by 17 `frappe.ui.make_app_page` calls in frappe and 8 in ERPNext, plus 1 `new frappe.ui.Page`. The options passed in object literals are: `parent` 22, `single_column` 21, `title` 18, `hide_sidebar` 4, `sidebar_position` 2, `hide_dock` 1, `card_layout` 1, `disable_sidebar_toggle` 1, `name` 1. `frappe.ui.pages[route].single_column` is read back in container.js:104.

### 1. Full per-member table (sorted by sites)

How to read it:
- **desk-core** is frappe `public/js`; **frappe app** is frappe doctype, page and report JS; **files c/a/e** counts distinct files per bucket.
- **"how used" categories:**
  - `called-only` is (a).
  - `own-api-chain` is (b).
  - `jq-chain` is (c), with jQuery chained directly on the result.
  - `assigned` means the result was stored; the last column lists the members later used on that variable, which is (c) when they are jQuery calls.
  - `passed-as-arg` and `object-prop` mean the value is handed to another API, usually as a jQuery parent or a Dropdown trigger.
  - `write` means the caller assigns the property.

| member | kind | total | desk-core | frappe app | ERPNext | files c/a/e | how used | jQuery chained on result | used on stored result |
|---|---|---|---|---|---|---|---|---|---|
| add_menu_item | method | 61 | 32 | 20 | 9 | 9/7/6 | called-only 54, assigned 7 | (`.parent().addClass("hidden-xl")` in toolbar.js) | parent 2, toggle 2, addClass 1, text 1 (`follow_menu_item?.text`) |
| add_inner_button | method | 53 | 8 | 11 | 34 | 4/6/26 | called-only 49, assigned 3, jq-chain 1 | toggle 1 | remove 2 |
| main | prop | 37 | 25 | 7 | 5 | 9/5/2 | jq-chain 19, passed-as-arg 14, assigned 2, object-prop 2 | addClass 5, find 4, parent 4, removeClass 2, get 2, html 2, on 2, css 1 | addClass, closest, find |
| set_primary_action | method | 34 | 10 | 12 | 12 | 8/12/9 | called-only 27, assigned 3, jq-chain 3, object-prop 1 | addClass 2, attr 1, tooltip 1 | is 1, prop 1 |
| fields_dict | prop | 33 | 17 | 1 | 15 | 3/1/6 | own-api 17, assigned 10, read 4, arg 1, returned 1 | `.<fieldname>.get_value` 8, `.get_query=` 3+, `.company`, `.root_company`… | $wrapper 3, df 3, get_value 3, set_value 2 |
| add_action_item | method | 30 | 2 | 1 | 27 | 1/1/13 | called-only 30 | - | - |
| wrapper | prop | 27 | 19 | 2 | 6 | 8/2/5 | jq-chain 23, passed-as-arg 3, read 1 | find 8, addClass 3, removeClass 3, on 2, is 2, get 2, prop 2, before 1 | - |
| set_inner_btn_group_as_primary | method | 27 | 0 | 0 | 27 | 0/0/19 | called-only 27 | - | - |
| set_indicator | method | 25 | 9 | 9 | 7 | 6/5/5 | called-only 25 | - | - |
| set_breadcrumbs | method | 21 | 13 | 8 | 0 | 6/5/0 | called-only 21 | - | - |
| page_form | prop | 20 | 20 | 0 | 0 | 5/0/0 | jq-chain 15, arg 3, assigned 1, object-prop 1 | find 6, addClass 5, append 4, removeClass 3, show 1, hide 1 | - |
| add_action_icon | method | 19 | 14 | 4 | 1 | 8/1/1 | called-only 11, assigned 8 | - | addClass 2, css 2, attr 1, remove 4, toggle 1, removeAttr/removeClass, Dropdown trigger (workspace.js:286-289), ERPNext `frm.compare_button?.remove()` |
| add_field | method | 18 | 7 | 2 | 9 | 4/1/4 | assigned 16, called-only 2 | - | get_value 13, set_value 4, $input 2, df 2, get_query 2, on_change 2, set_input 2 (Control API) |
| add_button | method | 16 | 7 | 9 | 0 | 4/3/0 | called-only 10, assigned 4, jq-chain 2 | hide 2 | toggle 2, remove 1, text 1 |
| btn_primary | prop | 15 | 4 | 3 | 8 | 3/3/6 | jq-chain 8, object-prop 4, arg 3 | trigger 2, toggleClass 2, is 1, addClass 1, toggle 1, hide 1, get 1 | - |
| set_title | method | 15 | 9 | 5 | 1 | 7/5/1 | called-only 15 | - | - |
| clear_primary_action | method | 12 | 4 | 5 | 3 | 3/3/3 | called-only | - | - |
| sidebar | prop | 12 | 5 | 5 | 2 | 3/4/2 | jq-chain 10, arg 2 | addClass 3, remove, hide, empty, removeClass, toggleClass, show, toggle | - |
| clear_indicator | method | 11 | 5 | 4 | 2 | 5/4/2 | called-only | - | - |
| clear_menu | method | 10 | 5 | 4 | 1 | 4/2/1 | called-only | - | - |
| body | prop | 9 | 0 | 7 | 2 | 0/4/2 | arg 6, jq-chain 2, object-prop 1 | find, addClass | - |
| $title_area | prop | 9 | 6 | 3 | 0 | 4/1/0 | jq-chain 8, arg 1 | find 5, remove 3, prepend, toggleClass, parent, css | - |
| btn_secondary | prop | 8 | 2 | 0 | 6 | 2/0/6 | jq-chain 8 | hide 5, prop, addClass, `get(0).innerText=` | - |
| set_secondary_action | method | 7 | 4 | 1 | 2 | 3/1/2 | called-only 5, assigned 2 | (toolbar: `.prop().wrap().parent().attr().tooltip()`) | addClass, prop |
| container | prop | 7 | 7 | 0 | 0 | 3/0/0 | jq-chain 7 | find 4, addClass 2, removeClass, append, hide, show | - |
| menu | prop | 7 | 7 | 0 | 0 | 6/0/0 | object-prop 3 (as `parent:`), jq-chain 2, assigned 1, arg 1 | find().length, children().filter().length | find |
| add_actions_menu_item | method | 6 | 2 | 4 | 0 | 2/3/0 | called-only 5, assigned 1 | - | addClass |
| clear_actions | method | 6 | 5 | 1 | 0 | 3/1/0 | called-only | - | - |
| add_custom_menu_item | method | 6 | 3 | 0 | 3 | 1/0/1 | called-only 5, assigned 1 | - | parent |
| hide_sidebar | prop | 5 | 4 | 1 | 0 | 2/1/0 | read | - | - |
| clear_user_actions | method | 4 | 4 | 0 | 0 | 3/0/0 | called-only | - | - |
| clear_inner_toolbar | method | 4 | 3 | 1 | 0 | 3/1/0 | called-only | - | - |
| hide_menu | method | 4 | 4 | 0 | 0 | 2/0/0 | called-only | - | - |
| clear_custom_actions | method | 4 | 3 | 0 | 1 | 3/0/1 | called-only | - | - |
| clear_icons | method | 4 | 2 | 1 | 1 | 2/1/1 | called-only | - | - |
| clear_secondary_action | method | 3 | 2 | 1 | 0 | 2/1/0 | called-only | - | - |
| current_view_name | prop | 3 | 1 | 1 | 1 | 1/1/1 | read | - | - |
| standard_actions | prop | 3 | 3 | 0 | 0 | 1/0/0 | jq-chain | show 2, hide 1 | - |
| show_breadcrumbs | opt/prop | 3 | 3 | 0 | 0 | 2/0/0 | write | - | - |
| custom_actions | prop | 3 | 3 | 0 | 0 | 3/0/0 | arg / prependTo target / read | - | - |
| add_dropdown_item | method | 3 | 3 | 0 | 0 | 3/0/0 | called-only | - | - |
| hide_icon_group | method | 3 | 0 | 1 | 2 | 0/1/2 | called-only | - | - |
| set_title_sub | method | 3 | 2 | 0 | 1 | 1/0/1 | called-only | - | - |
| add_divider | method | 3 | 3 | 0 | 0 | 1/0/0 | called-only | - | - |
| add_date | method | 2 | 0 | 0 | 2 | 0/0/1 | object-prop (sales_funnel) | - | - |
| page_actions | prop | 2 | 2 | 0 | 0 | 1/0/0 | `[0]` raw DOM, prependTo target | [0] | - |
| remove_inner_button | method | 2 | 1 | 1 | 0 | 1/1/0 | called-only | - | - |
| legacy_breadcrumbs | prop | 2 | 2 | 0 | 0 | 1/0/0 | write | - | - |
| clear_actions_menu | method | 2 | 2 | 0 | 0 | 2/0/0 | called-only | - | - |
| title | prop | 2 | 2 | 0 | 0 | 2/0/0 | read 1, write 1 | - | - |
| previous_view_name | prop | 2 | 0 | 2 | 0 | 0/1/0 | read | - | - |
| $sub_title_area | prop | 2 | 2 | 0 | 0 | 1/0/0 | jq-chain | css, on | - |
| add_custom_button_group | method | 2 | 1 | 0 | 1 | 1/0/1 | assigned → passed as `parent` to add_custom_menu_item | - | - |
| set_view | method | 2 | 1 | 1 | 0 | 1/1/0 | called-only | - | - |
| hide_form / show_form / clear_fields | method | 1 each | 1 | 0 | 0 | | called-only | - | - |
| add_select | method | 1 | 0 | 0 | 1 | 0/0/1 | object-prop | - | - |
| set_document_title | prop | 1 | 1 | 0 | 0 | | write | - | - |
| is_in_group_button_dropdown | method | 1 | 1 | 0 | 0 | | assigned (form.js:1969) | - | parent().parent().remove() |
| show_menu / render_breadcrumbs / hide_actions_menu / show_actions_menu / change_inner_button_type | method | 1 each | 1 | 0 | 0 | | called-only | - | - |
| get_breadcrumbs | method | 1 | 1 | 0 | 0 | | value spread (breadcrumbs.js:284) | - | - |
| page_head | prop | 1 | 0 | 1 | 0 | | jq-chain | hide | - |
| hide_dock / filters / custom_mobile_actions | prop | 1 each | 1 | 0 | 0 | | read | - | - |
| actions_dropdown | prop | 1 | 1 | 0 | 0 | | own-api (`.open()`, list_view.js:2451) | - | - |
| actions_sheet_title | opt | 1 | 1 | 0 | 0 | | write (callback) | - | - |
| menu_btn_group | prop | 1 | 1 | 0 | 0 | | jq-chain | addClass | - |
| add_inner_message | method | 1 | 0 | 1 | 0 | | called-only | - | - |
| add_divider_to_button_group | method | 1 | 0 | 0 | 1 | | called-only | - | - |

**No call sites in frappe or ERPNext (56).** The public ones may still be used by third-party apps:
- **Methods:** add_check, add_data, add_label, add_break, add_view, add_help_button, add_dropdown_button, get_form_values, get_title_area, get_main_icon, get_empty_state, get_inner_group_button, get_or_add_inner_group_button, load_lib, show_icon_group, set_primary_action_options, set_action, clear_action_of, btn_disable_enable, restyle_field, prepare_shortcut_obj, build_dropdown_options, build_inner_group_options, clear_btn_group, destroy_group_dropdowns, clear_mobile_custom_groups, get_icon_label, make, setup_page, add_main_section, setup_awesomebar.
- **Properties:** indicator, footer, icon_group, inner_toolbar, actions, actions_btn_group, btn_primary_menu, buttons, views, current_view, breadcrumbs, $breadcrumbs, menu_dropdown, primary_action_dropdown, skip_link_to_main, hide_mobile_nav.
- **Options, never read back as `page.x`:** parent, single_column, sidebar_position, icon, required_libs, make_page, card_layout, page_name.

### 2. Representative call sites (file:line)

Paths are relative to `apps/`.

| member | examples |
|---|---|
| add_menu_item | frappe/public/js/frappe/views/kanban_v2/kanban_page.js:642 `const $save = page.add_menu_item(...)` then `$save.toggle`; frappe/core/page/dashboard_view/dashboard_view.js:341 `this.refresh_all_item = ...` then `.toggle(false)` at :232; toolbar.js `add_menu_item(...).parent().addClass("hidden-xl")` |
| add_inner_button | erpnext/accounts/report/accounts_payable/accounts_payable.js:200 `report.create_pe_btn = report.page.add_inner_button(...).toggle(false)`; frappe/public/js/frappe/views/reports/query_report.js:281,291 (stored, then `.remove()`); frappe/public/js/frappe/form/form.js:1945 (`frm.add_custom_button` wraps it and stores the result in `frm.custom_buttons[label]`) |
| set_inner_btn_group_as_primary | erpnext/buying/doctype/purchase_order/purchase_order.js:341,430; erpnext/buying/doctype/request_for_quotation/request_for_quotation.js:151 (ERPNext only, 19 files) |
| add_action_item | erpnext/support/doctype/issue/issue_list.js:8; frappe/contacts/doctype/contact/contact_list.js:10; frappe/public/js/frappe/form/workflow.js:22 |
| set_primary_action | erpnext/accounts/doctype/chart_of_accounts_importer/chart_of_accounts_importer.js:144 `.set_primary_action(...).addClass("btn btn-primary")`; frappe/public/js/frappe/list/list_view.js:542 `.attr("title").tooltip()`; query_report.js:1077 (stored, then `.is` / `.prop`) |
| main | erpnext/stock/page/warehouse_capacity_summary/warehouse_capacity_summary.js:105 `page.main.on("click", 'a[data-type=..]')`; frappe/printing/page/report_print/report_print.js:95 `page.main.html(...)`, :100 `.find(...)`; frappe/core/doctype/data_import/data_import.js:1086 `$main = frm.page.main` then `.closest(".layout-main-section-wrapper").addClass` |
| wrapper | frappe/core/doctype/doctype_layout/doctype_layout.js:6 `frm.page.wrapper.addClass(...)`; erpnext/stock/page/stock_balance/stock_balance.js:46 `page.wrapper.find(".page-form")`; query_report.js:136 `.on("click","[data-action]")`; erpnext/manufacturing/page/production_plan_visualizer/production_plan_visualizer.js:36 `$(page.wrapper).addClass().find(".page-head").css()` |
| fields_dict | erpnext/crm/doctype/opportunity/opportunity_list.js:21-22 `listview.page.fields_dict.opportunity_from.get_query = fn`; erpnext/projects/doctype/task/task_tree.js:79 `.page.fields_dict.project.get_value()`; kanban_page.js:721 |
| btn_primary | erpnext/selling/doctype/proforma_invoice/proforma_invoice.js:6 `frm.page.btn_primary.toggle(..)`; frappe/desk/doctype/system_console/system_console.js:8 `.trigger("click")`; frappe/public/js/frappe/desk.js:489 `.is(":visible")` |
| btn_secondary | erpnext/selling/page/point_of_sale/pos_controller.js:261 `.get(0).innerText = ...`; frappe/public/js/frappe/form/workflow.js:155 `.addClass("hide")`; query_report.js:859 `.prop("disabled")` |
| sidebar | erpnext/manufacturing/doctype/bom_creator/bom_creator.js:27 `frm.page.sidebar.toggle(false)`; frappe/core/doctype/recorder/recorder_list.js:5 `listview.page.sidebar.remove()`; frappe/website/doctype/web_form/web_form.js:930 `.toggleClass(...)` |
| body | frappe/desk/page/desktop/desktop.js:77 `.find(...)`; frappe/desk/page/backups/backups.js:44 `appendTo(page.body.addClass("no-border"))`; erpnext/manufacturing/page/bom_comparison_tool/bom_comparison_tool.js:59 (passed as `body:`) |
| $title_area | frappe/core/page/component_explorer/component_explorer.js:2964 `.find().remove()`; base_list.js:203; frappe/public/js/frappe/form/toolbar.js:79 `.toggleClass` |
| page_form | frappe/public/js/frappe/views/treeview.js:159 `.removeClass("row").addClass("flex")`; kanban_page.js:79-83 (`appendTo(page.page_form)`) |
| add_field | frappe/core/page/permission_manager/permission_manager.js:45,62 (`.get_value` / `.set_value`); erpnext/stock/page/stock_balance/stock_balance.js:9-33 (stored as `page.item_field`, etc.); erpnext/selling/page/sales_funnel/sales_funnel.js:32 |
| set_indicator / clear_indicator | erpnext/selling/page/point_of_sale/pos_controller.js:644; frappe/core/doctype/rq_job/rq_job_list.js:28; erpnext/accounts/doctype/bank_statement_import/bank_statement_import.js:130 |
| set_title | erpnext/manufacturing/doctype/bom/bom_tree.js:44; frappe/custom/doctype/customize_form/customize_form.js:109; frappe/desk/doctype/todo/todo_list.js:6 |
| current_view_name / previous_view_name / set_view | erpnext/accounts/doctype/sales_invoice/sales_invoice.js:293; frappe/printing/page/print/print.js:899-903 |
| add_custom_button_group + add_custom_menu_item | erpnext/public/js/financial_statements.js:358-376 (the group's return value is the `parent` argument) |

### 3. Summary of how results are used, for app code (frappe app JS + ERPNext)

- **(a) Called only**, never touching the return value: set_inner_btn_group_as_primary 27, add_action_item 28, set_indicator 16, set_breadcrumbs 8, clear_* about 25, set_title 6, add_inner_button 44 of 45. Most app sites are like this.
- **(b) Own API:** fields_dict 16 (control API: get_value, set_value, `get_query =`, df, $wrapper); add_field results stored and used as Controls 11; the add_custom_button_group result passed to add_custom_menu_item 1.
- **(c) jQuery on returned values or fields reached directly:**
  - main, body and wrapper: 29 app sites, using find, on, html, addClass, closest, append.
  - btn_primary and btn_secondary: 17 app sites, using toggle, trigger, hide, addClass, prop, get(0).innerText.
  - sidebar: 7 app sites, using toggle, remove, toggleClass, addClass.
  - $title_area: 3; page_head: 1.
  - Values returned from methods: `add_inner_button(...).toggle`, `set_primary_action(...).addClass("btn btn-primary")`, `add_button(...).hide()`, `add_action_icon` results `.remove()`.
- **Values handed onward as jQuery parents:** main, body and page_form are passed as `parent:` to ItemDashboard, SortSelector, BOM tools and the explorer; menu as `parent:` to add_dropdown_item; custom_actions as a prependTo target.

### 4. Off-class state apps depend on

**Expando writes and reads on the Page instance (ERPNext, about 55 sites).** stock_balance.js and warehouse_capacity_summary.js store `page.start`, `page.item_dashboard`, `page.capacity_dashboard`, `page.item_field`, `page.warehouse_field`, `page.item_group_field`, `page.parent_warehouse_field`, `page.company_field` and `page.sort_selector`, then read them back. The Page object must therefore stay a plain extensible object: no freezing, and no Proxy that rejects unknown keys. `$.extend(this, opts)` also means any constructor option becomes a property.

**The `wrapper.page` chain.** A DOM element carries a `.page` property, and Page instances are registered in `frappe.ui.pages[route]`:
- erpnext/selling/page/point_of_sale/ passes `cur_page.page.page` (7 sites: pos_item_cart.js:267,284; pos_payment.js:449; pos_item_selector.js:441,450; pos_past_order_summary.js:275,291) as `page:` to `frappe.ui.keys`. keyboard.js:57 then calls `page.wrapper.is(":visible")`, and alt_keyboard_shortcuts.js:94 calls `$.contains(cur_page.page.page.wrapper[0], ...)`. So `page.wrapper` must stay a jQuery object.
- sidebar.js:324 reads `frappe.container.page.page`.
- container.js:104 reads `frappe.ui.pages[route].single_column`.
- `set_action` uses the Page instance itself as a shortcut-group key.

**DOM-element expandos (container element, not Page).** `frappe.container.page.save_action`: data_import.js:1442 writes it and desk.js:491-492 calls it.

**Static.** `frappe.ui.Page.title_action` is assigned in mobile_nav.js:47.

**Dead or missing.**
- form/toolbar.js:321 calls `this.page.add_dropdown(label)`, which does not exist on Page. Its only caller, `get_dropdown_menu`, has no callers.
- user_image.js:57 calls `frm.page.close_sidebar?.()`, an optional method Page does not define.

### 5. DOM reached by selector from outside page.js and page.html, category (d)

Sites that use page-chrome class names (JS only; CSS-in-JS listed separately):

| selector | frappe sites | ERPNext sites | examples |
|---|---|---|---|
| .layout-main-section | 4 | 3 | frappe/printing/page/print_format_builder/print_format_builder.js:33; frappe/workflow/page/workflow_builder/workflow_builder.js:21; workspace.js:119; workspace/blocks/shortcut.js:39 (global `$(...)[0].offsetWidth`); erpnext/selling/page/point_of_sale/pos_controller.js:3; erpnext/manufacturing/page/shop_floor/shop_floor.js:11; erpnext/manufacturing/page/visual_plant_floor/visual_plant_floor.js:9 |
| .layout-main-section-wrapper | 4 | 1 | file_view.js:21, image_view.js:62, dashboard_view.js:51 (addClass); data_import.js:1090 (closest().addClass); erpnext/selling/page/sales_funnel/sales_funnel.js:12 |
| .layout-main | 4 | 3 | frappe/public/js/frappe/form/sidebar/attachments.js:189,535; list_view.js:151,157 (hide/show); sales_funnel.js:11,45; erpnext/public/js/stock_analytics.js:8 (as `parent`) |
| .layout-side-section | 1 | 0 | container.js:110 (`.page-container[data-page-route] .layout-side-section`) |
| .page-content | 3 | 0 | list_view.js:149 (append skeleton); pageview.js:143; frappe/core/page/dashboard_view/dashboard_view.js:36 |
| .page-head | 6 (+1 web template) | 1 | form/layout.js:641, form/controls/date.js:327, utils/common.js:141, utils/utils.js:430 (global height and rect reads); workspace.js:1023; mobile_nav.js:56 (delegated `.page-head .page-back-button`); erpnext production_plan_visualizer.js:36 (`.css`) |
| .page-head-content | 2 | 0 | list_view.js:537 (`[0]`); query_report.js:2469 (global removeClass) |
| .page-form | 1 | 2 | query_report.js:2471; erpnext stock_balance.js:46 and warehouse_capacity_summary.js:64 (`page.wrapper.find(".page-form")` as SortSelector parent) |
| .navbar-breadcrumbs | 1 | 0 | form.js:838 |
| .page-actions / .standard-actions / .primary-action | 2 | 0 | ui/find.js:3 `$(".page-actions:visible .primary-action")`; form_tour.js:288 `.standard-actions .primary-action` |
| .page-container | 1 | 0 | container.js:110 |
| CSS-in-JS hooking page chrome | 1 | 4 | doctype_layout.js:11-12 (`.layout-side-section`, `.layout-main-section-wrapper`); erpnext shop_floor.js:1645-1647 (`.page-head`, `.layout-main-section`, `.layout-main-section-wrapper`); production_plan_visualizer.js:1315 (`.ppv-page .page-form`) |

**Totals for (d):** about 30 frappe JS sites and 10 ERPNext JS sites, plus 5 CSS rules. One frappe-pattern hit is from a web template (templates/includes/list/list.js:41), not desk.

These selectors were checked and have **no outside sites**: .title-area, .page-indicator-pill, .menu-btn-group, .actions-btn-group, .secondary-action, .primary-action-menu, .page-icon-group, .custom-mobile-actions, .inner-page-message, .page-only-label, .title-icon, .page-body, .page-toolbar, .page-wrapper, .workflow-button-area. The `.custom-actions` / `.standard-actions` matches in dialog.js and form_timeline.js, and the `.inner-group-button` matches in list_view rows, are unrelated markup.

### 6. Limits of the count

- Aliases that do not end in `page` are not followed, for example `const p = this.page`.
- Stored-variable tracking misses `?.` member access and uses in other files; known extra uses were added by hand in the table.
- "No call sites" covers only frappe and ERPNext, not third-party apps.
- This frappe tree is the in-progress branch: page.js already uses es-button and Dropdown internally. Counts are of callers, which the port does not change.

## Top risks

- Raw jQuery fields are reached directly by apps: main/body/wrapper (29 app sites; find/on/html/addClass/closest), btn_primary/btn_secondary (17; toggle/trigger/hide/prop/get(0).innerText), sidebar (7; toggle/remove/toggleClass), $title_area and page_head. The compat Page must keep these as live jQuery objects wrapping the real rendered nodes, not stubs.
- Return values are jQuery and callers mutate them: add_inner_button(...).toggle/remove, set_primary_action(...).addClass('btn btn-primary')/.attr().tooltip(), add_button(...).hide/toggle/text/remove, add_action_icon(...).remove/css/addClass/attr or used as a Dropdown trigger, add_menu_item(...).parent().addClass/toggle/text, set_secondary_action(...).prop().wrap().parent(). Returned elements must stay real DOM nodes that the Vue render keeps and does not re-create.
- About 40 JS sites (30 frappe, 10 ERPNext) plus 5 CSS-in-JS rules use page-chrome class names directly: .layout-main-section, .layout-main-section-wrapper, .layout-main, .page-content, .page-head, .page-head-content, .page-form, .navbar-breadcrumbs, .page-actions .primary-action, .page-container .layout-side-section. Keep these class names and their nesting in the Vue template.
- ERPNext stores its own expando properties on the Page instance (about 55 sites in stock_balance and warehouse_capacity_summary: page.item_dashboard, page.item_field, page.start and others), and $.extend(this, opts) copies every constructor option onto it. Page must remain a plain mutable object: no frozen reactive proxy and no strict Proxy.
- Page identity chain: DOM wrapper.page is the Page; cur_page.page.page is handed to frappe.ui.keys by ERPNext POS (7 sites); keyboard.js and alt_keyboard_shortcuts.js call page.wrapper.is(':visible') and page.wrapper[0]; frappe.ui.pages[route].single_column and frappe.container.page.page are read; the Page instance is a shortcut-group key. All of these must keep working.
- ERPNext depends on specific methods: set_inner_btn_group_as_primary (27 sites, 19 files, ERPNext only), add_action_item (27), add_inner_button with groups (34), and fields_dict.<f>.get_query= / get_value (15, list and tree views). Their behaviour (group dropdown store, primary styling, mobile menu mirroring) must match.
- Usage is concentrated: 74 of 130 members are used, and only 43 by app code. The other 56 (add_check/add_data/add_label/add_view/get_form_values/load_lib/footer/indicator/icon_group/inner_toolbar/views/…) have no frappe or ERPNext callers but may be used by third-party apps. Keep them as thin shims rather than deleting them. form/toolbar.js:321 calls page.add_dropdown, which does not exist (dead code).
