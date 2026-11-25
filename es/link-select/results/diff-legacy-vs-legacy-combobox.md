# legacy vs legacy-combobox

| class | differences |
|---|---:|
| behaviour | 85 |
| api | 32 |
| structure | 26 |
| events | 39 |
| requests | 17 |
| errors | 0 |

| flow | A ms | B ms |
|---|---:|---:|
| v5.form_todo | 40027 | 47110 |
| v5.form_user_titles | 7827 | 7703 |
| v5.dialog | 17940 | 35081 |
| v5.grid_workflow | 11442 | 11344 |
| v5.quick_entry | 5916 | 5992 |
| v5.standalone | 5819 | 5923 |
| v5.translation | 5197 | 5240 |
| v5.web_form | 4730 | 4725 |

## Differences (structure and requests counted only; --all lists them)

- [api] v5.form_todo / api / `allocated_to.api.chain`: ["ControlLink","ControlReadOnly","ControlInput","Control"] -> ["ControlLinkCombobox","ControlLink","ControlReadOnly","ControlInput","Control"]
- [api] v5.form_todo / api / `allocated_to.api.awesomplete_list_prop`: true -> false
- [api] v5.form_todo / api / `allocated_to.api.awesomplete_isOpened_prop`: true -> false
- [api] v5.form_todo / api / `allocated_to.api.$link`: true -> false
- [api] v5.form_todo / api / `reference_name.api.chain`: ["ControlDynamicLink","ControlLink","ControlReadOnly","ControlInput","Control"] -> ["ControlDynamicLinkCombobox","ControlLinkCombobox","ControlLink","ControlReadOnly","ControlInput","Control"]
- [api] v5.form_todo / api / `reference_name.api.awesomplete_list_prop`: true -> false
- [api] v5.form_todo / api / `reference_name.api.awesomplete_isOpened_prop`: true -> false
- [api] v5.form_todo / api / `reference_name.api.$link`: true -> false
- [behaviour] v5.form_todo / link-focus-opens-list / `count`: 10 -> 9
- [behaviour] v5.form_todo / link-focus-opens-list / `rows`: ["Administrator","frappe@example.com Frappe","Guest","test_list_col_width@example.com Frappe","test_print_view@example.com Frappe","test_report_child_group_b... -> ["A Administrator","F frappe@example.com Frappe","G Guest","T test_list_col_width@example.com Frappe","T test_print_view@example.com Frappe","T test_report_c...
- [behaviour] v5.form_todo / link-focus-opens-list / `advanced_search`: true -> false
- [behaviour] v5.form_todo / link-focus-opens-list / `active`: "Administrator" -> "A Administrator"
- [events] v5.form_todo / link-focus-opens-list: ["status:blur","allocated_to:select-change","allocated_to:focus","allocated_to:awesomplete-open"] -> ["status:blur","allocated_to:focus","allocated_to:blur"]
- [behaviour] v5.form_todo / link-type-filters-list / `count`: 3 -> 2
- [behaviour] v5.form_todo / link-type-filters-list / `rows`: ["frappe@example.com Frappe","Create a new User","Advanced Search"] -> ["F frappe@example.com Frappe","Create a new User"]
- [behaviour] v5.form_todo / link-type-filters-list / `advanced_search`: true -> false
- [behaviour] v5.form_todo / link-type-filters-list / `active`: "frappe@example.com Frappe" -> "F frappe@example.com Frappe"
- [events] v5.form_todo / link-type-filters-list: ["allocated_to:awesomplete-open"] -> []
- [events] v5.form_todo / link-enter-picks-first: ["allocated_to:awesomplete-select","allocated_to:awesomplete-close","allocated_to:awesomplete-selectcomplete","allocated_to:select-change","frm:allocated_to"] -> ["allocated_to:focus","allocated_to:change","allocated_to:awesomplete-selectcomplete","frm:allocated_to"]
- [events] v5.form_todo / link-blur-keeps-value: ["allocated_to:select-change","allocated_to:change","allocated_to:blur"] -> ["allocated_to:blur"]
- [behaviour] v5.form_todo / set_query-filters / `count`: 6 -> 4
- [behaviour] v5.form_todo / set_query-filters / `rows`: ["test_report_child_group_by@example.com Frappe","test_report_group_by@example.com Frappe","test_report_permission@example.com Frappe","Filtered by: Name con... -> ["T test_report_child_group_by@example.com Frappe","T test_report_group_by@example.com Frappe","T test_report_permission@example.com Frappe","Create a new Us...
- [behaviour] v5.form_todo / set_query-filters / `advanced_search`: true -> false
- [behaviour] v5.form_todo / set_query-filters / `filtered_by`: "Filtered by: Name contains \"%test_report%\"." -> null
- [behaviour] v5.form_todo / set_query-filters / `active`: "test_report_child_group_by@example.com Frappe" -> "T test_report_child_group_by@example.com Frappe"
- [events] v5.form_todo / set_query-filters: ["allocated_to:select-change","frm:allocated_to","allocated_to:select-change","allocated_to:awesomplete-open","allocated_to:focus","allocated_to:awesomplete-... -> ["frm:allocated_to","allocated_to:focus","allocated_to:blur","allocated_to:focus"]
- [behaviour] v5.form_todo / get_query-assign / `count`: 4 -> 2
- [behaviour] v5.form_todo / get_query-assign / `rows`: ["Administrator","Filtered by: Name equals \"Administrator\".","Create a new User","Advanced Search"] -> ["A Administrator","Create a new User"]
- [behaviour] v5.form_todo / get_query-assign / `advanced_search`: true -> false
- [behaviour] v5.form_todo / get_query-assign / `filtered_by`: "Filtered by: Name equals \"Administrator\"." -> null
- [behaviour] v5.form_todo / get_query-assign / `active`: "Administrator" -> "A Administrator"
- [events] v5.form_todo / get_query-assign: ["allocated_to:select-change","frm:allocated_to","allocated_to:select-change","allocated_to:awesomplete-open","allocated_to:focus","allocated_to:awesomplete-... -> ["allocated_to:blur","allocated_to:focus","allocated_to:blur","allocated_to:focus"]
- [events] v5.form_todo / fetch_from: ["assigned_by:select-change","assigned_by:focus","assigned_by:awesomplete-open","assigned_by:awesomplete-select","assigned_by:awesomplete-close","assigned_by... -> ["allocated_to:blur","assigned_by:focus","assigned_by:blur","assigned_by:focus","assigned_by:change","assigned_by:awesomplete-selectcomplete","frm:assigned_by"]
- [events] v5.form_todo / set_value-from-code: ["allocated_to:select-change","frm:allocated_to"] -> ["frm:allocated_to"]
- [events] v5.form_todo / control-set_value-get_value: ["allocated_to:select-change","frm:allocated_to"] -> ["frm:allocated_to"]
- [behaviour] v5.form_todo / invalid-value-on-blur / `state.model`: null -> ""
- [events] v5.form_todo / invalid-value-on-blur: ["allocated_to:select-change","frm:allocated_to","assigned_by:select-change","assigned_by:change","assigned_by:blur","allocated_to:select-change","allocated_... -> ["frm:allocated_to","assigned_by:blur","allocated_to:focus","allocated_to:blur","allocated_to:focus","allocated_to:blur"]
- [behaviour] v5.form_todo / clear-by-typing / `get_value`: "" -> "Administrator"
- [behaviour] v5.form_todo / clear-by-typing / `model`: "" -> "Administrator"
- [behaviour] v5.form_todo / clear-by-typing / `input_value`: "" -> "Administrator"
- [behaviour] v5.form_todo / clear-by-typing / `disp_href`: null -> "/desk/user/Administrator"
- [events] v5.form_todo / clear-by-typing: ["allocated_to:select-change","frm:allocated_to","allocated_to:focus","allocated_to:awesomplete-open","allocated_to:awesomplete-close","allocated_to:change",... -> ["frm:allocated_to","allocated_to:focus","allocated_to:blur","allocated_to:focus","allocated_to:blur"]
- [events] v5.form_todo / read-only-display: ["allocated_to:select-change","frm:allocated_to","allocated_to:select-change"] -> []
- [behaviour] v5.form_todo / keyboard-arrows-escape / `first`: "Administrator" -> "A Administrator"
- [behaviour] v5.form_todo / keyboard-arrows-escape / `second`: "frappe@example.com Frappe" -> "F frappe@example.com Frappe"
- [behaviour] v5.form_todo / keyboard-arrows-escape / `back`: "Administrator" -> "A Administrator"
- [events] v5.form_todo / keyboard-arrows-escape: ["allocated_to:select-change","frm:allocated_to","allocated_to:select-change","allocated_to:awesomplete-open","allocated_to:focus","allocated_to:awesomplete-... -> ["frm:allocated_to","allocated_to:focus","allocated_to:blur","allocated_to:focus"]
- [events] v5.form_todo / keyboard-arrow-enter-picks-second: ["allocated_to:select-change","allocated_to:awesomplete-open","allocated_to:focus","allocated_to:awesomplete-open","allocated_to:awesomplete-select","allocat... -> ["allocated_to:blur","allocated_to:focus","allocated_to:change","allocated_to:awesomplete-selectcomplete","frm:allocated_to"]
- [behaviour] v5.form_todo / dynamic-link / `options.count`: 3 -> 2
- [behaviour] v5.form_todo / dynamic-link / `options.rows`: ["Administrator","Create a new User","Advanced Search"] -> ["A Administrator","Create a new User"]
- [behaviour] v5.form_todo / dynamic-link / `options.advanced_search`: true -> false
- [behaviour] v5.form_todo / dynamic-link / `options.active`: "Administrator" -> "A Administrator"
- [events] v5.form_todo / dynamic-link: ["reference_type:select-change","allocated_to:blur","reference_name:select-change","reference_name:focus","reference_name:awesomplete-open","reference_name:a... -> ["allocated_to:blur","reference_name:focus","reference_name:blur","reference_name:focus","reference_name:change","reference_name:awesomplete-selectcomplete",...
- [behaviour] v5.form_todo / enter-on-action-row-with-unmatched-text / `row`: "Advanced Search" -> undefined
- [behaviour] v5.form_todo / enter-on-action-row-with-unmatched-text / `dialogs`: [] -> undefined
- [behaviour] v5.form_todo / enter-on-action-row-with-unmatched-text / `list_open`: true -> undefined
- [behaviour] v5.form_todo / enter-on-action-row-with-unmatched-text / `state`: {"get_value":"adm","model":"","input_value":"adm","input_visible":true,"input_disabled":false,"wrapper_visible":true,"disp_visible":false,"disp_text":null,"d... -> undefined
- [behaviour] v5.form_todo / enter-on-action-row-with-unmatched-text / `error`: undefined -> "no row matching Advanced Search"
- [events] v5.form_todo / enter-on-action-row-with-unmatched-text: ["allocated_to:select-change","frm:allocated_to","reference_name:select-change","reference_name:change","reference_name:blur","allocated_to:select-change","a... -> ["frm:allocated_to","reference_name:blur","allocated_to:focus","allocated_to:blur"]
- [behaviour] v5.form_todo / advanced-search / `dialogs`: ["Select User"] -> undefined
- [behaviour] v5.form_todo / advanced-search / `error`: undefined -> "locator.click: Timeout 8000ms exceeded."
- [events] v5.form_todo / advanced-search: ["allocated_to:select-change","frm:allocated_to","allocated_to:select-change","allocated_to:awesomplete-open","allocated_to:focus","allocated_to:awesomplete-... -> ["allocated_to:focus","allocated_to:blur"]
- [events] v5.form_todo / create-new: ["allocated_to:select-change","allocated_to:awesomplete-open","allocated_to:focus","allocated_to:awesomplete-open","allocated_to:select-change","allocated_to... -> ["allocated_to:focus","allocated_to:blur","allocated_to:focus","allocated_to:blur"]
- [api] v5.form_user_titles / api / `language.api.chain`: ["ControlLink","ControlReadOnly","ControlInput","Control"] -> ["ControlLinkCombobox","ControlLink","ControlReadOnly","ControlInput","Control"]
- [api] v5.form_user_titles / api / `language.api.awesomplete_list_prop`: true -> false
- [api] v5.form_user_titles / api / `language.api.awesomplete_isOpened_prop`: true -> false
- [api] v5.form_user_titles / api / `language.api.$link`: true -> false
- [events] v5.form_user_titles / api: ["language:awesomplete-open"] -> []
- [behaviour] v5.form_user_titles / title-link-search / `count`: 2 -> 1
- [behaviour] v5.form_user_titles / title-link-search / `rows`: ["Deutsch de","Advanced Search"] -> ["Deutsch de"]
- [behaviour] v5.form_user_titles / title-link-search / `advanced_search`: true -> false
- [events] v5.form_user_titles / title-link-search: ["language:blur","language:awesomplete-close","language:select-change","language:awesomplete-open","language:focus","language:awesomplete-open"] -> ["language:focus","language:blur"]
- [events] v5.form_user_titles / title-link-pick: ["language:awesomplete-select","language:awesomplete-close","language:awesomplete-selectcomplete","language:select-change"] -> ["language:focus","language:change","language:awesomplete-selectcomplete"]
- [events] v5.form_user_titles / title-link-set_value: ["language:select-change"] -> []
- [events] v5.form_user_titles / translated-doctype-link: ["gender:select-change"] -> []
- [api] v5.dialog / api / `user.api.chain`: ["ControlLink","ControlReadOnly","ControlInput","Control"] -> ["ControlLinkCombobox","ControlLink","ControlReadOnly","ControlInput","Control"]
- [api] v5.dialog / api / `user.api.awesomplete_list_prop`: true -> false
- [api] v5.dialog / api / `user.api.awesomplete_isOpened_prop`: true -> false
- [api] v5.dialog / api / `user.api.$link`: true -> false
- [api] v5.dialog / api / `dn.api.chain`: ["ControlDynamicLink","ControlLink","ControlReadOnly","ControlInput","Control"] -> ["ControlDynamicLinkCombobox","ControlLinkCombobox","ControlLink","ControlReadOnly","ControlInput","Control"]
- [api] v5.dialog / api / `dn.api.awesomplete_list_prop`: true -> false
- [api] v5.dialog / api / `dn.api.awesomplete_isOpened_prop`: true -> false
- [api] v5.dialog / api / `dn.api.$link`: true -> false
- [behaviour] v5.dialog / link-get_query-in-df / `count`: 9 -> 0
- [behaviour] v5.dialog / link-get_query-in-df / `rows`: ["frappe@example.com Frappe","test_list_col_width@example.com Frappe","test_print_view@example.com Frappe","test_report_child_group_by@example.com Frappe","t... -> []
- [behaviour] v5.dialog / link-get_query-in-df / `create_new`: true -> false
- [behaviour] v5.dialog / link-get_query-in-df / `advanced_search`: true -> false
- [behaviour] v5.dialog / link-get_query-in-df / `filtered_by`: "Filtered by: Name contains \"%example.com\"." -> null
- [behaviour] v5.dialog / link-get_query-in-df / `active`: "frappe@example.com Frappe" -> null
- [events] v5.dialog / link-get_query-in-df: ["user:blur","user:awesomplete-close","user:select-change","user:awesomplete-open","user:focus","user:awesomplete-open"] -> ["user:focus"]
- [behaviour] v5.dialog / link-pick / `state.get_value`: "frappe@example.com" -> ""
- [behaviour] v5.dialog / link-pick / `state.input_value`: "frappe@example.com" -> ""
- [behaviour] v5.dialog / link-pick / `state.disp_href`: "/desk/user/frappe%40example.com" -> null
- [behaviour] v5.dialog / link-pick / `listbox_open`: false -> true
- [behaviour] v5.dialog / link-pick / `value`: "frappe@example.com" -> ""
- [events] v5.dialog / link-pick: ["user:awesomplete-select","user:awesomplete-close","user:awesomplete-selectcomplete","user:select-change","df:user.onchange"] -> ["user:blur"]
- [behaviour] v5.dialog / only_select-and-df.filters / `count`: 2 -> 8
- [behaviour] v5.dialog / only_select-and-df.filters / `rows`: ["System Manager","Filtered by: is enabled."] -> ["F frappe@example.com Frappe","T test_list_col_width@example.com Frappe","T test_print_view@example.com Frappe","T test_report_child_group_by@example.com Fr...
- [behaviour] v5.dialog / only_select-and-df.filters / `create_new`: false -> true
- [behaviour] v5.dialog / only_select-and-df.filters / `filtered_by`: "Filtered by: is enabled." -> null
- [behaviour] v5.dialog / only_select-and-df.filters / `active`: "System Manager" -> "F frappe@example.com Frappe"
- [events] v5.dialog / only_select-and-df.filters: ["user:blur","role:select-change","role:focus","role:awesomplete-open","role:awesomplete-close"] -> ["role:blur","role:focus","role:blur","role:focus"]
- [note] v5.dialog / only_select-and-df.filters: input covered, focused instead of clicked: ["click->focus __twd.fields_dict.role"]
- [behaviour] v5.dialog / escape-closes-list-not-dialog / `list_open`: false -> true
- [events] v5.dialog / escape-closes-list-not-dialog: ["role:awesomplete-open","role:awesomplete-close"] -> ["role:blur","role:focus","role:blur","role:focus"]
- [note] v5.dialog / escape-closes-list-not-dialog: input covered, focused instead of clicked: ["click->focus __twd.fields_dict.role"]
- [behaviour] v5.dialog / dynamic-link-in-dialog / `options.count`: 3 -> 9
- [behaviour] v5.dialog / dynamic-link-in-dialog / `options.rows`: ["Guest","Create a new Role","Advanced Search"] -> ["F frappe@example.com Frappe","T test_list_col_width@example.com Frappe","T test_print_view@example.com Frappe","T test_report_child_group_by@example.com Fr...
- [behaviour] v5.dialog / dynamic-link-in-dialog / `options.advanced_search`: true -> false
- [behaviour] v5.dialog / dynamic-link-in-dialog / `options.active`: "Guest" -> "F frappe@example.com Frappe"
- [behaviour] v5.dialog / dynamic-link-in-dialog / `picked.listbox_open`: false -> true
- [events] v5.dialog / dynamic-link-in-dialog: ["role:blur","dn:select-change","dn:focus","dn:awesomplete-open","dn:awesomplete-select","dn:awesomplete-close","dn:awesomplete-selectcomplete","dn:select-ch... -> ["role:blur","dn:blur","dn:focus","dn:blur","dn:focus","dn:change","dn:awesomplete-selectcomplete"]
- [note] v5.dialog / dynamic-link-in-dialog: input covered, focused instead of clicked: ["click->focus __twd.fields_dict.dn"]
- [behaviour] v5.dialog / create-new-quick-entry / `dialogs`: ["TW Dialog","New Note"] -> ["TW Dialog","New User"]
- [behaviour] v5.dialog / create-new-quick-entry / `quick_entry_values.title`: "TW quick note" -> undefined
- [events] v5.dialog / create-new-quick-entry: ["dn:change","dn:blur","dn:select-change"] -> ["dn:blur","user:focus","user:blur"]
- [note] v5.dialog / create-new-quick-entry: input covered, focused instead of clicked: ["click->focus __twd.fields_dict.note"]
- [behaviour] v5.dialog / dialog-values / `user`: "frappe@example.com" -> undefined
- [api] v5.grid_workflow / add-row-and-open-cell / `api.chain`: ["ControlLink","ControlReadOnly","ControlInput","Control"] -> ["ControlLinkCombobox","ControlLink","ControlReadOnly","ControlInput","Control"]
- [api] v5.grid_workflow / add-row-and-open-cell / `api.awesomplete_list_prop`: true -> false
- [api] v5.grid_workflow / add-row-and-open-cell / `api.awesomplete_isOpened_prop`: true -> false
- [api] v5.grid_workflow / add-row-and-open-cell / `api.$link`: true -> false
- [behaviour] v5.grid_workflow / add-row-and-open-cell / `focused`: true -> false
- [behaviour] v5.grid_workflow / grid-link-search / `count`: 3 -> 2
- [behaviour] v5.grid_workflow / grid-link-search / `rows`: ["Approved","Create a new Workflow State","Advanced Search"] -> ["Approved","Create a new Workflow State"]
- [behaviour] v5.grid_workflow / grid-link-search / `advanced_search`: true -> false
- [events] v5.grid_workflow / grid-link-search: ["state:blur","state:awesomplete-close","state:select-change","state:awesomplete-open","state:focus","state:awesomplete-open"] -> ["state:focus","state:blur"]
- [events] v5.grid_workflow / grid-link-pick: ["state:awesomplete-select","state:awesomplete-close","state:awesomplete-selectcomplete","state:select-change"] -> ["state:focus","state:change","state:awesomplete-selectcomplete"]
- [behaviour] v5.grid_workflow / grid-get_field-get_query / `options.count`: 12 -> 21
- [behaviour] v5.grid_workflow / grid-get_field-get_query / `options.rows`: ["Blogger","Report Child Group By Test Role","Report Group By Test Role","Report Permission Test Role","Flow User","Studio User","Maintenance Manager","Maint... -> ["Blogger","Report Child Group By Test Role","Report Group By Test Role","Report Permission Test Role","Flow User","Studio User","Maintenance Manager","Maint...
- [behaviour] v5.grid_workflow / grid-get_field-get_query / `options.advanced_search`: true -> false
- [events] v5.grid_workflow / grid-get_field-get_query: ["state:select-change","state:change","state:blur","allow_edit:select-change","allow_edit:focus","allow_edit:awesomplete-open","allow_edit:awesomplete-select... -> ["state:blur","allow_edit:focus","allow_edit:blur","allow_edit:focus","allow_edit:change","allow_edit:awesomplete-selectcomplete"]
- [behaviour] v5.grid_workflow / grid-arrow-keys-while-list-open / `before`: "Rejected" -> "Approved"
- [events] v5.grid_workflow / grid-arrow-keys-while-list-open: ["state:select-change","doc_status:select-change","allow_edit:select-change","allow_edit:blur","state:focus","state:awesomplete-open","state:awesomplete-close"] -> ["doc_status:select-change","allow_edit:blur","state:focus","state:blur","state:focus"]
- [events] v5.grid_workflow / grid-update_docfield_property-read_only: ["state:select-change","doc_status:select-change","allow_edit:select-change","state:select-change","doc_status:select-change","allow_edit:select-change"] -> ["doc_status:select-change"]
- [events] v5.grid_workflow / grid-set_value-from-code: ["state:select-change"] -> []
- [api] v5.quick_entry / api / `country.api.chain`: ["ControlLink","ControlReadOnly","ControlInput","Control"] -> ["ControlLinkCombobox","ControlLink","ControlReadOnly","ControlInput","Control"]
- [api] v5.quick_entry / api / `country.api.awesomplete_list_prop`: true -> false
- [api] v5.quick_entry / api / `country.api.awesomplete_isOpened_prop`: true -> false
- [api] v5.quick_entry / api / `country.api.$link`: true -> false
- [behaviour] v5.quick_entry / link-search / `count`: 3 -> 2
- [behaviour] v5.quick_entry / link-search / `rows`: ["Germany","Create a new Country","Advanced Search"] -> ["Germany","Create a new Country"]
- [behaviour] v5.quick_entry / link-search / `advanced_search`: true -> false
- [events] v5.quick_entry / link-search: ["country:select-change","country:focus","country:awesomplete-open"] -> ["country:focus","country:blur"]
- [events] v5.quick_entry / link-pick: ["country:awesomplete-select","country:awesomplete-close","country:awesomplete-selectcomplete","country:select-change"] -> ["country:focus","country:change","country:awesomplete-selectcomplete"]
- [api] v5.standalone / make_control-only_input / `api.chain`: ["ControlLink","ControlReadOnly","ControlInput","Control"] -> ["ControlLinkCombobox","ControlLink","ControlReadOnly","ControlInput","Control"]
- [api] v5.standalone / make_control-only_input / `api.awesomplete_list_prop`: true -> false
- [api] v5.standalone / make_control-only_input / `api.awesomplete_isOpened_prop`: true -> false
- [api] v5.standalone / make_control-only_input / `api.$link`: true -> false
- [behaviour] v5.standalone / only_input-search-pick / `options.count`: 8 -> 7
- [behaviour] v5.standalone / only_input-search-pick / `options.rows`: ["frappe@example.com Frappe","test_list_col_width@example.com Frappe","test_print_view@example.com Frappe","test_report_child_group_by@example.com Frappe","t... -> ["F frappe@example.com Frappe","T test_list_col_width@example.com Frappe","T test_print_view@example.com Frappe","T test_report_child_group_by@example.com Fr...
- [behaviour] v5.standalone / only_input-search-pick / `options.advanced_search`: true -> false
- [behaviour] v5.standalone / only_input-search-pick / `options.active`: "frappe@example.com Frappe" -> "F frappe@example.com Frappe"
- [events] v5.standalone / only_input-search-pick: ["standalone:focus","standalone:awesomplete-open","standalone:awesomplete-select","standalone:awesomplete-close","standalone:awesomplete-selectcomplete","sta... -> ["standalone:focus","standalone:blur","standalone:focus","standalone:change","standalone:awesomplete-selectcomplete","df:onchange:frappe@example.com"]
- [behaviour] v5.standalone / make_control-only_select / `count`: 10 -> 20
- [behaviour] v5.standalone / make_control-only_select / `rows`: ["Blogger","Report Child Group By Test Role","Report Group By Test Role","Report Permission Test Role","Flow User","Studio User","Maintenance Manager","Maint... -> ["Blogger","Report Child Group By Test Role","Report Group By Test Role","Report Permission Test Role","Flow User","Studio User","Maintenance Manager","Maint...
- [events] v5.standalone / make_control-only_select: ["standalone:change","standalone:blur","standalone:select-change","df:onchange:frappe@example.com"] -> ["standalone:blur"]
- [behaviour] v5.translation / translated-link-options / `options.count`: 3 -> 2
- [behaviour] v5.translation / translated-link-options / `options.rows`: ["Systemverwalter-tw","Create a new Role","Advanced Search"] -> ["Systemverwalter-tw","Create a new Role"]
- [behaviour] v5.translation / translated-link-options / `options.advanced_search`: true -> false
- **erp.sales_invoice**: not run in B (not compared)
- **erp.stock_entry**: not run in B (not compared)
