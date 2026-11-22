# Where Frappe exposes jQuery nodes

## Scope

This is a census of every place where Frappe hands a jQuery object, a DOM element, or HTML meant for the DOM to code outside the module that created it. For each place it also records who uses it.

**Code read**
- **Frappe** develop @ `7cc7280b56`: the framework under `apps/frappe/frappe/public/js/frappe/**`, plus app code outside it (doctype, page, report, website and printing JS).
- **ERPNext** develop @ `07f8793`: about 706 JS files, plus `.vue` and `.scss` files where they reach Frappe DOM.
- **Excluded:** node_modules, dist, `*.min.js`, studio assets, our own `vue_first*` experiment, and ERPNext's built `public/banking/assets`.
- **Coverage:** 9 inventory agents each covered one area and together read about 330 files closely. Large internal files were grep-scanned only. A completeness critic then re-read 28 files to fill gaps and correct counts. Its corrections are applied here and called out in the Disagreements section.

**Path shorthand used below**
- A bare path such as `form/form.js:141` is under `frappe/public/js/frappe/`.
- `pjs:` is `frappe/public/js/` (bundles outside `frappe/`).
- `fr:` is Frappe app code under `apps/frappe/frappe/`.
- `erp:` is under `apps/erpnext/erpnext/`.

**What counts as a surface**
- (a) A property on a reachable object that holds a node, including properties that one class sets on another's object.
- (b) A return value that is a node.
- (c) A callback or event argument that is a node.
- (d) DOM class or attribute vocabulary that outside code actually queries.
- (e) A global that holds nodes.

Three related kinds are also recorded:
- **html_string:** helpers and hooks whose output or input is HTML that public callers insert.
- **inbound:** helpers that write into a node the caller passes in. These matter as much as outbound handouts, because once the caller's node is Vue-owned the framework mutates it behind Vue.
- **document-level jQuery events** that carry no node.

**How consumers were counted**
- rg was not available, so counts come from `grep -nE` over file lists. They count matching call-site lines outside the owning file or module, not files.
- Generic names (`wrapper`, `body`, `$wrapper`, `page`, `row`) were qualified by the receiver (`frm.`, `dialog`/`d`, `listview.`, `grid.`) and by reading the context.
- "fr" counts include framework modules outside the owner (for example list views writing into `page.main`). Where the split between framework and app code matters, the row says so.
- Return-value use was checked with paren-matching scripts that look for assignment, chaining or passing the result on.
- Most counts are about ±10%. Rows marked approx. are rougher. Dialog member counts are lower bounds, because only receivers named `d`, `dialog`, `dlg` and similar were matched.

**Caveats**
- **Third-party apps were not seen.** A count of 0 means "free to change for Frappe and ERPNext", not free in general.
- Code stored in the database is invisible to grep: Client Scripts, Web Form client scripts, Custom HTML Block scripts and island components named in documents. Treat 0 counts on `frappe.web_form`, `root_element` and widget islands as lower bounds.
- Cypress tests were not searched.
- **The totals add up per-surface counts that overlap**, so they are a heat map, not a deduplicated call-site count. For example, `frm.add_custom_button` returns the same node as `page.add_inner_button`; `frm.fields_dict` writes are also counted under control `$wrapper`; and tree-node callbacks are counted under both `frappe.ui.Tree` and TreeView.
- Exact duplicates (same owner and member) found by two agents were merged into one row, keeping the larger counts. Each merge is noted in that row.

## Summary per area

Buckets A to E are defined in [Buckets](#buckets).

| Area | Surfaces | With ≥1 outside consumer | Frappe consumers (lines) | ERPNext consumers (lines) | A | B | C | D | E |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| form-core (form.js, layout, section, column, tab, dashboard, toolbar...) | 55 | 32 | 545 | 939 | 2 | 14 | 13 | 23 | 3 |
| form-controls (form/controls/*) | 34 | 26 | 432 | 193 | 3 | 12 | 10 | 8 | 1 |
| form-grid (grid, grid_row, grid_row_form, pagination, grid_import) | 32 | 19 | 96 | 60 | 1 | 6 | 8 | 13 | 4 |
| form-footer-sidebar (footer/, sidebar/, templates/) | 37 | 18 | 33 | 27 | 1 | 7 | 6 | 19 | 4 |
| ui-page-dialog (page, dialog, field_group, messages, slides, tree, filters...) | 61 | 48 | 479 | 179 | 9 | 31 | 6 | 13 | 2 |
| ui-rest (desk shell, toolbar, sidebar, dock, panels, settings dialog, chart...) | 42 | 23 | 120 | 19 | 10 | 3 | 8 | 19 | 2 |
| list (list/*) | 32 | 20 | 140 | 69 | 2 | 8 | 9 | 12 | 1 |
| views (container, pageview, query_report, treeview, gantt, kanban...) | 41 | 27 | 159 | 239 | 4 | 5 | 15 | 14 | 3 |
| misc (widgets, utils, dom, web_form, data_import, pickers, bundles) | 52 | 31 | 623 | 114 | 11 | 1 | 15 | 21 | 4 |
| critic additions (ui/components, ui/island, builders, print page, SCSS) | 19 | 19 | 584 | 271 | 3 | 3 | 11 | 0 | 2 |
| **Total** | **405** | **263** | **3211** | **2110** | **46** | **90** | **101** | **142** | **26** |

What the table shows:
- **142 of 405 surfaces (35%) have no outside consumer** in Frappe or ERPNext.
- **ERPNext's 2110 lines are concentrated.** `frm.add_custom_button` (447) and `frm.fields_dict` (351) are 38% of them. The next largest are dialog `fields_dict` (140), the control `$wrapper`/`wrapper`/`$input` family (124), report formatters (66) and the list page (42).
- **The ui-rest shell is almost invisible to ERPNext** (19 lines in total).

## Top surfaces by use

These are the 30 surfaces with the most consumers (Frappe + ERPNext). There is a tie at 37 for 30th place: `frappe.ui.empty_state()` (31/6) ties with `frm.dashboard.set_headline*` and only one fits. "Read-only" and "write-into" describe what callers do to the node. Seven of the top 30 hand out no node at all (they are strings or objects), so their columns say so.

| # | Surface | fr/erp | Bucket | Read-only use | Write-into use |
|---:|---|---|---|---|---|
| 1 | `frm.add_custom_button()` return (node from `page.add_inner_button`) | 144/447 | B | most callers ignore the return; .prop reads | 3 fr + 4 erp keep `$btn` for later .toggle/.addClass/.remove/.prop('disabled') |
| 2 | `frm.fields_dict` / `frm.get_field()` map | 204/351 | C | map lookup; most calls are get_value/set_df_property | node writes go through control members (rows 5, 7, 16): html/empty/append into `.wrapper`/`$wrapper` (fr ~78, erp ~63 lines) |
| 3 | `frappe.utils.icon()` (html_string) | 362/30 | C | n/a (string) | inserted with .html/append/templates |
| 4 | `dialog.fields_dict` / `dialog.get_field()` (FieldGroup/Dialog) | 157/140 | C | get_value/set_value | `$wrapper.html/empty/append/hide`, `$input.on`, `wrapper.closest().hide()` (fr 59 / erp 61 lines reach a node) |
| 5 | Control `$wrapper` | 155/70 | A | find(.control-input/.clearfix/input), closest, is(:visible), [0] | html, empty, append into, detach, remove, replaceWith, hide/show/toggle, addClass(has-error), css, on |
| 6 | `frappe.ui.button()` / `.html()` / `.dress()` | 147/17 | B | — | append the returned button; dress re-classes nodes it is given (e.g. `page.btn_primary`) |
| 7 | Control `$input` | 84/27 | B | val read, attr, parents, get(0) | on(change/input/focus/keydown), trigger, val write, addClass/css, prop(disabled), wrap() |
| 8 | `frappe.format` / `frappe.form.formatters` outputs (html_string) | 51/49 | C | n/a | inserted into DOM/DataTable |
| 9 | `listview.page` (Page handed to listview_settings) | 30/42 | C | — | mostly the Page API (add_action_item ×25 erp); `page.sidebar.remove()`, appendTo(page.sidebar) |
| 10 | Query-report `formatter` output (html_string) | 1/66 | C | n/a | often `$('<span>').css(...)` then outerHTML |
| 11 | `frappe.ui.form.make_control()` return | 40/24 | C | object handle | callers then use `$wrapper`/`$input` (counted in rows 5 and 7) |
| 12 | `frappe.pages[label]` page element | 47/15 | A | `$(wrapper).find('.layout-main-section')` | make_app_page({parent}); expandos; find(...).addClass/append; on('show'/'hide'); delete |
| 13 | `frappe.ui.badge()` | 33/29 | C | — | caller appends the returned badge |
| 14 | Dialog `$body` / `body` | 50/10 | A | find | html(), empty().append, append, appendTo, delegated on, setup_search |
| 15 | `frappe.render_template` / `frappe.render` (html_string) | 47/13 | C | n/a | `.html(render_template(...))` |
| 16 | Control `wrapper` (element) | 33/27 | A | raw element passed to charts/DataTable | `$(w).empty/html/append/addClass/hide` |
| 17 | Interactive `frappe.ui` components (Combobox, Popover, Tabs, TabButtons...) | 54/4 | C | — | caller appends the returned trigger |
| 18 | Static `frappe.ui` components (skeleton, avatar, alert, progress, stat_card...) | 45/9 | C | — | append / html insertion |
| 19 | Control selector vocabulary (`.frappe-control[data-fieldname]`, `.control-input`, `.clearfix` ...) | 30/20 | E | `input[data-fieldname=x]` val | `.clearfix` hide, css, append into `.control-input`, removeClass |
| 20 | Dialog `$wrapper` | 38/11 | B | find, data('bs.modal'), css('z-index') read | addClass, on(hide.bs.modal/keydown), css, remove |
| 21 | `frappe.utils.bold` / `get_form_link(html)` / `desktop_icon` / `flag` / `app_logo` (html_string) | 36/12 | C | n/a | inserted |
| 22 | `page.main` / `page.body` | 40/7 | A | find, get(0) | appendTo, html, empty().html, delegated on, addClass, css, prepend |
| 23 | `dialog.get_primary_btn()` and other button getters | 38/9 | B | — | prop(disabled), attr(data-theme), text/html(label), trigger(click), addClass(hide), unbind().click |
| 24 | `listview_settings.onload(listview)` | 23/24 | C | — | Page API; `standard_filters_wrapper.find().append` |
| 25 | `frappe.ui.toast()` handle | 42/4 | C | handle.$el never touched | — |
| 26 | `page.html` selector vocabulary (`.layout-main-section`, `.page-head`, `.layout-main`, `.page-form` ...) | 30/12 | E | `$('.page-head').height()` | mount into `.layout-main-section`, addClass, css |
| 27 | `frm.page` node members (`btn_primary`, `wrapper`, `main`, `sidebar`, `$title_area`) | 22/17 | B | wrapper.find | btn_primary/btn_secondary addClass/hide/text |
| 28 | `frappe.dom.freeze` / `#freeze` | 21/18 | C | callers only call freeze/unfreeze | — |
| 29 | `frm.wrapper` | 25/13 | B | find().is/prop | on/off/trigger custom events, native dispatchEvent |
| 30 | `frm.dashboard.set_headline*` / `add_comment` (html input; return ignored) | 27/10 | C | — | — (the HTML string is passed in) |

**The ten node surfaces that matter most** (strings and object handles left out):
1. `frm.add_custom_button` / `page.add_inner_button` `$btn`
2. Control `$wrapper`
3. Control `$input`
4. `frappe.pages[x]` / `on_page_load(wrapper)`
5. Dialog `$body`
6. Control `wrapper`
7. Dialog `$wrapper`
8. `page.main`
9. Dialog button getters
10. `frm.wrapper`

## Buckets

Each surface is in exactly one bucket. The rules were applied in this order:
1. **D:** 0 outside consumers in Frappe and ERPNext (CSS-only use inside Frappe's own SCSS also counts as 0). D comes first so that it lists everything we are free to change.
2. **E:** selector or class vocabulary that outside JS or SCSS queries.
3. **A, B or C:** decided by what the callers do.

| Bucket | Definition | Count |
|---|---|---:|
| **A. Mount point** | Callers own the contents. They `.html()`, `.empty()` or `.append()` their own markup into the node: an HTML-field wrapper, `page.main`, the `on_page_load` wrapper, `dialog.$body`, `SettingsDialogPanel.body`. This also covers **inbound** surfaces where the roles are swapped (the caller passes its node and the framework fills it), because the contract is the same: one side creates the element, the other side owns everything inside it. | **46** |
| **B. Decorated handle** | A node that the framework renders and keeps managing, which callers restyle, rebind, relabel, hide or remove: `add_inner_button` `$btn`, `btn_primary`, `$input`, `frm.wrapper` as an event bus, section wrappers, `dialog.$wrapper`. **This is where Vue and jQuery conflict:** both sides touch the same element's classes, attributes, listeners or label. | **90** |
| **C. Read-only / non-node contract** | Callers only find, read, val, attr or measure, or the surface carries no node in practice. This includes events listened to with no node payload, object handles used only through methods, returns that callers ignore, and HTML-string helpers and hooks (strings are safe to keep as strings). | **101** |
| **D. Internal / unused outside** | 0 outside consumers in Frappe and ERPNext. Free to change, except for third-party apps. | **142** |
| **E. Global selector vocabulary** | DOM classes or attributes that callers query with `$(sel)`, `find(sel)`, `closest(sel)` or SCSS. | **26** |

### Every B surface, with consumer examples

| Area | Surface | fr/erp | What callers do | Examples |
|---|---|---|---|---|
| form-core | `frm.wrapper` | 25/13 | jQuery/native event bus, find reads | fr:core/doctype/data_import/data_import.js:969; erp:projects/doctype/project/project.js:115 |
| form-core | `frm.$wrapper` | 0/2 | delegated on(click) | erp:public/js/utils/barcode_scanner.js:596; erp:manufacturing/doctype/bom/bom.js:427 |
| form-core | `frm.page` node members | 22/17 | btn_primary/secondary addClass/hide/text; wrapper.find | erp:public/js/controllers/transaction.js; fr:core/doctype/doctype/doctype.js |
| form-core | `frm.form_wrapper` | 8/0 | add/remove/toggleClass, hide/show, find('.form-message') | fr:core/doctype/doctype/doctype.js:133; fr:website/doctype/web_form/web_form.js:51 |
| form-core | `frm.layout.wrapper` | 2/1 | hide/show; find(sel).parent().remove() | fr:core/doctype/data_import/data_import.js:1094; erp:public/js/controllers/transaction.js:3544 |
| form-core | `layout.message` | 2/0 | .empty() then show_message | fr:workflow/doctype/workflow/workflow.js:8; fr:desk/doctype/workspace/workspace.js:22 |
| form-core | `layout.sections` / `sections_dict` | 6/0 | head.find().before(count), collapse | fr:core/doctype/data_import/data_import.js:420; form/form_tour.js:33 |
| form-core | Section `wrapper` (via fields_dict) | 1/3 | find('.section-body').prepend, add/removeClass | fr:core/doctype/security_settings/security_settings.js:6; erp:buying/doctype/purchase_order/purchase_order.js:286 |
| form-core | Section `head` | 3/0 | find().before($count), addClass(hide) | fr:core/doctype/data_import/data_import.js:431; web_form/web_form.js:94 |
| form-core | Section `row.wrapper` (legacy alias) | 0/2 | toggle | erp:public/js/utils/sales_common.js:432 |
| form-core | Dashboard area Sections (progress/stats...) | 2/1 | find('.progress-bar') style, stats_area.show | fr:core/doctype/background_task/background_task.js:47; erp:public/js/utils.js:282 |
| form-core | `dashboard.stats_area_row` | 0/3 | addClass(flex), css, appendTo own indicators | erp:public/js/utils.js:283, :313 |
| form-core | `frm.add_custom_button()` return | 144/447 | keep $btn, toggle/addClass/remove/prop | fr:email/doctype/email_account/email_account.js:315; erp:stock/doctype/pick_list/pick_list.js:279 |
| form-core | `frm.web_link` | 0/1 | closest('.user-action-row').remove() | erp:projects/doctype/project/project.js:105 |
| controls | Control `tooltip` | 3/0 | remove, addClass(hidden) | form/doctype_settings/tabs/settings_map.js:138 |
| controls | Control `$input` | 84/27 | events, val, attr, css, prop, wrap | form/grid_row.js:1592; erp:selling/page/point_of_sale/pos_item_selector.js:345 |
| controls | Control `input` | 8/4 | .disabled=, onclick=, addEventListener | views/reports/query_report.js:941; erp:public/js/sms_manager.js:91 |
| controls | `disp_area` | 9/1 | innerHTML write, toggleClass | fr:custom/doctype/custom_field/custom_field.js:82; erp:public/js/telephony.js:12 |
| controls | `input_area` | 4/1 | hide, addClass | doctype/index.js:151; erp:stock/doctype/item/item.js:1530 |
| controls | `$input_wrapper` | 2/0 | append | doctype/index.js:157; fr:core/doctype/file/file.js:50 |
| controls | `awesomplete` (+ `.ul`) | 4/6 | close/evaluate; $(ul).css | form/grid.js:185; erp:selling/page/point_of_sale/pos_item_selector.js:299 |
| controls | Attach `$value` | 4/0 | hide | pjs:data_import_wizard.bundle.js:796 |
| controls | `$.fn.add_options` | 9/1 | empty().add_options() on framework selects | ui/page.js:1204; erp:public/js/setup_wizard.js:226 |
| controls | MultiCheck `$checkbox_area` | 1/0 | css | fr:printing/page/report_print/report_print.js:232 |
| controls | MultiSelectPills `$multiselect_wrapper` | 10/0 | delegated on, hasClass, removeClass | views/communication.js:871 |
| controls | ERPNext ControlData override (global class) | 1/1 | subclass; append phone button into .control-value | erp:public/js/telephony.js:1, :24 |
| grid | `grid.wrapper` | 6/7 | find(.grid-row[data-name]), delegated on, toggleClass, text on label | fr:core/doctype/recorder/recorder.js:30; erp:manufacturing/doctype/work_order/work_order.js:139 |
| grid | `grid.parent` | 1/0 | find('.grid-row-check').remove/replaceWith | fr:core/doctype/installed_applications/installed_applications.js:64 |
| grid | `grid.grid_buttons` | 0/1 | hide | erp:manufacturing/doctype/work_order/work_order.js:543 |
| grid | GridRow `row` | 5/0 | css, add/removeClass(highlight) | fr:custom/doctype/customize_form/customize_form.js:43; ui/side_panel.js:682 |
| grid | GridRow `columns[f]` | 5/0 | css, toggleClass, field_area.empty + make_control | fr:core/doctype/recorder/recorder.js:73; fr:core/doctype/data_import/data_import.js:1882 |
| grid | `grid-row-render` event (GridRow arg) | 1/1 | write into row.row css/class | fr:custom/doctype/customize_form/customize_form.js:38; erp:public/js/controllers/accounts.js:13 |
| footer-sidebar | `frm.footer.wrapper` | 3/0 | hide/show/toggle | fr:core/doctype/doctype/doctype.js:132; fr:website/doctype/web_form/web_form.js:50 |
| footer-sidebar | `frm.timeline.wrapper` | 0/6 | find, prepend button into .actions, delegated click, data() | erp:support/doctype/issue/issue.js:88, :99 |
| footer-sidebar | timeline_actions_wrapper (by selector) | 0/1 | global .btn-default hide | erp:public/js/utils/crm_activities.js:23 |
| footer-sidebar | `frm.sidebar.sidebar` | 2/3 | parent().toggle; insertAfter own section | form/toolbar.js:540; erp:setup/doctype/employee/employee.js:147 |
| footer-sidebar | `sidebar.add_user_action()` return | 4/2 | attr(href/target), on(click), closest().remove() | form/form.js:1684; erp:projects/doctype/project/project.js:105 |
| footer-sidebar | `sidebar.image_wrapper` | 0/1 | find('.sidebar-image').attr(src) | erp:manufacturing/doctype/workstation/workstation.js:9 |
| footer-sidebar | `attachments.attachment_preview` | 4/0 | addClass, off/on, attr(data-docname), remove | form/upload_first_review.js:85; views/formview.js:155 |
| page-dialog | `page.wrapper` | 22/6 | addClass, on/off(hide), find, prop(inert), is(:visible) | fr:core/doctype/doctype_layout/doctype_layout.js:6; erp:stock/page/stock_balance/stock_balance.js:46 |
| page-dialog | `page.container` | 7/0 | find, append skeleton, hide/show .layout-main | list/list_view.js:137 |
| page-dialog | `page.page_actions` | 2/0 | prependTo target | form/form.js:171 |
| page-dialog | `page.page_head` | 1/0 | hide | fr:desk/page/desktop/desktop.js:71 |
| page-dialog | `page.btn_primary` / `set_primary_action()` return | 12/11 | hide/show/toggle, trigger, addClass, prop(disabled), btn: freeze | desk.js:490; erp:accounts/doctype/chart_of_accounts_importer/chart_of_accounts_importer.js:122 |
| page-dialog | `page.btn_secondary` | 4/6 | hide, addClass, prop, `.get(0).innerText =` | form/workflow.js:155; erp:selling/page/point_of_sale/pos_controller.js:261 |
| page-dialog | `page.menu` / `actions` store | 7/0 | passed as parent, children().filter | form/toolbar.js:34; list/base_list.js:282 |
| page-dialog | `add_menu_item`/`add_action_item`/... return | 10/0 | parent().addClass, toggle, text | list/base_list.js:262; form/toolbar.js:503 |
| page-dialog | `page.add_inner_button()` return | 3/1 | stored, toggle/addClass/prop | views/reports/query_report.js:281; erp:accounts/report/accounts_payable/accounts_payable.js:200 |
| page-dialog | `page.add_button()` return | 4/0 | toggle/hide/text | pjs:workflow_builder/workflow_builder.bundle.js:37 |
| page-dialog | `page.add_action_icon()` return | 7/1 | css, hide/show | form/toolbar.js:222; erp:manufacturing/doctype/bom_creator/bom_creator.js:96 |
| page-dialog | `page.add_custom_button_group()` return | 1/1 | passed back as parent; parent().attr | list/list_view_select.js:566; erp:public/js/financial_statements.js:358 |
| page-dialog | `standard_actions`/`custom_actions`/`menu_btn_group`... | 8/0 | show/hide, prependTo, addClass | views/reports/query_report.js:262 |
| page-dialog | `page.page_form` | 20/0 | removeClass(row).addClass(flex), appendTo, css | list/base_list.js:183; views/treeview.js:159 |
| page-dialog | `page.$title_area` | 9/0 | find().remove, prepend, toggleClass, parent().css | fr:core/page/component_explorer/component_explorer.js:3087; form/form.js:838 |
| page-dialog | `page.$sub_title_area` | 2/0 | css, on(click) | form/toolbar.js:63 |
| page-dialog | `is_in_group_button_dropdown` and other misc Page returns | 1/0 | .remove() | form/form.js:1969 |
| page-dialog | Dialog `$wrapper` | 38/11 | addClass, on(bs events), find().css/on, remove, css(z-index) | views/communication.js:222; erp:public/js/shop_floor/shop_floor.js:776 |
| page-dialog | Dialog `wrapper` (element **or** jQuery) | 7/1 | classList, $(w).addClass/find, w.find().click() | request.js:674; erp:selling/doctype/sales_order/sales_order.js:1829 |
| page-dialog | Dialog header/footer/custom_actions | 13/1 | footer prepend html, custom_actions appendTo, header find(.indicator) | form/grid_import.js:159; erp:public/js/call_popup/call_popup.js:31 |
| page-dialog | Dialog button getters / set_*_action return | 38/9 | prop, attr, text/html, trigger, addClass(hide) | desk.js:488; erp:stock/doctype/item/item.js:1285 |
| page-dialog | `FieldGroup.get_input()` return | 13/9 | prop(disabled), on, empty().add_options, val | fr:desk/page/setup_wizard/setup_wizard.js:766; erp:stock/doctype/stock_entry/stock_entry.js:1010 |
| page-dialog | `frappe.msgprint()` return / `frappe.msg_dialog` | 2/1 | msg_area.html read; stored, $wrapper.find().on(click) | request.js:156; erp:stock/doctype/item/item.js:1501 |
| page-dialog | `frappe.confirm/warn/prompt` return | 7/10 | get_primary_btn().prop/attr, fields_dict.$wrapper | form/form.js:1202; erp:setup/doctype/company/company.js:234 |
| page-dialog | Slides `container`/`$next_btn`/... | 15/0 | addClass/hide/show/on (SetupWizard subclass) | fr:desk/page/setup_wizard/setup_wizard.js:112 |
| page-dialog | Slide `form` / `get_input` / `get_field` (critic merge) | 0/19 | $input.on, empty().add_options, val | erp:public/js/setup_wizard.js:107, :226 |
| page-dialog | `frappe.ui.Tree.wrapper` | 3/0 | show/hide, removeClass | views/treeview.js:376 |
| page-dialog | Tree node `$tree_link`/`$ul`/`parent` (callbacks) | 3/6 | find('a').text, addClass, insertAfter/Before, parent.remove | views/treeview.js:610; erp:accounts/doctype/account/account_tree.js:114 |
| page-dialog | SortSelector `wrapper` | 1/3 | insert before it; constructed on page nodes | ui/group_by/group_by.js:385; erp:stock/page/stock_balance/stock_balance.js:45 |
| page-dialog | `FieldSelect.$input` | 1/0 | attr(placeholder) | ui/group_by/group_by.js:98 |
| page-dialog | `frappe.ui.Dropdown` `$trigger` / `frappe.ui.dropdown()` return | 9/1 | appended, dressed, data('es-dropdown').destroy | views/communication.js:395; erp:projects/doctype/project/project.js:277 |
| ui-rest | `Sidebar.$items_container` | 4/0 | appendTo moves the live node into a bottom sheet and back | ui/mobile_nav.js:186 |
| ui-rest | `frappe.ui.Card.card` | 1/0 | find().on(click) | pjs:billing.bundle.js:91 |
| ui-rest | ThemeSwitcher `dialog`/`body` | 2/0 | $wrapper.remove(); re-parent body into a panel | ui/user_settings_dialog.js:506 |
| list | `listview.$result` | 28/1 | empty/html/append/prepend, delegated on, mount Gantt/Calendar | views/file/file_view.js:330; erp:manufacturing/doctype/work_order/work_order_calendar.js:104 |
| list | `listview.$no_result` | 3/0 | html() (overwritten on each render) | fr:core/doctype/rq_worker/rq_worker_list.js:3 |
| list | `$paging_area` | 5/0 | find(.level-right).append/prepend | views/reports/report_view.js:255 |
| list | `listview.$page` | 7/0 | find().addClass/css/empty | views/image/image_view.js:62 |
| list | `filter_area.standard_filters_wrapper` | 1/0 | find(select).append(option) | fr:core/doctype/rq_job/rq_job_list.js:18 |
| list | `$checks` / `$checkbox_actions` | 2/0 | parents().addClass(cut) | views/file/file_view.js:140 |
| list | `get_count_element()` return | 2/0 | overridden + html | views/reports/report_view.js:250 |
| list | `listview_settings.refresh(listview)` | 3/0 | `$no_result.html`, page actions | fr:core/doctype/rq_worker/rq_worker_list.js:2 |
| views | `query_report.page` | 1/28 | add_inner_button; stored $btn toggled | erp:accounts/report/accounts_payable/accounts_payable.js:200 |
| views | TreeView node callbacks (pass-through, same nodes as the Tree row above) | 0/6 | addClass, insertAfter/Before, remove | erp:public/js/utils.js:535; erp:accounts/doctype/account/account_tree.js:103 |
| views | GanttView `$result` (prototype patch) | 0/1 | prepend `<style>` | erp:manufacturing/doctype/work_order/work_order_calendar.js:104 |
| views | `CommunicationComposer.dialog` | 2/0 | $wrapper.css(z-index) | request.js:644 |
| views | `InteractionComposer.dialog` | 0/5 | get_field().wrapper closest('.form-column').hide | erp:public/js/utils/crm_activities.js:78 |
| misc | `frappe.get_modal()` return | 4/0 | add/removeClass, on(shown), find | ui/dialog.js:37; ui/toolbar/awesome_bar.js:22 |
| critic | `frappe.ui.button()` / `.dress()` | 147/17 | append; dress re-classes nodes given to it | erp:manufacturing/doctype/job_card/job_card.js:309; fr:core/doctype/data_import/data_import.js:50 |
| critic | `frappe.ui.form.PrintView` (class + sidebar fields) | 0/3 | prototype.preview patch; `$('input[data-fieldname=print_format]').val()` | erp:public/js/print.js:17, :34 |
| critic | Subclass/prototype coupling (Tree, GanttView, QuickEntryForm, EmbeddedList) | 0/6 | override renderers that build nodes | erp:accounts/doctype/financial_report_template/financial_report_template.js:249 |

That is 90 rows. Ranked by the risk they carry for a port, from highest:
1. Button handles: `add_custom_button`/`add_inner_button`, `btn_primary`/`btn_secondary`, dialog button getters, `frappe.ui.button().dress`.
2. Control `$input`.
3. `dialog.$wrapper` and `frm.wrapper`, which are event and class targets.
4. Section and grid row nodes.

## Full inventory

Column key:
- **Kind:** prop = property, ret = return, cb = callback argument, evt = event, glob = global, sel = selector, html = html_string, inb = inbound (framework writes into a node the caller passes in).
- **Node:** j = jQuery, e = element, both = either, str = HTML string, none = no node.
- **fr/erp:** outside call-site lines in Frappe and in ERPNext.
- **Bkt:** the bucket, A to E.

### form-core

| # | Owner | Member | Kind | Node | Defined at | Framework rewrites after handout | fr/erp | Ops | Bkt | Examples |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Form (frm/cur_frm) | `wrapper` | prop | e | form/form.js:141 | yes: status classes form.js:521-525; validated-form save.js:23; data-state toolbar.js:951; events fired | 25/13 | on/off/trigger, dispatchEvent, find reads | B | fr:core/doctype/data_import/data_import.js:969; views/communication.js:1850; erp:projects/doctype/project/project.js:115; erp:crm/doctype/lead/lead.js:237 |
| 2 | Form | `$wrapper` | prop | j | form/form.js:142 | classes toggled form.js:521-525; primary_button re-queried :921 | 0/2 | delegated on | B | erp:public/js/utils/barcode_scanner.js:596; erp:manufacturing/doctype/bom/bom.js:427 |
| 3 | Form | events `dirty`/`render_complete`/`refresh-fields` on frm.wrapper | evt | e | form/form.js:1898, :704; form/layout.js:401 | n/a | 5/3 | on/off | C | pjs:data_import_wizard.bundle.js:903; form/workflow.js:15; erp:manufacturing/doctype/job_card/job_card.js:6 |
| 4 | frappe.ui.form (document) | `form-load`/`form-refresh`/`form-unload`/`form-rename`/`rename`/`save` | evt | none | form/form.js:626-683; toolbar.js:167; save.js:32,67 | n/a | 8/0 | $(document).on | C | socketio_client.js:102; ui/toolbar/awesome_bar.js:530 |
| 5 | Form | `page` (alias of the Page) node members | prop | both | form/form.js:151 | footer appended after page.main.parent() form.js:195; viewers prepended :171; title_area css :840 | 22/17 (all frm.page refs ~65/~69) | btn_primary/secondary addClass/hide/text; wrapper find/on | B | fr:core/doctype/doctype/doctype.js; erp:public/js/controllers/transaction.js |
| 6 | Form | `layout_main` | prop | e | form/form.js:152 | form_wrapper appended :294 | 0/0 | — | D | — |
| 7 | Form | `form_wrapper` | prop | j | form/form.js:294 | none | 8/0 | addClass/toggleClass, hide/show, find('.form-message') | B | fr:core/doctype/data_import/data_import.js:1093; fr:core/doctype/doctype/doctype.js:133; fr:website/doctype/web_form/web_form.js:51 |
| 8 | Form | `body` (.std-form-layout) | prop | j | form/form.js:295 | new Layout appended on rebuild :779; footnote :1938 | 0/0 | — | D | — |
| 9 | Layout (frm.layout; also FieldGroup/Dialog base) | `wrapper` | prop | j | form/layout.js:25 | **replaced** on DocType Layout switch (old .remove(), form.js:776-806); class toggles | 2/1 | hide/show; find().parent().remove() | B | fr:core/doctype/data_import/data_import.js:1094; erp:public/js/controllers/transaction.js:3544 |
| 10 | Layout | `message` | prop | j | form/layout.js:26 | **emptied on every render_form** (layout.js:134 via form.js:677) | 2/0 | .empty() | B | fr:workflow/doctype/workflow/workflow.js:8; fr:desk/doctype/workspace/workspace.js:22 |
| 11 | Layout | `show_message()` return | ret | j | form/layout.js:166 | removed by close and the next clear | 2/1 | return ignored; HTML passed in | C | fr:workflow/doctype/workflow/workflow.js:41; erp:public/js/controllers/transaction.js:3549 |
| 12 | Layout | `page` (.form-page) | prop | j | form/layout.js:29 | re-pointed per page break | 0/0 | — | D | — |
| 13 | Layout | `tab_link_container`/`tabs_content` | prop | j | form/layout.js:49-50 | sticky classes via global selector | 0/0 | — | D | — |
| 14 | Layout | `fold_btn` | prop | j | form/layout.js:321 | html swapped :324/:329 | 0/0 | — | D | — |
| 15 | Layout | `primary_button` (set by Form) | prop | j | form/form.js:921 | re-queried every render | 0/0 | — | D | — |
| 16 | Layout | `sections`/`sections_dict` | prop | both | form/layout.js:10,12 | rebuilt with layout | 6/0 | head.find().before, collapse | B | fr:core/doctype/data_import/data_import.js:420; form/form_tour.js:33 |
| 17 | Layout | `tabs` | prop | both | form/layout.js:9 | rebuilt with layout | 3/1 | methods only; instance refresh overridden | C | fr:core/doctype/doctype_layout/doctype_layout.js:173; erp:projects/doctype/project/project.js:33 |
| 18 | Section | `wrapper` (jQuery, unlike the control's element) | prop | j | form/section.js:30 | hide-control toggled section.js:122,177; empty/visible-section layout.js:440-449 | 1/3 | find('.section-body').prepend, add/removeClass | B | fr:core/doctype/security_settings/security_settings.js:6; erp:buying/doctype/purchase_order/purchase_order.js:286; erp:stock/doctype/item/item.js:144 |
| 19 | Section | `head` | prop | j | form/section.js:64 | set_label .html() replaces indicator :158; icon html :153 | 3/0 | find().before, addClass(hide) | B | fr:core/doctype/data_import/data_import.js:431; web_form/web_form.js:94 |
| 20 | Section | `body` | prop | j | form/section.js:56 | hide on collapse; columns re-classed | 0/0 | (reached by `.section-body` selector) | D | — |
| 21 | Section | `row.wrapper` (legacy alias) | prop | j | form/section.js:22 | as wrapper | 0/2 | toggle | B | erp:public/js/utils/sales_common.js:432, :445 |
| 22 | Section | `indicator`/`description_wrapper`/`collapse_link` | prop | j | form/section.js:40,66,72 | indicator html rewritten | 0/0 | — | D | — |
| 23 | Section/Tab | `control.section`/`control.tab` | prop | both | form/section.js:105,111; tab.js:90,94 | re-pointed on replace_field | 2/2 | methods only | C | fr:integrations/doctype/connected_app/connected_app.js:14; erp:public/js/sales_order_proforma.js:29 |
| 24 | Column | `wrapper`/`form` | prop | j | form/column.js:13,20 | **removeClass() of all classes** each resize (column.js:52-56) | 0/0 | (`.form-column` selector only) | D | — |
| 25 | Tab | `wrapper`/`tab_link` | prop | j | form/tab.js:44,31 | show/active reset; dashboard prepended | 0/0 | (`.tab-pane` selector only) | D | — |
| 26 | Dashboard | `parent` | prop | j | form/form.js:315 | detached/re-prepended on rebuild | 0/0 | — | D | — |
| 27 | Dashboard | progress/heatmap/chart/stats/links area Sections | prop | j | form/dashboard.js:14-53 | **reset() every refresh_header**: progress body emptied, areas hidden (dashboard.js:67-89) | 2/1 | find('.progress-bar') style, show | B | fr:core/doctype/background_task/background_task.js:47; erp:public/js/utils.js:282 |
| 28 | Dashboard | `stats_area_row` | prop | j | form/dashboard.js:41 | **.empty() on reset** :84; children re-classed :585-590 | 0/3 | addClass, css, appendTo | B | erp:public/js/utils.js:283, :284, :313 |
| 29 | Dashboard | `transactions_area` | prop | j | form/dashboard.js:51 | badge counts updated in place | 0/0 | — | D | — |
| 30 | Dashboard | `add_section()` return | ret | j | form/dashboard.js:101 | **removed every refresh** (.custom removed, dashboard.js:88) | 1/3 | appendTo, delegated on | A | fr:automation/doctype/auto_repeat/auto_repeat.js:117; erp:stock/doctype/batch/batch.js:115; erp:assets/doctype/asset_maintenance/asset_maintenance.js:50 |
| 31 | Dashboard | `add_progress()` return | ret | j | form/dashboard.js:124 | progress body emptied on reset | 1/8 | return ignored | C | fr:core/doctype/mapreduce_job/mapreduce_job.js:14; erp:manufacturing/doctype/work_order/work_order.js:681 |
| 32 | Dashboard | `add_indicator()` return (label is raw HTML) | ret | j | form/dashboard.js:593 | re-classed; row emptied | 0/6 | return ignored | C | erp:selling/doctype/customer/customer.js:222; erp:public/js/utils.js:221 |
| 33 | Dashboard | `set_headline`/`set_headline_alert`/`add_comment` return (HTML input) | ret | j | form/dashboard.js:667-690 | cleared every render_form | 27/10 (critic; agent said 34/14) | return ignored | C | fr:core/doctype/background_task/background_task.js:39; erp:public/js/utils.js:1443 |
| 34 | Form | `$intro_message` | prop | j | form/form.js:1933 | replaced each set_intro | 0/0 | — | D | — |
| 35 | Form | `footnote_area` | prop | j | form/form.js:1938 | html/remove | 0/0 | — | D | — |
| 36 | Form | `add_custom_button()` return | ret | j | form/form.js:1945-1949 | **clear_custom_buttons on every refresh_header** (form.js:983, :1956) | 144/447 | return kept by 3 fr / 4 erp | B | fr:email/doctype/email_account/email_account.js:315; erp:stock/doctype/pick_list/pick_list.js:279; erp:accounts/doctype/sales_invoice/sales_invoice.js:385 |
| 37 | Form | `custom_buttons[label]` | prop | j | form/form.js:1947 | reset each refresh | 0/0 | — | D | — |
| 38 | Form | `web_link` | prop | j | form/form.js:1683 | removed/re-added each show_web_link | 0/1 | closest().remove() | B | erp:projects/doctype/project/project.js:105 |
| 39 | FormViewers | `parent` | prop | j | form/form.js:171 | empty+append each refresh | 0/0 | — | D | — |
| 40 | Toolbar | `follow_menu_item` | prop | j | form/toolbar.js:596 | text rewritten; menu cleared each refresh | 0/0 | — | D | — |
| 41 | Toolbar | `get_dropdown_menu()` return | ret | j | form/toolbar.js:320 | page-owned | 0/0 | — | D | — |
| 42 | Toolbar | `setup_editable_title(el)` / `setup_sidebar_toggle(wrapper)` | inb | j | form/toolbar.js:218,1051 | appends icon, rebinds click, toggles classes | 1/0 | sidebar passes its node in | A | form/sidebar/form_sidebar.js:86 |
| 43 | TemplateManager | `$btn` | prop | j | form/template_manager.js:30 | hide toggled | 0/0 | — | D | — |
| 44 | Form | `fields_dict` / `get_field()` map | prop | both | form/form.js:311; layout.js:270,361 | **entries swapped by replace_field (replaceWith, layout.js:242-254); whole map replaced on _rebuild_layout** | 204/351 (critic; agent 109/277) | map reads; node writes counted under controls | C | fr:core/doctype/user/user.js:90; erp:crm/doctype/lead/lead.js:225; erp:accounts/doctype/cheque_print_template/cheque_print_template.js:59 |
| 45 | QuickEntryForm / `frappe.quick_entry` | global + init_callback(dialog) + inherited Dialog nodes | glob | both | form/quick_entry.js:25,36,171 | keydown bound on wrapper; nulled on hide | 10/9 | subclassing; set_df_property | C | utils/address_and_contact.js:4; erp:public/js/utils/item_quick_entry.js:3 |
| 46 | MultiSelectDialog | `dialog`/`$parent`/`$wrapper`/`$results`/`$child_wrapper`/make_list_row return (merged with the ui-rest row; same counts) | prop | j | form/multi_select_dialog.js:83,143-148,215 | results re-rendered per search | 0/1 | dialog.hide() | C | erp:public/js/utils.js:1281 |
| 47 | LinkSelector / LinkedWith | `dialog` | prop | both | form/link_selector.js:23; linked_with.js:23 | body html replaced | 1/0 | construct only | C | fr:desk/doctype/event/event.js:83 |
| 48 | InfoCard / SuccessAction | `$info_card` / `container` | prop | j | form/info_card.js:31; success_action.js:25 | internal | 0/0 | — | D | — |
| 49 | doctype_settings registry | builder(panel) with panel.body; section() returns | cb | j | form/doctype_settings/registry.js:21,104-119 | builders empty panel.body | 0/0 | only in-module tabs register | D | — |
| 50 | frappe.format / form.formatters / link_formatters | outputs | html | str | form/formatters.js:8-442 | n/a | 51/49 | inserted as HTML | C | fr:email/doctype/auto_email_report/auto_email_report.js:173; erp:public/js/utils.js:1325 |
| 51 | form DOM | `.form-section`/`.section-head`/`.section-body`/`.form-column` | sel | e | form/section.js:30-56; column.js:13 | re-classed (column removeClass) | 9/4 | closest().hide, prepend, css, addClass | E | fr:website/doctype/website_theme/website_theme.js:83; list/list_settings.js:44; erp:public/js/utils/crm_activities.js:80 |
| 52 | form DOM | `.form-message` | sel | e | form/layout.js:142 | cleared every render | 3/1 | hide/show; erp global `.text()` | E | fr:core/doctype/doctype/doctype.js:133; erp:assets/doctype/asset/asset.js:239 |
| 53 | form DOM | `.tab-pane` / `.form-tabs-list` | sel | e | form/tab.js:44; layout.js:44 | sticky toggles | 2/0 | closest + mount; height read | E | fr:core/doctype/doctype_layout/doctype_layout.js:119; utils/utils.js:431 |
| 54 | form DOM | state classes `.editable-form`/`.submitted-form`/`[data-state]` | sel | e | form/form.js:521-525 | toggled every refresh | 0/0 | Frappe CSS only | D | — |
| 55 | form DOM | dashboard/layout classes (.form-dashboard, .form-links, .std-form-layout, .form-page...) | sel | e | form/dashboard.js:14-53 etc. | as owners | 0/0 | CSS only | D | — |

### form-controls

| # | Owner | Member | Kind | Node | Defined at | Framework rewrites after handout | fr/erp | Ops | Bkt | Examples |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Control (every field) | `$wrapper` (.frappe-control) | prop | j | form/controls/base_control.js:27; base_input.js:18 | **yes, heavily**: hide-control every refresh (base_control.js:146); has-error classes; help-box html; ControlHTML `.html()/.empty()` of df.options (html.js:6-11, :36); Attach `.html()` of the whole wrapper (attach.js:126); **replaceWith on replace_field (layout.js:247)** | 155/70 | html, empty, append, detach, remove, replaceWith, hide/show, addClass, css, on | A | fr:core/doctype/data_import/data_import.js:412; form/layout.js:247; erp:selling/page/point_of_sale/pos_item_selector.js:316; erp:manufacturing/doctype/plant_floor/plant_floor.js:140 |
| 2 | Control | `wrapper` (element; carries expando `fieldobj`) | prop | e | base_control.js:14 (jQuery alias briefly at :30) | same node as $wrapper | 33/27 | $(w).empty/html/append/find/addClass | A | fr:core/doctype/user/user.js:90; ui/capture.js:114; erp:accounts/doctype/chart_of_accounts_importer/chart_of_accounts_importer.js:153; erp:crm/doctype/lead/lead.js:225 |
| 3 | Control | `wrapper.fieldobj` | prop | e | base_control.js:15 | no | 2/0 | DOM → control lookup | C | form/form_tour.js:80 |
| 4 | Control | `tooltip` | prop | j | base_control.js:17 | no | 3/0 | remove, addClass | B | form/doctype_settings/tabs/settings_map.js:138; fr:core/doctype/data_import/data_import.js:413 |
| 5 | ControlInput | `$input` | prop | j | data.js:12; link.js:27; button.js:24; attach.js:4 | val() every refresh (data.js:286); disabled; Select `.empty()` + refill (select.js:77); Button `.html(label)`; **Rating removes it** (rating.js:21) | 84/27 (critic raw 106/27) | on, trigger, val, attr, addClass/css, prop, wrap | B | form/grid_row.js:1592; ui/page.js:1265; erp:selling/page/point_of_sale/pos_item_selector.js:345; erp:stock/doctype/item/item.js:1541 |
| 6 | ControlInput | `input` | prop | e | data.js:65 etc. | as $input; Check writes .checked | 8/4 | .disabled=, onclick=, value | B | views/reports/query_report.js:941; erp:public/js/sms_manager.js:91; erp:manufacturing/doctype/bom_update_tool/bom_update_tool.js:31 |
| 7 | ControlInput | `disp_area` | prop | e | base_input.js:56; check.js:23; html.js:4 | **`.html(formatted)` every read-only refresh** (base_input.js:165); Button strips classes | 9/1 | innerHTML write/read, toggleClass | B | fr:custom/doctype/custom_field/custom_field.js:82; fr:core/doctype/audit_trail/audit_trail.js:123; erp:public/js/telephony.js:12 |
| 8 | ControlInput | `input_area` | prop | e | base_input.js:52 | Rating `.html()`; AttachmentGallery `.empty()`; hide toggled | 4/1 | hide, addClass | B | doctype/index.js:151; erp:stock/doctype/item/item.js:1530 |
| 9 | ControlInput | `$input_wrapper` | prop | j | base_input.js:53 | Code/Signature/Barcode append into it | 2/0 | append | B | doctype/index.js:157; fr:core/doctype/file/file.js:50 |
| 10 | ControlInput | `label_area`/`label_span` | prop | e | base_input.js:51 | innerHTML = label :182 | 0/0 | (`.control-label`/`.label-area` used by selector) | D | — |
| 11 | ControlInput | `df.on_make(control)` | cb | both | base_input.js:82 | n/a | 0/1 | hook; control nodes touched | C | erp:public/js/utils.js:390 |
| 12 | make_control | return | ret | both | form/controls/control.js:62 | n/a | 40/24 | object handle (nodes via rows 1, 5) | C | ui/page.js:1232; fr:printing/page/print/print.js:211 |
| 13 | ControlHTML/Heading | `html(html)`/`set_value(html|$node)` | inb | both | html.js:21,24 | **refresh re-renders df.options and overwrites** (html.js:6-11) | 11/4 | html(string) | A | fr:core/doctype/system_settings/system_settings.js:118; erp:accounts/doctype/pricing_rule/pricing_rule.js:111 |
| 14 | ControlLink/Data | `$link`/`$link_open`/`$link_clear`/`$input_area`/`$scan_btn` | prop | j | link.js:26-30; data.js:90,165 | toggled; .link-btn removed in only_input | 0/0 | (POS uses `.link-btn`/`.btn-open`/`.btn-clear` by selector) | D | — |
| 15 | ControlLink/Autocomplete | `awesomplete` (+ `.ul`) | prop | e | link.js:233; autocomplete.js:103; combobox shim | ul min-width set | 4/6 | close/evaluate; $(ul).css | B | form/grid.js:185; erp:selling/page/point_of_sale/pos_item_selector.js:299; erp:public/js/bom_creator/design_view.js:162 |
| 16 | *Combobox controls | `combobox` | prop | both | combobox_control.js:5 | trigger prepended | 2/0 | truthiness | C | ui/filters/filter.js:544 |
| 17 | ControlAttach | `$value` | prop | j | attach.js:15 | toggle/text/href on set | 4/0 | hide | B | pjs:data_import_wizard.bundle.js:796 |
| 18 | ControlAttach | `attach_doc_image` event on $input | evt | j | attach.js:11 | n/a | 1/0 | trigger | C | form/sidebar/user_image.js:56 |
| 19 | Data/Link/Autocomplete | `change`/`awesomplete-*` events on $input | evt | j | data.js:193-201 etc. | n/a | 4/1 | on | C | ui/field_group.js:91; erp:public/js/bom_creator/link_field.js:52 |
| 20 | select.js | `$.fn.add_options` return | ret | j | select.js:111,140 | Select set_options empties/refills | 9/1 | empty().add_options() | B | ui/page.js:1204; fr:desk/page/setup_wizard/setup_wizard.js:766; erp:public/js/setup_wizard.js:226 |
| 21 | select.js | `$.fn.set_working`/`done_working`/patched `$.fn.val` ('select-change') | glob | j | select.js:143-151 | patched val triggers on every setter app-wide | 0/2 | set_working/done_working | C | erp:public/js/sms_manager.js:95 |
| 22 | ControlTable | `grid` (+ frm.grids) | prop | both | table.js:8,16 | grid.refresh on refresh | 0/0 | (grid census) | D | — |
| 23 | ControlMultiCheck | `$checkbox_area`/`$select_buttons`/`$load_state`/`$label` | prop | j | multicheck.js:9-22 | rebuilt on set_options | 1/0 | css | B | fr:printing/page/report_print/report_print.js:232 |
| 24 | MultiSelectPills/TableMultiSelect | `$multiselect_wrapper`/`$input_area` | prop | j | multiselect_pills.js:8,9 | pills removed/re-prepended | 10/0 | delegated on, hasClass | B | views/communication.js:871, :1028 |
| 25 | Code/JSON/Markdown/HTMLEditor | `editor` (Ace), `ace_editor_target`, preview nodes | prop | j | code.js:47,61; markdown_editor.js:11 | preview .html(); copy_button removed | 8/0 | 1 css; Ace API | C | pjs:form_builder/components/controls/CodeControl.vue:54; pjs:print_format_builder/composables/useHtmlEditorDialog.js:84 |
| 26 | TextEditor/Comment | `quill`, `quill_container`, `comment_wrapper` | prop | j | text_editor.js:201,205; comment.js:8 | Quill owns the subtree | 3/0 | Quill API | C | form/footer/form_timeline.js:660 |
| 27 | Date/Datetime/Time | `datepicker` | prop | e | date.js:106 | n/a | 4/3 | AirDatepicker API | C | ui/filters/filter_list.js:259; erp:selling/doctype/sales_order/sales_order.js:1925 |
| 28 | ControlImage | `$body`/`$img` | prop | j | image.js:5,13 | empty each refresh | 0/0 | — | D | — |
| 29 | ControlSignature | `body`/`img_wrapper`/`$pad`... | prop | j | signature.js:14-42 | jSignature | 0/0 | — | D | — |
| 30 | ControlGeolocation | `map_area`/`map` | prop | j | geolocation.js:18 | disp_area .html(map) | 0/0 | — | D | — |
| 31 | Barcode/Password/Color/Icon/Phone/Duration/MultiSelectList/AttachmentGallery internals | various | prop | j | barcode.js:10; password.js:13-38; ... | various html/empty | 0/0 | — | D | — |
| 32 | ControlVueComponent | island mount on wrapper + `vue_component_removed` special event | evt | e | vue_component.js:3,12,45 | `.empty()` on unavailable | 0/0 | — | D | — |
| 33 | ERPNext telephony | replaces global `frappe.ui.form.ControlData` | glob | j | erp:public/js/telephony.js:1 (on data.js:3) | disp_area `.html()` wipes the read-only phone button | 1/1 | subclass; append into .control-value/.control-input | B | erp:public/js/telephony.js:24; fr:printing/page/print/print.js:833 |
| 34 | control DOM | `.frappe-control[data-fieldname]`, `input[data-fieldname]`, `.control-input`, `.control-value`, `.help-box`, `.control-label`, `.clearfix` (nesting depth matters), `.hide-control`, `.has-error`, `.select-icon`, `.btn-attach`, `.tooltip-content` | sel | e | base_control.js:11-13; base_input.js:20-34 | hide-control/has-error toggled | 30/20 (approx.) | find/closest + hide/css/append | E | erp:stock/doctype/shipment/shipment.js:71; erp:public/js/print.js:34; form/form_tour.js:124 |

### form-grid

| # | Owner | Member | Kind | Node | Defined at | Framework rewrites after handout | fr/erp | Ops | Bkt | Examples |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Grid (fields_dict[t].grid) | `wrapper` (.grid-field) | prop | j | form/grid.js:171 | node never replaced; children rewritten (.rows emptied :422, heading rows removed :533, pagination re-html'd, footer buttons toggled); trigger('change') :731 | 6/7 | find(.grid-row[data-name]), delegated on, toggleClass, text | B | fr:core/doctype/data_import/data_import.js:1841; fr:core/doctype/recorder/recorder.js:30; erp:stock/doctype/item/item.js:411; erp:accounts/doctype/payment_reconciliation/payment_reconciliation.js:260 |
| 2 | Grid | `parent` (= ControlTable wrapper) | prop | both | controls/table.js:11 | addClass(form-group) grid.js:172 | 1/0 | find(.grid-row-check).remove/replaceWith | B | fr:core/doctype/installed_applications/installed_applications.js:64 |
| 3 | Grid | `form_grid` | prop | j | grid.js:178 | error class; css from GridRow | 0/0 | — | D | — |
| 4 | Grid | `grid_buttons` | prop | j | grid.js:198 | children hidden/shown; custom buttons prepended | 0/1 | hide | B | erp:manufacturing/doctype/work_order/work_order.js:543 |
| 5 | Grid | `grid_custom_buttons` | prop | j | grid.js:199 | prepend | 0/0 | — | D | — |
| 6 | Grid | remove/edit/duplicate/remove_all row buttons | prop | j | grid.js:200-203 | hidden toggled; label text | 0/0 | — | D | — |
| 7 | Grid | `add_custom_button()` return / custom_buttons | ret | j | grid.js:1698-1712 | clear_custom_buttons adds hidden | 2/1 | return stored as a flag | C | fr:core/doctype/recorder/recorder.js:33; erp:public/js/utils/item_selector.js:20 |
| 8 | Grid | `grid_pagination` nodes | prop | j | grid.js:255; grid_pagination.js:21-26 | **.grid-pagination re-html'd** when the page count changes | 0/0 | (page_length/go_to_page API only) | D | — |
| 9 | Grid | `header_row`/`header_search` | prop | j | grid.js:535,545 | rebuilt every make_head | 0/0 | — | D | — |
| 10 | Grid | `grid_sortable` | prop | e | grid.js:971 | option toggled | 0/0 | — | D | — |
| 11 | Grid | `grid_rows`/`grid_rows_by_docname`/`get_row()` → GridRow | ret | j | grid.js:783,1203,1215 | stale rows removed; arrays reset | 12/13 (approx.) | mostly model/API (erp: 7 are model deletes) | C | fr:core/doctype/recorder/recorder.js:71; erp:public/js/controllers/transaction.js:831 |
| 12 | GridRow | `wrapper` (.grid-row) | prop | j | grid_row.js:25 | attrs/idx rewritten; grid-row-open toggled; removed/re-appended | 0/0 | (reached by selector) | D | — |
| 13 | GridRow | `row` (.data-row) | prop | j | grid_row.js:26 | editable-row toggled; toggled on form open; template mode re-html'd | 5/0 | css, add/removeClass | B | fr:custom/doctype/customize_form/customize_form.js:43; ui/side_panel.js:682 |
| 14 | GridRow | `columns[f]` (.static_area/.field_area) | prop | j | grid_row.js:991,1062-1080 | **static_area.html() every refresh_field** :1552; classes toggled | 5/0 | css, toggleClass, field_area.empty + make_control | B | fr:core/doctype/recorder/recorder.js:73; fr:desk/doctype/system_health_report/system_health_report.js:86; fr:core/doctype/data_import/data_import.js:1882 |
| 15 | GridRow | `row_index`/`row_check`/`row_display`/`open_form_button`/... | prop | j | grid_row.js:210-378,925 | row_display removed each refresh | 0/0 | — | D | — |
| 16 | GridRow | `on_grid_fields_dict`/`get_field()` controls | prop | j | grid_row.js:1161,1221,1599 | created lazily; input attrs; currency wrap | 3/5 | control API; read $wrapper | C | erp:public/js/utils.js:733; fr:core/doctype/data_import/data_import.js:1884 |
| 17 | GridRow | `grid_form` | prop | j | grid_row.js:1419 | display toggled | 8/1 | path to fields_dict | C | fr:core/doctype/recorder/recorder.js:107; erp:public/js/utils/serial_batch_inline_editor.js:1424 |
| 18 | GridRowForm | `wrapper` (.form-in-grid) | prop | j | grid_row_form.js:4 | display css; row-actions toggled | 1/0 | find('.grid-form-body') | C | form/toolbar.js:1025 |
| 19 | GridRowForm | `form_area`/`layout`/`fields`/`fields_dict[f]` | prop | j | grid_row_form.js:11-25,91 | **form_area.empty() + new Layout on every open** | 10/2 | appendTo fields_dict[f].wrapper; replace $wrapper; mount editor | A | fr:core/doctype/recorder/recorder.js:107; fr:core/doctype/data_import/data_import.js:1906; erp:public/js/utils/serial_batch_inline_editor.js:1441 |
| 20 | GridRow | `grid_settings_dialog`/`fields_html_wrapper` | prop | e | grid_row.js:385,432 | .selected-fields re-html'd | 0/0 | — | D | — |
| 21 | Grid | `open_grid_row` | prop | j | grid_row_form.js:38 | overwritten | 0/0 | — | D | — |
| 22 | frappe.ui.form | `get_open_grid_form()` / `frm.open_grid_row()` / `layout.get_open_grid_row()` | glob | j | grid.js:36-38; form.js:2378; layout.js:792 | selector-backed | 8/2 | GridRow methods | C | ui/keyboard.js:279; erp:public/js/controllers/accounts.js:169 |
| 23 | frappe.ui.form | `editable_row` / `cur_frm.cur_grid` | glob | j | grid_row.js:1123,1439 | reset to null | 4/0 | read | C | form/form_tour.js:118; doctype/index.js:150 |
| 24 | GridRow | `grid-row-render` event (arg: GridRow) | evt | j | grid_row.js:312 | fires each row render; toggles may undo writes | 1/1 | write into row | B | fr:custom/doctype/customize_form/customize_form.js:38; erp:public/js/controllers/accounts.js:13 |
| 25 | Grid/GridRow | `grid-make-sortable`/`grid-move-row` events; wrapper `change` | evt | j | grid.js:1012,731; grid_row.js:179 | n/a | 0/0 | — | D | — |
| 26 | Grid | `df.on_setup(grid)` | cb | j | grid.js:207 | n/a | 0/0 | — | D | — |
| 27 | GridRow template mode | `__form_grid_templates` HTML with `row` | html | str | grid.js:67; grid_row.js:219 | re-rendered every refresh | 1/14 | templates | C | fr:core/doctype/doctype/doctype.py:88; erp:templates/form_grid/item_grid.html:1 |
| 28 | grid DOM | `.grid-row[data-name|data-idx]` + `.data('grid_row')` | sel | j | grid_row.js:25,68-77 | idx rewritten; rows moved | 5/7 | closest/find/data, then write | E | controls/table.js:22; ui/keyboard.js:359; erp:stock/doctype/item/item.js:619 |
| 29 | grid DOM | `.grid-row-open` | sel | j | grid_row.js:1440 | toggled | 7/0 | existence/data reads | E | ui/keyboard.js:357; form/layout.js:793 |
| 30 | grid DOM | `.grid-row-check`/`.row-check`/`.row-index` | sel | j | grid_row.js:17,245 | checked/disabled rewritten | 4/3 | remove, replaceWith, click, on | E | fr:core/doctype/installed_applications/installed_applications.js:66; erp:accounts/doctype/payment_reconciliation/payment_reconciliation.js:262 |
| 31 | grid DOM | `.form-grid`/`.form-grid-container`/`.form-in-grid`/`.grid-form-body`/`.grid-footer`/`.grid-static-col`/`> .control-label` | sel | j | grid.js:92-160; grid_row_form.js:3-88 | .grid-footer re-hidden by setup_toolbar | 13/3 | toggleClass, css, prepend html, text | E | fr:core/doctype/data_import/data_import.js:1781; erp:setup/doctype/item_group/item_group.js:182; erp:manufacturing/doctype/work_order/work_order.js:139 |
| 32 | GridImport | `dialog`/panels | prop | j | grid_import.js:112-137 | panels toggled | 0/0 | — | D | — |

### form-footer-sidebar

| # | Owner | Member | Kind | Node | Defined at | Framework rewrites after handout | fr/erp | Ops | Bkt | Examples |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Footer (frm.footer) | `wrapper` (.form-footer) | prop | j | form/footer/footer.js:16 | .timeline child swapped by BaseTimeline | 3/0 | hide/show/toggle | B | fr:core/doctype/doctype/doctype.js:132; fr:website/doctype/web_form/web_form.js:50 |
| 2 | Footer | `parent` | prop | j | form/form.js:195 | hide toggled each render_complete | 0/0 | — | D | — |
| 3 | footer DOM | `.form-footer`/`.comment-box`/`.timeline-actions` | sel | e | form/templates/form_footer.html:1-4 | .timeline replaced; .timeline-actions moved | 0/5 | **appendTo re-parents the whole footer into an HTML field**; global hide | E | erp:public/js/utils/crm_activities.js:13, :17, :23, :25 |
| 4 | Footer → frm | `comment_box` | prop | both | form/footer/footer.js:46 | set_value('') | 2/0 | methods only | C | form/form.js:1045 |
| 5 | FormTimeline (frm.timeline) | `wrapper` | prop | j | form/footer/base_timeline.js:11 | items emptied every refresh :47; activity-title re-prepended | 0/6 (critic; agent 5) | find, prepend into .actions, delegated on, data | B | erp:support/doctype/issue/issue.js:88, :95, :99, :137 |
| 6 | FormTimeline | `timeline_items_wrapper` | prop | j | base_timeline.js:13 | .empty() every render | 0/0 | — | D | — |
| 7 | FormTimeline | `timeline_actions_wrapper` | prop | j | base_timeline.js:14 | moved into .activity-title | 0/1 | global selector hide | B | erp:public/js/utils/crm_activities.js:23 |
| 8 | FormTimeline | `document_email_link_wrapper` | prop | j | form_timeline.js:106 | recreated each refresh | 0/0 | — | D | — |
| 9 | BaseTimeline | `parent` (**stale after replaceWith**) | prop | j | footer.js:79 | detached | 0/0 | — | D | — |
| 10 | BaseTimeline | `add_action_button()` return | ret | j | base_timeline.js:34 | none | 0/0 | — | D | — |
| 11 | BaseTimeline | `add_timeline_item()`/`get_timeline_item()` return | ret | j | base_timeline.js:70-155 | dropped each refresh | 0/0 | — | D | — |
| 12 | `frappe.ui.BaseTimeline` | global class | glob | j | base_timeline.js:158 | n/a | 0/0 | — | D | — |
| 13 | FormTimeline | `get_*_timeline_content()` return | ret | j | form_timeline.js:286,355 | edit box empty/append | 0/0 | — | D | — |
| 14 | timeline DOM | `.timeline-item[data-doctype][data-name]` / `.actions` / `.content` | sel | e | base_timeline.js:118; templates/timeline_message_box.html:64 | rebuilt each refresh | 0/3 | find, prepend, closest().getAttribute | E | erp:support/doctype/issue/issue.js:95, :96, :120 |
| 15 | timeline DOM | id anchors `<scrub(doctype)>-<name>` | sel | e | form_timeline.js:247,349 | recreated | 2/0 | getElementById + scroll | E | ui/notifications/notifications.js:424; form/form.js:1996 |
| 16 | FormTimeline | `timeline_refresh` form event | evt | j | form_timeline.js:20 | n/a | 0/1 | the hook that makes timeline writes safe | C | erp:support/doctype/issue/issue.js:87 |
| 17 | FormTimeline | `additional_timeline_content` (server hook HTML/template) | html | str | form_timeline.js:501-526 | rebuilt each refresh | 1/1 | HTML/template name | C | fr:hooks.py:250; erp:hooks.py:754 |
| 18 | Sidebar (frm.sidebar) | `sidebar` | prop | j | form/sidebar/form_sidebar.js:23 | **a new Sidebar is built on every render_form; page.sidebar.empty()** (form.js:666) | 2/3 | parent().toggle; insertAfter | B | form/toolbar.js:540; erp:setup/doctype/employee/employee.js:182, :147 |
| 19 | Sidebar | `add_user_action()` return | ret | j | form_sidebar.js:244 | sidebar rebuilt each render | 4/2 | attr, on, closest().remove() | B | form/form.js:1684; fr:desk/doctype/workspace/workspace.js:18; erp:projects/doctype/project/project.js:105 |
| 20 | Sidebar | `image_wrapper` | prop | j | form_sidebar.js:30 | set_user_image rewrites | 0/1 | attr(src) (overwritten later) | B | erp:manufacturing/doctype/workstation/workstation.js:9 |
| 21 | Sidebar | `image_section` | prop | j | form_sidebar.js:29 | toggled | 0/0 | — | D | — |
| 22 | Sidebar | `user_actions`/`user_actions_list` | prop | j | form_sidebar.js:27 | hidden toggled | 0/0 | — | D | — |
| 23 | Sidebar | `like_wrapper`/`like_icon` | prop | j | form_sidebar.js:110 | class toggles | 0/0 | — | D | — |
| 24 | Sidebar | nodes handed to toolbar/like/TagEditor/keys/action_icon | inb | j | form_sidebar.js:50,85-86,106-115,210 | discarded next render | 5/0 | receivers append/bind | A | form/toolbar.js:218; ui/like.js:13; ui/tags.js:26 |
| 25 | sidebar DOM | `.sidebar-meta-details`/`.sidebar-image`/`.user-action-row`/`.form-sidebar-items`/`.overlay-sidebar`/`.liked-by`/`a.help-link` | sel | e | form/templates/form_sidebar.html | re-rendered per render_form | 5/3 | insertAfter, attr, closest().remove, addClass | E | utils/help.js:57; erp:setup/doctype/employee/employee.js:147 |
| 26 | Sidebar | `frappe.get_form_sidebar_extension()` hook | html | str | form_sidebar.html:170 | re-rendered | 0/0 | (third-party only) | D | — |
| 27 | AssignTo | `parent`/`btn`/`btn_wrapper` | prop | j | sidebar/assign_to.js:5-9 | empty/append each render | 0/0 | — | D | — |
| 28 | AssignmentClass | section/row returns | ret | j | assign_to.js:272-356 | rows removed | 0/0 | — | D | — |
| 29 | AssignmentDialog | `assignment_list`/`dialog` | prop | j | assign_to.js:386,422 | append | 0/0 | — | D | — |
| 30 | AssignToDialog | `dialog` | prop | j | assign_to.js:109 | clear() | 2/0 | Dialog API | C | list/bulk_operations.js:248; views/kanban/kanban_board.bundle.js:1550 |
| 31 | Attachments | `attachment_preview` (in .layout-main) | prop | j | sidebar/attachments.js:190 | **.html() on show; addClass(hidden).empty() on hide**; formview removes it globally | 4/0 | addClass, off/on, attr | B | form/upload_first_review.js:85, :156; views/formview.js:155 |
| 32 | Attachments | `parent`/`add_attachment_wrapper`/`attachments_label` | prop | j | attachments.js:5,30 | rows rebuilt | 0/0 | (≈20 method calls, no nodes) | D | — |
| 33 | Attachments | `attachments_change` event on frm.wrapper | evt | j | attachments.js:71 | n/a | 1/0 | on | C | form/controls/attachment_gallery.js:10 |
| 34 | Share | `parent`/`shares`/`dialog` | prop | j | sidebar/share.js:7,67,123 | shares emptied; body re-html'd | 0/0 | — | D | — |
| 35 | SidebarUsers | `$wrapper`/`parent` (never instantiated) | prop | j | form_sidebar_users.js:12 | empty | 0/0 | — | D | — |
| 36 | `frappe.ui.form.set_user_image` | writes Page `.title-image` + sidebar image | glob | j | sidebar/user_image.js:1-36 | itself a reach-in into Page | 0/0 | — | D | — |
| 37 | form/templates | form_links/report_links/address_list/contact_list .html | html | str | form/templates/*.html | owners re-render | 2/1 | render_template; erp reads `.address-box` | C | form/dashboard.js:329; erp:accounts/doctype/shareholder/shareholder.js:46 |

### ui-page-dialog

| # | Owner | Member | Kind | Node | Defined at | Framework rewrites after handout | fr/erp | Ops | Bkt | Examples |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Page | `main` / `body` (.layout-main-section) | prop | j | ui/page.js:160 | page_form prepended; never emptied by Page (list/report/form add classes) | 40/7 | appendTo, html, empty().html, on, addClass, css, prepend | A | fr:printing/page/print/print.js:50; fr:core/page/permission_manager/permission_manager.js:12; erp:stock/page/warehouse_capacity_summary/warehouse_capacity_summary.js:105 |
| 2 | Page | `wrapper` | prop | j | ui/page.js:72 | page.html appended; container hides/shows and triggers show/hide | 22/6 | addClass, on/off(hide), find, prop(inert), is(:visible) | B | fr:core/doctype/doctype_layout/doctype_layout.js:6; erp:accounts/doctype/cheque_print_template/cheque_print_template.js:76 |
| 3 | make_app_page | return / `wrapper.page` expando | ret | j | ui/page.js:23 | n/a | 17/8 | Page API | C | fr:core/page/permission_manager/permission_manager.js:2; erp:selling/page/sales_funnel/sales_funnel.js:5 |
| 4 | Page | `container` | prop | j | ui/page.js:161 | none | 7/0 | find, append skeleton, hide/show | B | list/list_view.js:137 |
| 5 | Page | `sidebar` (.layout-side-section) | prop | j | ui/page.js:162 | **form_sidebar empties it every render** (form_sidebar.js:25) | 10/2 | remove(), empty().append, toggleClass, show/hide | A | fr:core/doctype/recorder/recorder_list.js:5; erp:manufacturing/doctype/bom_creator/bom_creator.js:27 |
| 6 | Page | `footer` | prop | j | ui/page.js:163 | none | 0/0 | — | D | — |
| 7 | Page | `indicator` (+ clear_indicator) | prop | j | ui/page.js:164 | removeClass() all, html() | 0/0 | (set_indicator method used 18/7) | D | — |
| 8 | Page | `page_actions` | prop | j | ui/page.js:166 | shortcut-group key | 2/0 | prependTo | B | form/form.js:171 |
| 9 | Page | `filters` | prop | j | ui/page.js:167 | controls restyled | 1/0 | parent for add_field | A | views/treeview.js:306 |
| 10 | Page | `page_head` | prop | j | ui/page.js:168 | none | 1/0 | hide | B | fr:desk/page/desktop/desktop.js:71 |
| 11 | Page | `btn_primary` / `set_primary_action()` return | prop | j | ui/page.js:169,378 | **re-dressed** (page.js:329); **clear_action_of `.unbind('click')`** (page.js:411); alt underline `.html()` | 12/11 | hide/show, trigger, addClass, prop, btn: | B | desk.js:490; fr:custom/doctype/customize_form/customize_form.js:437; erp:selling/doctype/proforma_invoice/proforma_invoice.js:6 |
| 12 | Page | `btn_primary_menu` | prop | j | ui/page.js:170 | hidden prop | 0/0 | — | D | — |
| 13 | Page | `btn_secondary` / `set_secondary_action()` return | prop | j | ui/page.js:171,407 | same as btn_primary | 4/6 | hide, addClass, prop, innerText= | B | list/base_list.js:232; erp:accounts/doctype/gl_entry/gl_entry.js:6 |
| 14 | Page | `menu` (hidden ul store) / `actions` | prop | j | ui/page.js:173,176 | emptied by clear_btn_group; snapshot on every open | 7/0 | parent for items, children().filter | B | form/toolbar.js:34; views/kanban/kanban_view.js:84 |
| 15 | Page | `add_menu_item`/`add_action_item`/`add_actions_menu_item`/`add_custom_menu_item`/`add_dropdown_item` return | ret | j | ui/page.js:633 | li removed by clear_menu; render is a snapshot | 10/0 (calls 52+3+6+3 fr / 9+27+3 erp; erp never keeps the return) | parent().addClass, toggle, text | B | list/base_list.js:262; form/toolbar.js:503 |
| 16 | Page | `add_inner_button()` return | ret | j | ui/page.js:944-966 | **clear_custom_actions `.empty()`** (page.js:443); remove_inner_button; grouped items removeClass() (:1001) | 3/1 (critic; calls 19/34) | stored; toggle, addClass, prop | B | views/reports/query_report.js:281; erp:accounts/report/accounts_payable/accounts_payable.js:200 |
| 17 | Page | `add_button()` return | ret | j | ui/page.js:1130 | emptied with custom_actions | 4/0 | toggle/hide/text | B | pjs:workflow_builder/workflow_builder.bundle.js:37; pjs:form_builder/form_builder.bundle.js:66 |
| 18 | Page | `add_action_icon()` return | ret | j | ui/page.js:272 | clear_icons `.empty()` :455 | 7/1 | css, hide/show | B | form/toolbar.js:222; erp:manufacturing/doctype/bom_creator/bom_creator.js:96 |
| 19 | Page | `add_custom_button_group()` return | ret | j | ui/page.js:1179 | groups destroyed | 1/1 | passed back as parent | B | list/list_view_select.js:566; erp:public/js/financial_statements.js:358 |
| 20 | Page | `standard_actions`/`custom_actions`/`custom_mobile_actions`/`menu_btn_group`/`actions_btn_group`/`icon_group` | prop | j | ui/page.js:174-185 | custom_actions `.empty()`; icon_group `.empty()` | 8/0 | show/hide, prependTo, addClass | B | views/reports/query_report.js:262; views/dashboard/dashboard_view.js:212 |
| 21 | Page | `page_form` | prop | j | ui/page.js:183 | clear_fields `.empty()` :1279 | 20/0 | removeClass/addClass, appendTo, css | B | list/base_list.js:183; views/reports/query_report.js:2471 |
| 22 | Page | `add_field()`/`add_select`/`add_date`/... return | ret | both | ui/page.js:1198-1270 | wrapper restyled; cleared by clear_fields | 7/12 | control API; val/on | C | fr:core/page/permission_manager/permission_manager.js:45; erp:stock/page/stock_balance/stock_balance.js:9 |
| 23 | Page | `$title_area` (+ get_title_area, get_main_icon) | prop | j | ui/page.js:152 | **breadcrumb `<ol>` empty().append on every set_title** (page.js:1081) | 9/0 | find().remove, prepend, toggleClass, parent().css | B | form/form.js:838; list/base_list.js:213; form/sidebar/user_image.js:5 |
| 24 | Page | `$sub_title_area` (probably empty) | prop | j | ui/page.js:154 | html() | 2/0 | css, on | B | form/toolbar.js:63 |
| 25 | Page | views/add_view/skip_link/divider/add_inner_message/get_empty_state/is_in_group_button_dropdown | prop | j | ui/page.js:94-1300 | set_view toggles | 1/0 | `.remove()` | B | form/form.js:1969 |
| 26 | page.html DOM | `.page-head`, `.page-head-content`, `.layout-main-section(-wrapper)`, `.layout-side-section`, `.layout-main`, `.page-content`, `.page-form`, `.primary-action`, `.standard-actions`, `.page-back-button`, `.navbar-breadcrumbs` | sel | e | ui/page.html:1-75 | static | 30/12 | find as mount point, addClass, css, height() | E | fr:workflow/page/workflow_builder/workflow_builder.js:21; utils/utils.js:430; erp:selling/page/point_of_sale/pos_controller.js:3; erp:public/js/shop_floor/shop_floor.js:1645 |
| 27 | Page | `view-change` event | evt | j | ui/page.js:1318 | n/a | 0/0 | — | D | — |
| 28 | Dialog | `$wrapper` (.modal) | prop | j | ui/dialog.js:37 | fade/minimize classes, z-index; **mobile open_sheet re-parents body/footer** (dialog.js:370-385) | 38/11 (lower bound) | addClass, on(bs events), find, remove, css | B | views/communication.js:222; file_uploader/file_uploader.bundle.js:135; erp:stock/doctype/item/item.js:1501 |
| 29 | Dialog | `wrapper` — **element (.modal-dialog) for field-less dialogs, jQuery (.form-layout) once fields exist** (layout.js:25) | prop | both | ui/dialog.js:49; form/layout.js:25 | classList toggled (messages.js:302) | 7/1 (critic; agent 6/1, typed e) | classList, $(w).addClass, w.find().click() | B | request.js:674; ui/toolbar/about.js:9; erp:selling/doctype/sales_order/sales_order.js:1829 |
| 30 | Dialog | `$body` / `body` | prop | both | ui/dialog.js:57-58 | set_alert prepends; mobile re-parent | 50/10 | html, empty().append, append, on, setup_search | A | form/linked_with.js:13; form/sidebar/share.js:93; erp:stock/doctype/pick_list/pick_list.js:370 |
| 31 | Dialog | `header`/`footer`/`standard_actions`/`custom_actions`/`modal_body`/`$message`/`$alert` | prop | j | ui/dialog.js:56-63,228 | footer unhidden; indicator reclassed; capture empties custom_actions | 13/1 | toggleClass, prepend, appendTo, find | B | form/grid_import.js:159; fr:email/doctype/email_account/email_account_list.js:150; erp:public/js/call_popup/call_popup.js:31 |
| 32 | Dialog | `get_primary_btn`/`get_secondary_btn`/`get_close_btn`/`get_minimize_btn`/`set_*_action` return | ret | j | ui/dialog.js:205-439 | **re-dressed + `.off('click')`** on set_*_action (dialog.js:264-291) | 38/9 | prop, attr, text/html, trigger, addClass, unbind().click | B | fr:workflow/page/workflow_builder/workflow_builder.js:46; desk.js:488; erp:public/js/call_popup/call_popup.js:20 |
| 33 | FieldGroup (Dialog, Slide) | `get_input(f)` return | ret | j | ui/field_group.js:129-133 | controls refresh | 13/9 | prop, on, empty().add_options, val | B | form/link_selector.js:54; erp:stock/doctype/stock_entry/stock_entry.js:1010 |
| 34 | Dialog DOM | `.modal-dialog`/`.modal-body`/`.modal-footer`/`.modal-title`/`.btn-modal-primary`/`.frappe-confirm-message`/`.msgprint` | sel | e | dom.js:346; messages.js:48,207 | title html | 6/2 (critic adds `$('.modal:visible')` erp hits under critic #20) | is(:visible), parents, css | E | roles_editor.js:159; erp:public/js/projects/timer.js:144 |
| 35 | Dialog | `window.cur_dialog` / `frappe.ui.open_dialogs` | glob | both | ui/dialog.js:6-8,118 | set/cleared on show/hide | 13/6 | mostly API; get_primary_btn().trigger | C | desk.js:488; erp:manufacturing/doctype/bom/bom.js:529 |
| 36 | Dialog | `frappe.ui.Dialog:shown` document event | evt | j | ui/dialog.js:143 | n/a | 2/0 | on | C | form/controls/data.js:169 |
| 37 | messages | `frappe.msg_dialog` (`.msg_area`, `.indicator`), msgprint() return | glob | j | ui/messages.js:194-213,321 | **msg_area `.empty()` on hide; `.html()` on update** | 2/1 (critic; agent 2/3) | msg_area.html read; stored, $wrapper.find().on | B | request.js:156; erp:stock/doctype/item/item.js:1489 |
| 38 | messages | `frappe.confirm`/`warn`/`prompt` return | ret | j | ui/messages.js:63,99,126 | warn sets data-theme | 7/10 | get_primary_btn().prop/attr, fields_dict | B | form/form.js:1202; erp:manufacturing/doctype/work_order/work_order.js:452 |
| 39 | messages | `frappe.show_progress` return / `cur_progress` | ret | j | ui/messages.js:387-408 | width/text | 0/0 | — | D | — |
| 40 | messages | `show_alert`/`toast` return `$el` (also accepts node input) | ret | j | ui/messages.js:493 | auto-dismiss | 0/0 (199/95 calls, return unused) | — | D | — |
| 41 | messages | `waiting()` / `get_waiting_message()` | ret | j | ui/messages.js:9-19 | n/a | 1/0 | used as an HTML string | C | ui/listing.html:16 |
| 42 | Slides | `container`/`$body`/`$footer`/`$prev_btn`/`$next_btn`/`$complete_btn`; before_load($footer) | prop | j | ui/slides.js:286-413 | **$footer `.empty()` + rebuilt** :367 | 15/0 | addClass/hide/show/on | B | fr:desk/page/setup_wizard/setup_wizard.js:112, :295 |
| 43 | Slide (merged with the critic row) | node members + `form`/`get_input`/`get_field` via onload(slide) | cb | j | ui/slides.js:13-149,239 | hidden toggled; re-render on navigation | 0/19 (critic; agent 0/0) | $input.on, empty().add_options, val | B | erp:public/js/setup_wizard.js:107, :226, :251 |
| 44 | Tree | `wrapper` (.tree) | prop | j | ui/tree.js:41 | class toggles | 3/0 | show/hide, removeClass | B | views/treeview.js:376 |
| 45 | Tree node | `$tree_link`/`$ul`/`parent`/`$toolbar`; on_render/on_click/on_node_render/toolbar click | cb | j | ui/tree.js:223-237,512,113,581,545 | **$ul `.empty()` on reload**; toggle-icon html | 3/6 (the same erp lines as views #27) | find().text, addClass, insertAfter/Before, parent.remove | B | views/treeview.js:610; erp:accounts/doctype/account/account_tree.js:114; erp:public/js/utils.js:535 |
| 46 | SortSelector | `wrapper`/`$order_button`/`$field_button`/`$sheet_button` | prop | j | ui/sort_selector.js:18-48 | **make() removes any existing .sort-selector in the parent** | 1/3 (critic; agent 1/0) | insert before; constructed on page nodes | B | ui/group_by/group_by.js:385; erp:stock/page/stock_balance/stock_balance.js:45 |
| 47 | GroupBy | `$group_by_area`/`wrapper`/buttons | prop | j | ui/group_by/group_by.js:23-406 | html re-render | 0/0 | — | D | — |
| 48 | FilterGroup | `wrapper` (caller parent + .filter-area), make_buttons() return | inb | j | ui/filters/filter_list.js:13-59 | filter button text/classes rewritten; rows removed; popover re-mounts | 7/1 (critic) | wrapper.empty(), find(.filter-box) | A | widgets/quick_list_widget.js:78; list/base_list.js:1414; erp:accounts/doctype/financial_report_template/financial_report_template.js:98 |
| 49 | Filter / FieldSelect | `filter_edit_area`/`$condition`/`fieldselect.$input` | prop | j | ui/filters/filter.js:152,190; field_select.js:27 | .filter-field emptied | 1/0 | attr | B | ui/group_by/group_by.js:98 |
| 50 | EmbeddedList | consumer `$wrapper` + `$header`/`$result`/`$no_result`... | inb | j | ui/embedded_list.js:29-54 | $header html; **$result `.empty()` every render** | 2/15 (critic; agent 2/4) | find().addClass, replaceWith $no_result, toggle | A | list/attachment_queue_review.js:88; erp:manufacturing/doctype/work_order/work_order.js:1617; erp:projects/doctype/project/project.js:344 |
| 51 | keys (alt shortcuts) | `get_shortcut_group().add($target, $text_el)` | inb | j | ui/alt_keyboard_shortcuts.js:9-196 | **$text_el `.html()` with an underline span** :194 | 2/0 | callers hand in nodes | A | fr:printing/page/print/print.js:654; form/form_sidebar.js:50 |
| 52 | keys | `$(document)` `escape` event; `$.fn.enterKey` | evt | j | ui/keyboard.js:352,388 | n/a | 3/0 | on | C | form/grid_row.js:358; form/section.js:82 |
| 53 | frappe.find | `page_primary_action()`/`field()` | ret | j | ui/find.js:2-17 | val/trigger | 0/0 | (test helper) | D | — |
| 54 | LinkPreview | `a[data-doctype]`, `input[data-fieldtype=Link]` delegated | sel | e | ui/link_preview.js:5-19 | attaches popover data to foreign nodes | 0/0 | — | D | — |
| 55 | Tags | `$ul`/`$input`/`$placeholder` | prop | j | ui/tags.js:16-149 | clearTags | 0/0 | — | D | — |
| 56 | like | `toggle_like($btn)` / `setup_like_popover($parent)` | inb | j | ui/like.js:13-222 | toggles classes on the caller's $btn | 3/0 | callers hand in nodes | A | list/list_view.js:2612; form/sidebar/form_sidebar.js:112 |
| 57 | IconBar (dead) | `$wrapper`/`get_group`/`add_btn` | prop | j | ui/iconbar.js:11-41 | clear empties | 0/0 | — | D | — |
| 58 | app_icon (dead) | `get_html()` | html | str | ui/app_icon.js:6 | n/a | 0/0 | — | D | — |
| 59 | Capture/DropdownConsole/AddressAutocompleteDialog/BackgroundTasks | `dialog`/`$template`/`body` | prop | j | ui/capture.js:111; dropdown_console.js:3 | capture re-html's the field wrapper | 0/0 | — | D | — |
| 60 | Dropdown (components/dropdown.js) | `$trigger`/`trigger_el`, `frappe.ui.dropdown()` return, `.data('es-dropdown')` | ret | both | ui/components/dropdown.js:70,226 | aria attrs | 9/1 (critic) | append, dress, destroy | B | views/communication.js:395; views/reports/query_report.js:200; erp:projects/doctype/project/project.js:277 |
| 61 | chart / make_chart / DataTable / Driver / Awesomplete | container argument (+ awesomplete.ul) | inb | e | ui/chart.js:39; datatable.js:3; awesomplete.js:1 | chart replaces container content | 15/7 (overlaps ui-rest #27 and controls #15) | caller passes node; ul css | A | widgets/chart_widget.js:750; erp:accounts/doctype/bisect_accounting_statements/bisect_accounting_statements.js:50 |

### ui-rest (desk shell, toolbar, sidebar, panels, misc ui/ part 2)

| # | Owner | Member | Kind | Node | Defined at | Framework rewrites after handout | fr/erp | Ops | Bkt | Examples |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | desk shell | `.main-section` / `<header>` / `#body` | sel | e | fr:www/desk.html:50-52 | `<header>` replaceWith'd by navbar (toolbar.js:27); site-banners inserted | 17/0 | scrollTop, on(scroll), css(overflow), insertBefore | E | views/container.js:20; list/base_list.js:464; form/layout.js:619 |
| 2 | desk.js | `frappe.temp_container` | glob | j | desk.js:428 | none | 0/0 | — | D | — |
| 3 | desk.js | `$(document)` `startup` / `app_ready` (merged with the misc row) | evt | none | desk.js:60-61 | n/a | 1/3 | on; then global queries | C | ui/mobile_nav_loader.js:3; erp:public/js/utils.js:1362; erp:public/js/call_popup/call_popup.js:228 |
| 4 | desk.js | show_notes `dialog.msg_area` | prop | j | desk.js:560 | none | 0/0 | — | D | — |
| 5 | Toolbar | `navbar` | prop | j | ui/toolbar/toolbar.js:47 | **show_app_logo does `.html(undefined)` on mobile route change** | 0/0 | — | D | — |
| 6 | toolbar | `add_dropdown_button()` return | ret | j | toolbar.js:192 | custom-menu removed on page-change | 1/0 | return discarded (targets markup that no longer exists) | C | ui/page.js:1192 |
| 7 | Toolbar | navbar template selectors | sel | e | toolbar/navbar.html | header replaced | 0/0 | — | D | — |
| 8 | Toolbar | `toolbar_setup` document event | evt | none | toolbar.js:46 | n/a | 0/0 | (third-party hook) | D | — |
| 9 | toolbar | `body.full-width` + `toggleFullWidth` | evt | e | toolbar.js:238 | n/a | 0/0 | — | D | — |
| 10 | AwesomeBar | `search_modal` | prop | j | toolbar/awesome_bar.js:22 | body/footer html | 0/0 | — | D | — |
| 11 | SearchDialog | `search_dialog`/`$wrapper`/`$body`/`$input` | prop | j | toolbar/search.js:19-28 | results empty().html | 0/0 | — | D | — |
| 12 | Sidebar (frappe.app.sidebar) | `wrapper` | prop | j | ui/sidebar/sidebar.js:366 | class toggles each route | 0/0 | (≈60 method uses, no DOM) | D | — |
| 13 | Sidebar | `$items_container` | prop | j | sidebar.js:105 | **`.html('')` every shell change** :571 | 4/0 | appendTo moves the live node into a bottom sheet and back | B | ui/mobile_nav.js:186, :199, :261 |
| 14 | Sidebar | `$sidebar`/`$standard_items_sections`/`$promotional_banners`/`active_item` | prop | j | sidebar.js:106-151,523 | emptied/reclassed | 0/0 | — | D | — |
| 15 | Sidebar | `begin_editing()` return | ret | j | sidebar.js:933 | removed by end_editing | 1/0 (in-module) | editor draws into it | A | ui/sidebar/arrangement_editor.js:180 |
| 16 | Sidebar | `sidebar_setup` / `sidebar-expand` events | evt | j | sidebar.js:215,743 | n/a | 1/0 (in-module) | on | C | ui/sidebar/sidebar_item.js:278 |
| 17 | sidebar DOM | `.body-sidebar`, `.item-anchor`, `.sidebar-notification`, `.sidebar-background-tasks`, `.notification-count`... | sel | e | sidebar.html; sidebar_item.html | rows rebuilt | 6/0 | addClass/removeClass, toggleClass, text | E | views/workspace/workspace.js:366; ui/background_tasks/background_tasks.js:40; ui/notifications/notifications.js:438 |
| 18 | Sidebar | `frappe.ui.sidebar_banners[]` icon (SVG string input) | html | str | sidebar.js:80,196 | list emptied each setup | 0/2 | push factories | C | erp:public/js/sidebar_banners.js:6 |
| 19 | Sidebar | `add_card()` → card.parent | prop | j | sidebar.js:225 | `.html('')` each setup | 0/0 | — | D | — |
| 20 | sidebar_item | `wrapper`/`container`/`$item_control`/`$nested_items` | prop | j | sidebar_item.js:151-376 | discarded on shell change | 0/0 | — | D | — |
| 21 | SidebarHeader | `wrapper`/`$header_title`/`layer_slot()` return | prop | j | sidebar_header.js:247-374 | text/html per module | 1/0 (in-module) | layer_slot empty/append | A | ui/sidebar/arrangement_editor.js:189 |
| 22 | Dock | `$dock`/`$items`/`$add_slot`/`begin_editing()`/`make_utility()` | prop | j | ui/sidebar/dock.js:23-229 | `$items.empty()` each render | 3/0 (in-module) | editor draws into it | A | ui/sidebar/dock_manager.js:100, :128 |
| 23 | ArrangementEditor/SidebarManager/DockManager | `$frame`/`$list`/panels | prop | j | arrangement_editor.js:31ff | html/empty | 0/0 | — | D | — |
| 24 | SidebarPanel | `$panel`/`$header`/`$items`/`$actions`/`$body` | prop | j | ui/sidebar/sidebar_panel.js:70-86 | hidden toggled; $panel removed when re-registered | 9/0 | append into $body, delegated on | A | ui/background_tasks/background_tasks.js:15; ui/notifications/notifications.js:42 |
| 25 | Card | `card` + caller parent | prop | j | ui/sidebar/card.js:44-76 | data-show on the caller parent | 1/0 | find().on | B | pjs:billing.bundle.js:91 |
| 26 | Notifications | `opts.wrapper` host + tab containers | inb | j | ui/notifications/notifications.js:12-244 | containers html/empty each open; global `.notification-count` written | 2/0 | host passed in | A | fr:desk/page/desktop/desktop.js:270 |
| 27 | `frappe.ui.chart` | target element (taken over) | inb | both | ui/chart.js:39-44 | **island mount replaces children; show_error `.empty().append()`** | 10/5 (approx.; overlaps page-dialog #61) | caller passes node, often emptied; query_report reaches into .chart-container | A | views/reports/query_report.js:1392; erp:selling/page/sales_funnel/sales_funnel.js:182 |
| 28 | MobileNav | `nav` (frappe-mobile-nav), tabs, sheet; body classes | prop | e | ui/mobile_nav.js:21-164 | attrs per route | 1/0 | querySelector for height | C | views/kanban_v2/kanban_page.js:214 |
| 29 | NamingSeriesController | writes into the borrowed `frm.fields_dict[f].$wrapper` | inb | j | ui/naming_series.js:242,398 | **full `.html()` rewrite** :246 | 1/4 | render_table() only | A | erp:buying/doctype/buying_settings/buying_settings.js:6; form/doctype_settings/tabs/naming.js:167 |
| 30 | PermissionDialog | `dialog` | prop | j | ui/permission_dialog.js:144 | none | 0/0 | — | D | — |
| 31 | PrintPreviewBar | `$wrapper` appended into caller `parent`; attach(iframe); get_sheet cb | inb | j | ui/print_preview_bar.js:5-37 | label/disabled updates; PrintPages rewrites the sheet | 4/0 | construct with parent | A | fr:printing/page/print/print.js:63; fr:printing/page/report_print/report_print.js:102 |
| 32 | SettingsDialog | `$layout`/`$sidebar`/`$panels` | prop | j | ui/settings_dialog.js:201-283 | **hides the Dialog header/$body, re-classes $wrapper**; sidebar/panels emptied | 0/0 | — | D | — |
| 33 | SettingsDialogPanel | `body`/`$body`/`$el`/`$header` passed to render(panel) | cb | j | settings_dialog.js:35-100,336 | **$body `.empty()` and re-render on every refresh** (:97-100) | 34/0 (approx.) | empty/html/append; parent for FieldGroups | A | ui/user_settings_dialog.js:334; form/doctype_settings/tabs/roles.js:27; views/workspace/workspace.js:685 |
| 34 | SidePanel | `$panel`/`$body`/`layouts[dt].$wrapper` | prop | j | ui/side_panel.js:415,622 | indicator emptied; skeleton html | 0/0 | (itself monkey-patches grid and control) | D | — |
| 35 | site_banners | `.site-banners` | sel | j | ui/site_banners.js:35 | none | 0/0 | — | D | — |
| 36 | TagEditor (frm.tags) | `wrapper`/`tags` | prop | j | ui/tag_editor.js:34 | clear/add tags | 2/0 | refresh() only | C | form/sidebar/form_sidebar.js:64 |
| 37 | ThemeSwitcher | `dialog`/`body`/`themes[].$html` | prop | j | ui/theme_switcher.js:10-83 | selected classes | 2/0 | `dialog.$wrapper.remove()`; re-parent body | B | ui/user_settings_dialog.js:506, :507 |
| 38 | user settings | `frappe.ui._user_settings_dialog` | glob | j | ui/user_settings_dialog.js:51 | old $wrapper removed | 0/0 | — | D | — |
| 39 | workspace skeleton templates | html | html | str | ui/workspace_loading_skeleton.html | removed when loaded | 1/0 | prepend | C | views/workspace/workspace.js:1590 |
| 40 | FileUploader (merged with the misc row; max counts) | `wrapper` (caller or dialog.body) / `dialog` / `uploader` | inb | e | file_uploader/file_uploader.bundle.js:51-172 | **Vue app.mount replaces wrapper content** | 16/5 (constructions; node members read 0) | hand in node; read uploader.files | A | form/grid_import.js:259; form/controls/attach.js:62; erp:public/js/utils/serial_batch_inline_editor.js:1464 |
| 41 | WebForm `frappe.web_form` (merged with misc; max) | `parent` (.web-form-wrapper), `$next_button`, fields_dict | glob | j | web_form/web_form.js:9-115 | **parent.empty()** on make | 2/0 (DB client scripts unseen) | after_load hook; name read | C | fr:website/web_form/request_to_delete_data/request_to_delete_data.js:2; fr:templates/includes/comments/comments.html:157 |
| 42 | WebFormList `frappe.web_form_list` (merged with misc) | `wrapper`/`table`/rows | glob | j | web_form/web_form_list.js:8-401 | emptied each refresh | 0/0 | — | D | — |

### list

| # | Owner | Member | Kind | Node | Defined at | Framework rewrites after handout | fr/erp | Ops | Bkt | Examples |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | BaseList (cur_list, listview arg) | `$result` | prop | j | list/base_list.js:360 | **rows removed and re-appended every render** (list_view.js:1276-1312); header re-prepended; re-classed; Kanban replaces the property | 28/1 (fr all subclasses in views/) | empty/html/append/prepend, delegated on, mount 3rd-party widgets | B | views/file/file_view.js:330; views/gantt/gantt_view.js:198; erp:manufacturing/doctype/work_order/work_order_calendar.js:104 |
| 2 | BaseList | `$no_result` | prop | j | base_list.js:369 | **`.html()` every after_render** (list_view.js:1229) | 3/0 | html, append | B | fr:core/doctype/rq_worker/rq_worker_list.js:3; views/file/file_view.js:36 |
| 3 | BaseList | `$frappe_list` | prop | j | base_list.js:318 | appended to, never emptied | 3/0 | html (dashboard replaces content), append | A | views/dashboard/dashboard_view.js:48; views/kanban/kanban_view.js:164 |
| 4 | BaseList | `$paging_area` | prop | j | base_list.js:388 | toggled | 5/0 | find(.level-left/right).append | B | views/reports/report_view.js:255; views/gantt/gantt_view.js:289 |
| 5 | BaseList | `paging_button_group` | prop | j | base_list.js:399 | click bound | 0/0 | — | D | — |
| 6 | BaseList/ListView | `$freeze` | prop | j | base_list.js:378; list_view.js:672 | lives in $result | 0/0 | — | D | — |
| 7 | BaseList | `$page` | prop | j | base_list.js:181 | parts written via page.* | 7/0 | find().addClass/css/empty | B | views/image/image_view.js:62; views/kanban/kanban_board.bundle.js:681 |
| 8 | BaseList | `parent` element + expandos `list_view`, `disable_scroll_to_top` | prop | e | list_factory.js:56; list_view.js:78,250 | expandos | 1/0 | read expando | C | views/container.js:89 |
| 9 | BaseList | `page` (Page handed to listview_settings) | prop | both | base_list.js:180 | list re-classes main/page_form; hides the sidebar via body.no-list-sidebar | 30/42 | Page API; sidebar.remove/append | C | erp:selling/doctype/sales_order/sales_order_list.js:64; fr:core/doctype/recorder/recorder_list.js:5; erp:manufacturing/doctype/bom_update_log/bom_update_log_list.js:19 |
| 10 | FilterArea | `listview.$filter_section` / `$filter_list_wrapper` | prop | j | base_list.js:674,678 | refresh button prepended; **wiped by clear_custom_actions when hide_page_form is set** | 1/0 | parent for FilterGroup | A | views/reports/report_view.js:115 |
| 11 | FilterArea | `standard_filters_wrapper` | prop | j | base_list.js:1166 | quick-filter dropdowns re-html'd | 1/0 | find(select).append(option) | B | fr:core/doctype/rq_job/rq_job_list.js:18 |
| 12 | FilterArea | `$mobile_id_filter`/`filter_button`/`filter_x_button`/`filter_list` | prop | j | base_list.js:702,1416-1418 | re-parented on resize | 0/0 | — | D | — |
| 13 | BaseList | `refresh_button` | prop | j | base_list.js:243 | no | 0/0 | — | D | — |
| 14 | ListView | `workflow_action_items` | prop | j | list_view.js:376 | toggled per selection | 0/0 | — | D | — |
| 15 | ListView | `restricted_list` | prop | j | list_view.js:384 | no | 0/0 | — | D | — |
| 16 | ListView | `$list_skeleton` | prop | j | list_view.js:137 | show/hide | 0/0 | — | D | — |
| 17 | ListView | `$list_end` | prop | j | list_view.js:280 | observed | 0/0 | — | D | — |
| 18 | ListView | `$list_head_subject`/`$checkbox_actions`/`$checks`/`$checkbox_cursor` | prop | j | list_view.js:2590-2815 | reassigned each check | 2/0 | parents().addClass | B | views/file/file_view.js:140, :526 |
| 19 | ListView virtualization | `virtualization_state.container` | prop | e | list_view_virtualization.js:31 | rows swapped per frame | 0/0 | — | D | — |
| 20 | ListViewSelect | `$wrapper`/`$trigger` (.view-switcher) | prop | j | list_view_select.js:38-39 | re-dressed; emptied with custom_actions | 1/0 | selector exclusion | C | ui/page.js:448 |
| 21 | ListView | `get_count_element()` return | ret | j | list_view.js:1484 | html each count | 2/0 | override + html | B | views/reports/report_view.js:250, :484 |
| 22 | ListView | `get_subject_element()`/`find_checkbox_by_docname()` | ret | both | list_view.js:2133,1414 | n/a | 0/0 | (Cypress unseen) | D | — |
| 23 | ListView | row/header HTML builders (get_list_row_html, get_tags_html, get_like_html, get_header_html...) | html | str | list_view.js:797-2180 | inserted per render | 12/0 | overrides; reuse in templates | C | views/kanban/kanban_board.bundle.js:1493; views/inbox/inbox_view.js:100 |
| 24 | listview_settings | `onload(listview)` | cb | both | list_view.js:616 | rows rebuilt each refresh | 23/24 | Page API, filter wrapper append | C | erp:accounts/doctype/sales_invoice/sales_invoice_list.js:35; fr:core/doctype/rq_job/rq_job_list.js:4 |
| 25 | listview_settings | `refresh(listview)` (must run after after_render) | cb | both | base_list.js:567 | writes survive one render | 3/0 | $no_result.html | B | fr:core/doctype/rq_worker/rq_worker_list.js:2; fr:email/doctype/email_queue/email_queue_list.js:12 |
| 26 | listview_settings | `before_render`/`primary_action`/`get_form_link`/`dropdown_button` | cb | str | list_view.js:493-2106 | n/a | 5/0 | return strings | C | fr:printing/doctype/print_format/print_format_list.js:20 |
| 27 | listview_settings | `button.get_label/get_description` (raw HTML) | html | str | list_view.js:2001 | re-rendered | 4/0 | return HTML | C | fr:desk/doctype/todo/todo_list.js:13 |
| 28 | listview_settings | `formatters[f]` | html | str | list_view.js:1823 | re-rendered | 2/1 | return HTML | C | fr:core/doctype/file/file_list.js:2; erp:stock/doctype/item/item_list.js:18 |
| 29 | ListFactory | `cur_list` / `frappe.views.list_view[x]` / `get_list_view` | glob | both | list_factory.js:6,54,99 | swapped per route | 4/1 (node-reaching lines only) | sidebar append; $page.find | C | pjs:frappe/logtypes.js:15; erp:manufacturing/doctype/bom_update_log/bom_update_log_list.js:19 |
| 30 | list DOM | `.list-row-container`/`.list-row`/`.inner-group-button`/`.view-switcher`/`.filter-section`/`body.no-list-sidebar`... | sel | e | list_view.js:1569-2047; base_list.js:298 | rebuilt per render | 3/0 | find, close dropdowns, addClass | E | ui/page.js:223; views/kanban_v2/kanban_page.js:109 |
| 31 | ListGroupBy (dead) | `$wrapper` | prop | j | list_sidebar_group_by.js:20 | html | 0/0 | — | D | — |
| 32 | ListSettings/BulkOperations/list_filter dialogs | dialogs and field wrappers | prop | j | list_settings.js:32; bulk_operations.js:534 | internal | 0/0 | — | D | — |

### views

| # | Owner | Member | Kind | Node | Defined at | Framework rewrites after handout | fr/erp | Ops | Bkt | Examples |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Container (`frappe.container`) | `page` (current page element) | prop | e | views/container.js:81 | hide/show per route | 9/0 | read .page/.list_view; expando save_action | C | fr:core/doctype/data_import/data_import.js:1442; ui/page.js:28 |
| 2 | `window.cur_page` (is the Container) | `cur_page.page` / `.page.page` | glob | e | container.js:8,51 | as above | 9/7 | querySelector, find().val, pass Page to shortcuts | C | pjs:onboarding_tours/onboarding_tours.js:125; form/controls/dynamic_link.js:15; erp:selling/page/point_of_sale/pos_item_cart.js:267 |
| 3 | Container | `add_page()` return | ret | e | container.js:38-49 | **pageview innerHTML; show_message_page `.html()` can overwrite** (pageview.js:112,286) | 7/0 (all inside views/) | make_app_page parent, addClass | A | views/treeview.js:113; views/workspace/workspace.js:36 |
| 4 | `frappe.pages[label]` | page element (+ expandos) | glob | e | container.js:46; pageview.js:95 | innerHTML; hidden/shown per route | 47/15 (critic; agent 38/28) | make_app_page, find().addClass/append, on(show/hide), delete | A | fr:core/page/dashboard_view/dashboard_view.js:36; erp:selling/page/sales_funnel/sales_funnel.js:11; erp:manufacturing/doctype/bom/bom_tree.js:33 |
| 5 | frappe.views.Page | `on_page_load(wrapper)`/`on_page_show(wrapper)`/`refresh(wrapper)` | cb | e | pageview.js:118-254 | as #4 | 19/13 | make_app_page; wrapper.page.*; $(wrapper).find | A | fr:printing/page/print_format_builder/print_format_builder.js:6; erp:selling/page/point_of_sale/point_of_sale.js:3 |
| 6 | Container | `show`/`hide` events on the page element | evt | e | container.js:76,88 | n/a | 14/0 | on/bind | C | fr:printing/page/print/print.js:11; ui/page.js:220; form/form.js:160 |
| 7 | Container | `$(document)` `page-change` (arg: page element) | evt | e | container.js:86 | n/a | 7/0 | on | C | ui/toolbar/awesome_bar.js:526; ui/mobile_nav.js:32 |
| 8 | Container | `body[data-route]`, `body[data-sidebar]` | sel | e | container.js:30-31 | rewritten every route | 13/1 (SCSS) | CSS | E | fr:public/scss/desk/main.scss:7; erp:public/scss/erpnext.scss:82 |
| 9 | Container | `#page-<label>` / `[data-page-route]` | sel | e | container.js:40-41 | none | 6/1 (SCSS) | CSS, getElementById | E | fr:public/scss/desk/report.scss:2; erp:public/scss/erpnext.scss:45 |
| 10 | Factory | `make_page()` return | ret | e | views/factory.js:32-53 | make_app_page writes | 2/0 | parent for lists | A | list/list_factory.js:29, :56 |
| 11 | container.js | `frappe.get_current_page()` | ret | both | container.js:16 | n/a | 8/0 | identity, breadcrumbs | C | fr:website/doctype/web_form/web_form.js:903; views/breadcrumbs.js:275 |
| 12 | FormFactory | `frappe.views.formview[dt]` (element with .frm) | glob | e | views/formview.js:13 | Form builds the page inside | 8/0 | read .frm | C | model/model.js:713; fr:printing/page/print/print.js:641 |
| 13 | frappe.views.Page | `island_container`/`wrapper` | prop | both | pageview.js:92,142 | empty().append on error | 0/0 | — | D | — |
| 14 | QueryReport (`frappe.query_report`) | `page` | prop | both | base_list.js:180; query_report.js:23 | **inner toolbar and menu cleared on every report switch** (query_report.js:173-174) | 1/28 | add_inner_button (stored $btn toggled), add_custom_menu_item | B | erp:accounts/report/accounts_payable/accounts_payable.js:200; erp:public/js/financial_statements.js:358 |
| 15 | QueryReport | `$page`/`parent` | prop | both | base_list.js:181 | toggle_filter_display toggles hide-control | 0/0 | (indirect via toggle_filter_display ×20 erp) | D | — |
| 16 | QueryReport | `$report`/`$chart`/`$summary`/`$message`/`$status`/`$report_footer`/... | prop | j | query_report.js:2472-2504 | heavily emptied/re-html'd | 0/0 | — | D | — |
| 17 | QueryReport | `filters[]` / `get_filter()` controls | prop | both | query_report.js:633-680,1656 | wrappers hidden; rebuilt per report | 0/22 | value/df reads, set_value | C | erp:selling/report/sales_analytics/sales_analytics.js:11; erp:accounts/report/general_ledger/general_ledger.js:253 |
| 18 | QueryReport | `datatable` + `after_datatable_render(datatable)` | cb | e | query_report.js:1262,1269 | destroyed/recreated each refresh | 0/16 | rowmanager API; 2 `$(dt.wrapper).find('.dt-row-0')...click()` | C | erp:stock/report/stock_analytics/stock_analytics.js:89; erp:accounts/report/accounts_payable/accounts_payable.js:221 |
| 19 | QueryReport | `chart` | prop | e | query_report.js:1348 | destroyed + $chart emptied each refresh | 0/8 | chart.update/draw/data | C | erp:stock/report/stock_analytics/stock_analytics.js:128 |
| 20 | QueryReport | `onload(report)` / `after_refresh(report)` (report may be headless) | cb | both | query_report.js:489,995 | as members | 2/25 | Page API, get_filter | C | erp:accounts/report/accounts_payable/accounts_payable.js:198; fr:core/report/user_doctype_permissions/user_doctype_permissions.js:19 |
| 21 | QueryReport | `formatter` output | html | str | query_report.js:1576 | DataTable re-renders | 1/66 (approx.) | build strings | C | erp:accounts/report/gross_profit/gross_profit.js:108 |
| 22 | report_utils | `get_export_dialog()` return | ret | both | views/reports/report_utils.js:236 | n/a | 2/0 (both in views/) | show | C | views/reports/query_report.js:2027 |
| 23 | ReportView | `$datatable_wrapper`/`$charts_wrapper`/`datatable`/`chart` | prop | j | report_view.js:94-672 | emptied per build | 0/0 | — | D | — |
| 24 | TreeView | `frappe.views.trees[dt]` / `cur_tree` | glob | both | treeview.js:6,24,461 | rebuilt by make_tree | 0/9 | load_children, nodes[x] | C | erp:accounts/doctype/account/account_tree.js:94, :369 |
| 25 | TreeView | `page` via onload(treeview)/post_render | cb | both | treeview.js:121,278,541 | page_form re-classed | 0/15 | Page API | C | erp:accounts/doctype/account/account_tree.js:226; erp:projects/doctype/task/task_tree.js:37 |
| 26 | TreeView | `body`/`node_view`/`parent`/`$filter_area`/`$search_input`/... | prop | both | treeview.js:113-395 | node_view emptied every select | 0/0 | — | D | — |
| 27 | TreeView (pass-through) | onrender(node)/on_node_render/toolbar click/get_label | cb | j | treeview.js:443,449,559 | tree rebuilt | 0/6 (same erp lines as page-dialog #45) | addClass, insertAfter/Before, remove | B | erp:public/js/utils.js:535; erp:accounts/doctype/account/account_tree.js:103; erp:accounts/doctype/cost_center/cost_center_tree.js:79 |
| 28 | Calendar | `$wrapper`/`$cal`/`$toolbar`/`footnote_area` | prop | j | calendar/calendar.js:170-236 | FullCalendar owns | 0/0 | (calendar.js:161 binds 'show' on a descendant; never fires) | D | — |
| 29 | GanttView | `$result` via prototype patch | prop | j | gantt/gantt_view.js:197,314 | **emptied before every render** | 0/1 | prepend `<style>` | B | erp:manufacturing/doctype/work_order/work_order_calendar.js:104 |
| 30 | GanttView | `gantt_custom_popup_html` | html | str | gantt_view.js:258 | n/a | 0/1 | return string | C | erp:projects/doctype/task/task_list.js:36 |
| 31 | ImageView/GalleryView | `gallery.wrapper`/`pswp_root` | prop | j | image/image_view.js:174,203 | $result.html each render | 0/0 | — | D | — |
| 32 | Map/File/Dashboard/Inbox views | containers | prop | j | map_view.js:46; file_view.js:30; dashboard_view.js:48-190 | html/empty | 0/0 | — | D | — |
| 33 | Kanban classic (deprecated) | `$result`/`board.wrapper`/`$kanban_*` | prop | j | kanban/kanban_board.bundle.js:431-1431 | re-render | 0/0 | — | D | — |
| 34 | KanbanV2Page | `wrapper`/`$container`/`$selection_bar`/... | prop | j | kanban_v2/kanban_page.js:76-2258 | container emptied | 0/0 | — | D | — |
| 35 | kanban_v2.settings | `renderCard(card, el)`/`renderColumnHeader`/`renderEmptyState` | cb | e | kanban_page.js:1140; core/kanban_core.js:533-690 | elements recycled (replaceChildren) | 0/0 (erp 3 settings files use only canMoveCard) | — | D | — |
| 36 | Workspace | `wrapper`/`page`/`body`/`$page` | prop | both | workspace/workspace.js:46-120 | EditorJS re-init | 0/0 | — | D | — |
| 37 | workspace blocks | `.ce-block` / `.workspace-skeleton` | sel | e | workspace/blocks/*.js | EditorJS lifecycle | 2/0 | closest().hide, querySelector | E | widgets/onboarding_widget.js:485; pjs:onboarding_tours/onboarding_tours.js:342 |
| 38 | CommunicationComposer | `dialog` | prop | both | views/communication.js:24 | $body rearranged; areas emptied | 2/0 | $wrapper.css(z-index), set_value | B | request.js:644; fr:printing/page/print/print.js:637 |
| 39 | InteractionComposer | `dialog` | prop | both | views/interaction.js:14 | select refilled | 0/5 | get_field().wrapper closest().hide() | B | erp:public/js/utils/crm_activities.js:78, :80, :95 |
| 40 | TranslationManager/RenderPreviewer | `dialog` | prop | both | translation_manager.js:9; render_preview.js:18 | n/a | 0/0 | — | D | — |
| 41 | breadcrumbs (deprecated) | `$breadcrumbs` getter | ret | j | views/breadcrumbs.js:273 | refilled by Page | 0/0 | — | D | — |

### misc (widgets, utils, dom, model, data_import, pickers, scanner, top-level and bundle files)

The FileUploader, `frappe.web_form`, `frappe.web_form_list` and startup/app_ready rows were merged into ui-rest (#40, #41, #42, #3).

| # | Owner | Member | Kind | Node | Defined at | Framework rewrites after handout | fr/erp | Ops | Bkt | Examples |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Widget (all widgets) | `widget` (div.widget) | prop | j | widgets/base_widget.js:77 | hidden/full-width/zoom-out; remove | 0/0 | (reached by `.widget` selector) | D | — |
| 2 | Widget | `body` | prop | j | base_widget.js:91 | `.empty()` in every subclass; shadow element replaces innerHTML | 0/0 | — | D | — |
| 3 | Widget | `action_area` (.widget-control) | prop | j | base_widget.js:92 | **`.empty()` on customize** (:27) wipes block.js's dropdown | 0/0 | (selector use under #12) | D | — |
| 4 | Widget | `title_field`/`subtitle_field` | prop | j | base_widget.js:89-90 | innerHTML/html | 0/0 | — | D | — |
| 5 | Widget | `head`/`footer`/`show_or_hide_button`/`resize_button` (never assigned) | prop | j | base_widget.js:57,93-94 | report-summary inserted | 0/0 | — | D | — |
| 6 | Widget/WidgetGroup/SingleWidgetGroup | `container` (caller-provided) | inb | j | base_widget.js:73; widget_group.js:67 | appendTo; group body emptied | 5/0 | find('.widget-group-head').hide | A | views/dashboard/dashboard_view.js:153, :190; views/workspace/blocks/block.js:17 |
| 7 | WidgetGroup | `widget_area`/`title_area`/`control_area`/`body` | prop | j | widget_group.js:61-65 | body emptied; Sortable | 0/0 | — | D | — |
| 8 | NewWidget | `widget`/`body` | prop | j | new_widget.js:31,34 | remove | 0/0 | — | D | — |
| 9 | ChartWidget | loading/empty/chart_wrapper/$summary/... | prop | j | chart_widget.js:69-972 | rebuilt every set_body | 0/0 | — | D | — |
| 10 | ChartWidget/NumberCardWidget | island mount container | cb | j | chart_widget.js:169; number_card_widget.js:338 | body emptied on refresh | 0/0 (islands named in DB docs) | — | D | — |
| 11 | NumberCard/QuickList/Onboarding widgets | internal nodes | prop | j | number_card_widget.js:305-511; quick_list_widget.js:30-266; onboarding_widget.js:22-32 | recreated each refresh | 0/0 | — | D | — |
| 12 | widget DOM | `.widget`, `.widget.<type>`, `.widget-control` | sel | e | base_widget.js:77-87 | class toggles | 12/0 | addClass, css, find().append | E | views/workspace/blocks/block.js:115, :197; views/workspace/blocks/chart.js:40 |
| 13 | `frappe.create_shadow_element` | `root_element` (shadowRoot) + wrapper innerHTML | cb | e | dom.js:402-444 | wrapper innerHTML replaced; body emptied per render | 2/0 (user scripts in DB unseen) | user scripts own the subtree | A | fr:desk/doctype/custom_html_block/custom_html_block.js:21; widgets/custom_block_widget.js:30 |
| 14 | frappe.dom | `freeze()`/`unfreeze()` → `#freeze` | glob | j | dom.js:142-185 | html/class/remove | 21/18 | calls only | C | fr:core/page/permission_manager/permission_manager.js:460; erp:selling/page/point_of_sale/pos_controller.js:172 |
| 15 | frappe.dom | `by_id`/`add`/`css` return | ret | e | dom.js:10,117,132 | no | 0/0 | — | D | — |
| 16 | frappe.dom | `set_style()` return (id-based replacement) | ret | e | dom.js:95 | replaces same-id style | 4/0 | return ignored | C | desk.js:329; fr:printing/page/print/print.js:1308 |
| 17 | `frappe.get_data_pill` | return + remove_action cb | ret | j | dom.js:322 | no | 1/0 | caller appends | C | form/sidebar/attachments.js:167 |
| 18 | `frappe.get_modal` | return (the factory behind Dialog.$wrapper; overridden twice for web) | ret | j | dom.js:346 | becomes Dialog.$wrapper | 4/0 | classes, on(shown), find, modal() | B | ui/dialog.js:37; ui/toolbar/awesome_bar.js:22; pjs:desktop_icons.bundle.js:836 |
| 19 | `frappe.load_image` | onload(img) | cb | e | dom.js:284 | no | 0/0 | — | D | — |
| 20 | utils | `set_footnote()` return (also writes into the caller's wrapper) | ret | j | utils/utils.js:489 | html/remove on the next call | 2/0 | stored, passed back | C | form/form.js:1938; views/calendar/calendar.js:175 |
| 21 | utils | `bind_actions_with_object($el, obj)` | inb | j | utils.js:1213 | off/on click.class_actions on the caller node | 11/1 | delegated handlers | A | fr:website/doctype/web_form/web_form.js:507; erp:public/js/call_popup/call_popup.js:18 |
| 22 | utils | `build_summary_item()` return | ret | j | utils.js:1782 | no | 2/1 | appendTo | C | views/reports/query_report.js:1001; erp:public/js/bank_reconciliation_tool/number_card.js:52 |
| 23 | utils | `add_select_group_button()` return | ret | j | utils.js:1854 | label rewritten | 0/0 | — | D | — |
| 24 | utils | `add_custom_button(html, action, cls, title, type, wrapper)` | inb | j | utils.js:1841 | writes into the caller wrapper | 6/0 | append/prepend | A | widgets/base_widget.js:30; views/workspace/blocks/header.js:42 |
| 25 | utils | `setup_search($wrapper, ...)` | inb | j | utils.js:1058 | appends .no-results-message; show/hide children | 8/0 | writes into the caller's $body | A | fr:desk/doctype/global_search_settings/global_search_settings.js:74; list/base_list.js:1029 |
| 26 | utils | `highlight_pre`/`setup_timer`/`scroll_to`/`frappe.ui.scroll` | inb | j | utils.js:2250,1113,357; common.js:140 | hljs rewrites `<pre>`; .text() every second | 22/2 | write (highlight/timer) + read (scroll) | A | fr:custom/doctype/client_script/client_script.js:8; views/treeview.js:40 |
| 27 | dashboard_utils | `render_chart_filters(..., container)` | inb | j | utils/dashboard_utils.js:2-66 | .filter-label html | 1/0 | append | A | widgets/chart_widget.js:263 |
| 28 | `frappe.avatar_group` | return | ret | j | utils/common.js:85 | no | 2/0 | append | C | views/kanban/kanban_board.bundle.js:1540 |
| 29 | `frappe.avatar` / `get_avatar` | HTML | html | str | common.js:4,46 | no | 16/2 | inserted | C | fr:website/js/website.js:249; erp:public/js/templates/crm_notes.html:18 |
| 30 | `frappe.utils.icon` | HTML | html | str | utils.js:1534 | no | 362/30 (critic 369/30, approx.) | inserted | C | erp:public/js/utils.js:1605; widgets/base_widget.js:31 |
| 31 | utils | `desktop_icon`/`app_logo`/`flag`/`bold`/`get_form_link(html)` | html | str | utils.js:286-1561 | no | 36/12 | inserted | C | ui/mobile_nav.js:230; erp:public/js/utils/draft_link_guard.js:48 |
| 32 | microtemplate | `render_template`/`render`/`template.compile` | html | str | microtemplate.js:103 | no | 47/13 | .html(...) | C | utils/address_and_contact.js:158; erp:public/js/payment/payments.js:45 |
| 33 | pretty_date | `comment_when` + `.frappe-timestamp[data-timestamp]` | html | str | utils/pretty_date.js:81 | **every 60 s `.html()` on every .frappe-timestamp in the document** (:98-108) | 18/2 | inserted | C | fr:core/doctype/error_log/error_log.js:69; erp:public/js/party_items.js:257 |
| 34 | `frappe.markdown` | HTML | html | str | utils/tools.js:108 | no | 8/0 | inserted | C | widgets/onboarding_widget.js:191 |
| 35 | `frappe.meta.set_indicator_formatter` | HTML | html | str | model/meta.js:80 | no | 0/0 | — | D | — |
| 36 | frappe.contacts | `render_address_and_contact(frm)`/`clear_...` write into address_html/contact_html wrappers | inb | j | utils/address_and_contact.js:158,274 | **`.html(render_template)`; `.html('')`** | 0/23 | calls only | A | erp:crm/doctype/lead/lead.js:48; erp:crm/doctype/prospect/prospect.js:32 |
| 37 | model | `$(document)` `rename` | evt | none | model/model.js:831; sync.js:64 | n/a | 2/0 | on | C | views/container.js:34 |
| 38 | WebForm | `$next_button`/`$previous_button`/`page_breaks` + footer selectors | prop | j | web_form/web_form.js:87-115 | show/hide per step | 0/0 | — | D | — |
| 39 | ImportPreview/ImportTreePreview | caller wrapper (HTML field $wrapper), `$table_preview`, `datatable` | inb | j | data_import/import_preview.js:75-316 | **wrapper.html()**; tree empty | 2/1 | hand in $wrapper; selector reads | A | fr:core/doctype/data_import/data_import.js:2197; erp:accounts/doctype/bank_statement_import/bank_statement_import.js:366 |
| 40 | DataExporter | `dialog` | prop | both | data_import/data_exporter.js:32 | Dialog-owned | 0/0 | — | D | — |
| 41 | DataImportWizard | `$root`/`$card`/`$panels`/... | prop | j | pjs:data_import_wizard.bundle.js:207-244 | **$(wrapper).empty().append($root)**; re-parents form field nodes | 0/0 | — | D | — |
| 42 | color/icon/phone pickers | picker nodes | prop | both | color_picker/color_picker.js:32; icon_picker/icon_picker.js:18; phone_picker/phone_picker.js:17 | lists rebuilt | 1/0 | search_input.focus | C | form/controls/phone.js:119 |
| 43 | Scanner | `$scan_area`/`$camera_area`/`dialog`; container inbound | prop | j | scanner/index.js:21-282 | scan area emptied per scan | 1/0 | construct only | C | form/controls/data.js:173 |
| 44 | desk.js/request.js | `frappe.temp_container` (also ui-rest #2) / `session_expired_dialog` / `error_dialog` | glob | both | desk.js:428,465; request.js:672 | error_dialog $body.html | 0/0 | — | D | — |
| 45 | desk.js/request.js | `html.<browser>`, `body.desktop-page`, `body[data-ajax-state]` | sel | e | desk.js:541; request.js:418,719 | toggled per request | 1/0 (Cypress unseen) | read attr | E | pjs:onboarding_tours/onboarding_tours.js:343 |
| 46 | frappe.call | `opts.btn` (caller button disabled) | inb | both | request.js:421,478 | prop(disabled) | 22/8 (approx.) | framework writes into the caller node | A | (grep `btn: `) |
| 47 | router/help/flow_launcher | body-level `a` click intercept, `a.help-link`, `[data-flow-toggle]` | sel | e | router.js:26; utils/help.js:56; pjs:flow_launcher.bundle.js:56 | preventDefault + set_route on every `<a>` | 1/0 | markup producers | E | form/templates/form_sidebar.html:79 |
| 48 | logtypes | `show_log_retention_message` writes into `cur_list.page.sidebar` | inb | j | logtypes.js:13-18 | appendTo | 2/1 | append | A | fr:core/doctype/activity_log/activity_log_list.js:9; erp:manufacturing/doctype/bom_update_log/bom_update_log_list.js:25 |
| 49 | RoleEditor/ModuleEditor | `wrapper`/`multicheck`/`perm_dialog` | prop | both | roles_editor.js:26-150; module_editor.js:4 | monkeypatches multicheck | 0/0 | — | D | — |
| 50 | desktop_icons bundle | `frappe.desktop_grids` etc. + `.icons-container` | glob | j | pjs:desktop_icons.bundle.js:57-836 | rebuilt | 1/0 | `$('.icons-container').first()` as a parent | E | pjs:billing.bundle.js:74 |
| 51 | bootstrap-4-web Dialog override | web `get_primary_btn`/`get_secondary_btn` | ret | j | pjs:bootstrap-4-web.bundle.js:44-67 | removeClass hidden | 0/0 (counted under Dialog) | — | D | — |
| 52 | misc dialogs (DiffView, change password, help video, preview_email, talk_to_us...) | `dialog` | ret | both | utils/diffview.js:11; utils/user.js:28; ... | Dialog-owned | 0/0 | — | D | — |

### critic additions (areas that no inventory agent was assigned)

| # | Owner | Member | Kind | Node | Defined at | Framework rewrites after handout | fr/erp | Ops | Bkt | Examples |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | FieldGroup / Dialog (via Layout) | `fields_dict[f]` / `get_field(f)` | prop | both | form/layout.js:270 (via ui/field_group.js:5, dialog.js:67) | Layout refresh toggles hide-control | 157/140 (approx.; node-reaching subset 59/61) | get/set_value; $wrapper html/empty/append/hide; $input.on | C | erp:public/js/bank_reconciliation_tool/dialog_manager.js:158; erp:public/js/utils/crm_activities.js:78 |
| 2 | Page | `fields_dict[f]` | prop | both | ui/page.js:57,1269 | clear_fields removes | 20/15 | get_value, get_query | C | erp:accounts/doctype/account/account_tree.js:17; fr:core/doctype/module_def/module_def_list.js:6 |
| 3 | Desktop page | `desktop_screen` document event (data.desktop: page, wrapper) | evt | j | fr:desk/page/desktop/desktop.js:139,40,78 | **page.body `.empty()` and re-render every show** (:72) | 1/1 | add_menu_item only | C | pjs:billing.bundle.js:71; erp:public/js/utils/demo.js:3 |
| 4 | frappe.ui.keys | `add_shortcut({page, target})` | cb | both | ui/keyboard.js:35-76 | framework reads page.wrapper.is(':visible'), clicks target | 26/7 | caller hands in nodes (read/click only) | C | erp:selling/page/point_of_sale/pos_item_selector.js:441; ui/page.js:594 |
| 5 | ui/island | `mount_island(name, el, props)` | inb | e | ui/island/loader.js:42,121 | island owns children until unmount | 6/0 | mount into caller node | A | fr:core/page/dashboard_view/dashboard_view.js:122; views/pageview.js:189; ui/chart.js:57 |
| 6 | `frappe.ui.button` | `button()` return / `.html()` / `.dress(el)` | ret | both | ui/components/button.js:124-213 | **dress() re-classes nodes it is given** (e.g. btn_primary) | 147/17 | append; toggleClass | B | erp:manufacturing/doctype/job_card/job_card.js:309; erp:public/js/bom_creator/bom_tree.js:109 |
| 7 | `frappe.ui.badge` | return / `.html()` | ret | both | ui/components/badge.js:87 | none | 33/29 | append | C | erp:accounts/doctype/account/account_tree.js:65; erp:projects/doctype/project/project.js:204 |
| 8 | `frappe.ui.empty_state` | return / `.html()` | ret | both | ui/components/empty_state.js:96,151 | none | 31/6 | append | C | erp:public/js/party_overview.js:84 |
| 9 | `frappe.ui.toast` | handle {$el} | ret | j | ui/components/toast.js:87 | update() re-renders | 42/4 | call only | C | erp:projects/doctype/task/task_kanban.js:6 |
| 10 | tooltip | `frappe.ui.tooltip(trigger)` / `Tooltip.delegate(container)` | inb | both | ui/components/tooltip.js:86,317 | data + listeners added to caller nodes | 14/1 | — | A | erp:accounts/doctype/chart_of_accounts_importer/chart_of_accounts_importer.js:214; fr:desk/page/desktop/desktop.js:61 |
| 11 | static components (skeleton, avatar, avatar_group, alert, divider, breadcrumbs, progress, stat_card, panel_header) | return / `.html()` | ret | both | ui/components/*.js | Progress updates its own fill | 45/9 (approx.) | append | C | erp:public/js/party_overview.js:332; erp:projects/doctype/project/project.js:236 |
| 12 | interactive components (Combobox, ContextMenu, Popover, HoverCard, BottomSheet, Tabs, TabButtons, Stepper, OptionalSections, SegmentedButton) | `el`/`$el`/`$trigger` + `.data('es-*')` | prop | both | ui/components/combobox.js:194 etc. | panels re-render; triggers re-classed | 54/4 | append the returned trigger | C | erp:public/js/bom_creator/operation_panels.js:8; ui/filters/field_select.js:16 |
| 13 | Form/Layout/PrintFormat/Workflow builders | `$wrapper` (caller node, Vue mounted) | inb | j | pjs:form_builder/form_builder.bundle.js:21,99; pjs:print_format_builder/print_format_builder.bundle.js:51 | app.mount replaces content | 7/0 | construct with fields_dict wrapper | A | fr:core/doctype/doctype/doctype.js:173; fr:workflow/page/workflow_builder/workflow_builder.js:26 |
| 14 | `frappe.ui.form.PrintView` (print page) | class + `print_wrapper`/`sidebar`/`print_format_field` + `input[data-fieldname=print_format|letterhead]` | glob | j | fr:printing/page/print/print.js:38-750 | **page.main `.empty().html()`** :50; preview re-renders | 0/3 | prototype.preview patch; global val() read | B | erp:public/js/print.js:17, :34, :35 |
| 15 | Dashboard (frm.dashboard) | `chart` / `render_graph()` | prop | e | form/dashboard.js:630-650 | chart_area.body emptied each render | 0/1 | render_graph call | C | erp:assets/doctype/asset/asset.js:529 |
| 16 | Tree / GanttView / QuickEntryForm / EmbeddedList | subclassing and prototype patching | glob | j | ui/tree.js; views/gantt/gantt_view.js; form/quick_entry.js:36 | n/a | 0/6 | override node-building renderers | B | erp:accounts/doctype/financial_report_template/financial_report_template.js:249; erp:manufacturing/doctype/work_order/work_order_calendar.js:65 |
| 17 | ERPNext SCSS | `.frappe-control[data-fieldname] .ql-editor`, `.control-input-wrapper`, `.modal-dialog`, `.page-actions`, `.list-row-head`, `.form-section-heading`... | sel | e | base_control.js:11-13; page.html; dom.js:346; list_view.js | n/a | 0/22 (approx.) | style overrides | E | erp:public/scss/erpnext.scss:609; erp:public/scss/point-of-sale.scss:13 |
| 18 | global selectors | `.btn:contains('New Contact')`, `$('.modal:visible')`, `.awesomplete > ul:not([hidden])`, `$('.form-message').text()` | sel | e | form/templates/address_list.html; dom.js:346; layout.js:142 | address/contact re-rendered | 0/6 (overlaps form-core #52, page-dialog #34) | hide, text, :visible | E | erp:accounts/doctype/shareholder/shareholder.js:38; erp:public/js/shop_floor/shop_floor.js:1336 |
| 19 | OnboardingTour | `frappe.ui.OnboardingTour`/`currentTourInstance` | glob | e | pjs:onboarding_tours/onboarding_tours.js:1,259 | none | 1/0 | selector-based highlighting | C | desk.js:136 |

## Framework rewrites after handout

These are nodes the framework hands out and then replaces, empties, re-html's or strips of classes itself. Apps that write into them already have to re-apply their writes, usually in `refresh(frm)`, `form_render`, `timeline_refresh` or `listview_settings.refresh`. That limits the guarantees a Vue port must give, but **every one of these is a lifecycle a port has to reproduce exactly**: when the reset happens, what survives it, and which hook fires afterwards.

**The node itself is replaced or removed, so held references go stale**
- `frm.layout` and the whole `frm.fields_dict`, including every control node, are rebuilt on a DocType Layout switch. The old wrapper is `.remove()`d (form/form.js:776-815). Existing precedent for "references go stale".
- A single field: `layout.replace_field` runs `prev.$wrapper.replaceWith(new.$wrapper)` (form/layout.js:242-254).
- `frm.add_custom_button` / `page.add_inner_button` buttons: `clear_custom_buttons` on every refresh_header (form.js:983, :1956) leads to `custom_actions.empty()` (ui/page.js:443).
- `dashboard.add_section()` bodies: `.custom` sections are removed on every refresh (dashboard.js:88).
- The form sidebar and everything in it (`frm.sidebar`, `add_user_action` returns, image nodes) are rebuilt on every render_form, and `page.sidebar.empty()` runs each time (form.js:666; form_sidebar.js:25).
- The grid row form's `fields_dict` controls: `form_area.empty()` and a new Layout on every open (grid_row_form.js:8-25).
- Grid `header_row`/`header_search`: rebuilt on every make_head (grid.js:533).
- Grid pagination buttons: `.grid-pagination` is re-html'd when the page count changes (grid_pagination.js:17).
- `BaseTimeline.parent`: replaced by `replaceWith`, so the stored reference is detached.
- `ControlInput.$input` for Rating: replaced by `input_area.html()` (rating.js:21).
- ControlAttach without `$input`: the whole wrapper is `.html()`'d (attach.js:126).
- `SortSelector.make()` removes any `.sort-selector` already in the parent (sort_selector.js:17).
- `pageview.show_message_page` can `.html()` over an existing `frappe.pages` entry (pageview.js:286).
- `KanbanCore` recycles card elements (`replaceChildren`, kanban_core.js:415).

**Contents emptied or re-html'd while the node stays**
- `layout.message`: `.empty()` on every render_form (layout.js:134 via form.js:677).
- `dashboard.stats_area_row`: `.empty()` on reset. Progress body: `.empty()`. `set_headline*` blocks are cleared.
- ControlHTML `$wrapper`: refresh re-renders `df.options` (html.js:6-11, :36).
- `disp_area`: `.html(formatted)` on every read-only refresh (base_input.js:165). This wipes ERPNext telephony's button and custom_field's innerHTML write.
- Grid `columns[f].static_area`: `.html()` on every refresh_field (grid_row.js:1552). Template-mode `row_display` is re-rendered.
- `listview.$result`: rows removed and re-appended on every render (list_view.js:1276-1312). `$no_result` is `.html()`'d on every after_render (list_view.js:1229).
- `frm.timeline` items: `.empty()` on every refresh (base_timeline.js:47).
- `attachment_preview`: `.html()` on show and `.empty()` on hide.
- `SettingsDialogPanel.$body`: `.empty()` and re-render on refresh (settings_dialog.js:97-100).
- `Sidebar.$items_container`: `.html('')` on every shell change (sidebar.js:571).
- `EmbeddedList.$result`: `.empty()` every render. Page `page_form`: `clear_fields().empty()`. `icon_group`: `clear_icons().empty()`.
- `$title_area`: the breadcrumb `<ol>` is rebuilt on every `set_title`/`set_breadcrumbs` (page.js:1081-1083).
- The `frappe.ui.chart` target: the island mount replaces its children, and `show_error` runs `.empty().append()` (chart.js:57, :80-90).
- Widget `action_area`: `.empty()` on customize (base_widget.js:27).
- QueryReport inner toolbar and menu: cleared on every report switch (query_report.js:173-174).
- The desktop page body is `.empty()`'d on every show (desktop.js:72).
- Every `.frappe-timestamp` in the document is `.html()`'d every 60 s (pretty_date.js:98-108).

**Classes, listeners or labels stripped from a node that is kept**
- `Column.resize_all_columns`: `$col.removeClass()` (all classes), then re-adds only its own (column.js:52-56).
- `page.clear_action_of`: `.unbind('click')` on `btn_primary`/`btn_secondary` (page.js:411).
- Dialog `set_primary_action`/`set_secondary_action`: `.off('click')` and re-dress (dialog.js:264-291).
- `frappe.ui.button.dress(el)`: re-classes the node it is given (button.js:185-213).
- The alt-shortcut underline `.html()`s button labels (alt_keyboard_shortcuts.js:194).
- `page.clear_indicator`: `removeClass()` of every class (page.js:292).
- `change_inner_button_type`: `removeClass()` on grouped items (page.js:1001).
- `hide-control` and `has-error*` toggled on every control refresh. `hide-control`/`empty-section` on sections. `editable-row`/`error`/`bold` on grid rows.
- `frm.wrapper` status classes and `data-state`, set on every refresh and save.

**Nodes moved to another parent**
- Dialog `open_sheet` (mobile) moves `modal_body` and the footer children into a BottomSheet and back (dialog.js:370-385).
- MobileNav moves `Sidebar.$items_container` into a sheet (mobile_nav.js:186-200).
- DataImportWizard re-parents form field nodes. data_import.js detaches and appends control wrappers.
- ERPNext CRMActivities appends `.form-footer` into an HTML field (crm_activities.js:17).
- `ThemeSwitcher.body` is re-parented into a settings panel (user_settings_dialog.js:507).

## What this means for the Vue port

The contract rule is: **Vue creates each handed-out element once and never replaces it; inside it, jQuery owns the DOM.** Applied to each bucket:

**A. Mount points (46)**
- Vue renders the element (control `.frappe-control`, `page.main`, `frappe.pages[x]`, `dialog.$body`, `SettingsDialogPanel.body`, `add_section` body) as an empty, stable shell and never patches its children. In practice: no `v-html` and no child vnodes inside it. Either an empty element obtained through a ref, or a `v-once` region.
- The element must be real and attached when the handout happens: `on_page_load(wrapper)`, `render_input`, `add_section()` return, `make_control().$wrapper`. Apps write into it synchronously.
- **Inbound mount points are the harder half.** In about 20 of these 46 rows the caller passes the node and the framework writes into it: `render_address_and_contact`, NamingSeries `render_table`, `frappe.ui.chart(el)`, FileUploader/builders/islands, `setup_search`, `bind_actions_with_object`, `opts.btn`, FilterGroup/EmbeddedList/SortSelector parents, alt-shortcut `add()`, `toggle_like`. When a Vue component calls one of these helpers, it must hand over a node that Vue does not patch.
- **Where the framework itself resets a mount point** (ControlHTML options re-render, `add_section` removed per refresh, the grid row form rebuilt per open), keep the existing reset timing and the hook order, so that app writes made in `refresh`/`form_render` land after it. Do not add new resets.
- The rule as stated covers both directions: the element is created once, and the side that did not create it owns its inside.

**B. Decorated handles (90): the conflict zone**
- Vue renders the contents (label, icon, classes) while apps call `.addClass/.hide/.toggle/.prop('disabled')/.text()/.on('click')` on the same element.
- **Make the returned node the Vue component's root element and stable for its lifetime**:
  - Never re-key or replace a button, `$input` or section wrapper on re-render.
  - Bind state classes Vue owns with `classList.toggle` on specific names, never whole-`class` replacement, so app-added classes survive. Frappe itself already breaks this in places: `removeClass()` in Column, `clear_indicator` and `change_inner_button_type`. Decide whether the port keeps that behaviour or fixes it.
  - Treat inline `style.display` (jQuery `.hide()`/`.toggle()`) as owned by the app. Vue must not bind `style`/`v-show` on these roots.
  - Accept that apps replace the label (`.text()`/`.html()`/`innerText` on `btn_primary`, `btn_secondary`, dialog buttons). Dialog `set_btn_label` already tolerates this (dialog.js:213). Vue must re-render a label into a node whose children it no longer owns, or render labels through a jQuery-safe path.
  - Keep jQuery event delivery: `frm.wrapper` is an event bus (custom events with extra args, plus native `CustomEvent` from ERPNext project.js), and `$input` `change`/`awesomplete-selectcomplete` is the value-change protocol. Vue listeners must not swallow these, and `.trigger('click')` on handed-out buttons must still run the framework action.
- **Where the framework already clears handles per refresh** (custom buttons, sidebar actions, menu items), the port may recreate them per refresh. The returned node only has to be live at call time and stay identical until the next clear.
- Keep type quirks apps depend on:
  - Section `wrapper` is jQuery while a control's `wrapper` is an element, and both sit in `frm.fields_dict`.
  - `Dialog.wrapper` is an element without fields and jQuery with fields.
  - `page.wrapper` must stay jQuery with `.is(':visible')` (keyboard.js:57).
  - `$(el).data('grid_row')` and the `fieldobj` expando must stay on their nodes.

**C. Read-only and non-node contracts (101)**
- Keep class names, `data-*` attributes and element identity readable. Keep HTML-string helpers (`frappe.utils.icon`, `render_template`, formatters, `comment_when`, `frappe.ui.badge().html()`) returning strings.
- Object handles (`make_control`, `fields_dict`, `cur_dialog`, `query_report.page`, listview hooks) must keep their method API and the node members their consumers reach (counted in A and B).
- Keep firing document events (`app_ready`, `page-change`, `form-*`, `rename`) and page `show`/`hide` on the page element.

**D. Unused outside (142)**
- Free to re-implement in Vue as far as Frappe and ERPNext go. This covers most of form-footer-sidebar, the desk shell, the sidebar and dock, QueryReport/ReportView internals, the widget nodes and kanban.
- Keep the names exported (`frappe.ui.BaseTimeline`, `toolbar_setup`, `sidebar_setup`, `add_card`, `get_form_sidebar_extension`, `kanban_v2 renderCard`) or deprecate them openly, because third-party apps are the only possible users.

**E. Selector vocabulary (26)**
- Vue templates must emit the same classes, attributes and **nesting**:
  - ERPNext `shipment.js:71` depends on `div[data-fieldname] > div > .clearfix`.
  - `work_order.js:139` depends on `> .control-label` directly under the grid wrapper.
  - POS depends on `.link-btn`/`.btn-open`/`.btn-clear`.
  - `.layout-main-section` is a mount point for POS, shop floor and the builders.
  - Also `.grid-row[data-name]`, `.grid-row-open`, `.form-footer`, `.timeline-item[data-doctype]` with `.actions`, and `input[data-fieldname=print_format]`.
- ERPNext SCSS (`.frappe-control[data-fieldname=…] .ql-editor`) also ties the port to Quill's DOM.
- The body-level `a` click intercept (router.js:26) will also catch `<a>` elements rendered by Vue.

## Disagreements and uncertainty

**Critic corrections applied**

| Surface | Original count | Corrected | Reason |
|---|---|---|---|
| `frm.fields_dict` | 109/277 | 204/351 | the original figure did not include `get_field(` |
| `frappe.pages[label]` | 38/28 | 47/15 | ERPNext was double-counted with the `on_page_load` row |
| `page.add_inner_button()` return | 3/0 | 3/1 | accounts_payable.js:200 keeps the return and toggles it at :225 |
| `dashboard.set_headline*` | 34/14 | 27/10 | a recount found about 25% fewer lines |
| `Dialog.wrapper` | typed element | type is both | element for field-less dialogs, jQuery once layout.js:25 replaces it |
| EmbeddedList | erp 4 | erp 15 | 6 constructions, 1 subclass, 7 `$wrapper` reach-ins |
| SortSelector | erp 0 | erp 3 | ERPNext constructs it 3 times on Frappe nodes |
| FilterGroup | erp 0 | erp 1 | financial_report_template.js:98 |
| Dropdown | erp 0 | erp 1 | project.js:277 |
| Slide | 0/0 | 0/19 | setup_wizard.js uses `get_input`, `get_field` and `slide.form.fields_dict` |
| FormTimeline `wrapper` | erp 5 | erp 6 | plus 4 commented-out lines, not counted |
| `msgprint` return | erp 3 | erp 1 | the only use is item.js:1489 |

**Kept as reported by the area agents.** The critic's spot-checks were within 20% for:
- `frm.add_custom_button`
- `frappe.utils.icon`
- Dialog `$body` and `$wrapper`
- `page.main`
- `$result`
- listview `onload`
- `$input` (raw count 106, against 84 qualified)
- `freeze`

**Lower bounds**
- Dialog members: only receivers named `d`, `dialog`, `dlg` and similar were matched.
- Control `.wrapper` and `.input`: only `fields_dict`, `get_field`, `*_field` and `*_control` receivers were counted.
- Anything consumed by DB-stored scripts: Web Form client scripts, Custom HTML Blocks, widget islands.

**Approximate (from hand-filtered patterns)**
- Control selector vocabulary
- `frappe.ui.chart` targets
- `opts.btn`
- Report formatters
- `grid_rows`
- `SettingsDialogPanel` body
- The component-factory groups
- ERPNext SCSS

**Overlaps that inflate the totals**
- `frm.add_custom_button` and `page.add_inner_button` return the same node.
- `frm.fields_dict` and dialog `fields_dict` both route node writes through control `$wrapper`/`$input`.
- Tree-node callbacks appear under ui-page-dialog #45 and views #27 (the same 6 ERPNext lines).
- The `frappe.ui.chart` targets appear under ui-page-dialog #61 and ui-rest #27.
- `awesomplete.ul` appears under controls #15 and ui-page-dialog #61.
- The `.form-message` and `.modal` selectors also appear in critic #18.

**Bucket judgement calls**
- Inbound helpers were put in A (the same contract with the roles swapped).
- `frm.fields_dict`, dialog `fields_dict` and `page.fields_dict` were put in C (map handles), because their node writes belong to the control rows.
- `datatable` was put in C despite one `.click()`.
- Events with consumers were put in C, except `grid-row-render`, whose consumers write into the row (B).

**Latent bugs and stale references the agents reported** (none of them changes the counts)
- `Toolbar.show_app_logo` calls `.html(undefined)`.
- `Widget.resize_button` is used but never assigned.
- `Footer.refresh_comments_count` targets a `.comment-count` that does not exist.
- The sidebar passes `.add-assignment`/`.add-tags-btn` selectors that match nothing.
- `calendar.js:161` binds `show` on a descendant, so it never fires.
- `kanban_board.bundle.js:681` uses a `[data-list-renderer='Kanban']` selector that matches nothing.
- `workspace.js:1603` clicks `#navbar-modal-search`, which nothing renders.
- ERPNext `sales_invoice.js:76` reads `frm.msgbox`, which nothing sets.
- `frappe.form_builder.wrapper` is assigned but never read.
