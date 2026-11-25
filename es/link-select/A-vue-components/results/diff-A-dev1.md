# legacy vs A-dev1

| class | differences |
|---|---:|
| behaviour | 5 |
| api | 20 |
| structure | 16 |
| events | 7 |
| requests | 1 |
| errors | 0 |

| flow | A ms | B ms |
|---|---:|---:|
| v5.form_todo | 40027 | 41528 |
| v5.form_user_titles | 7827 | 7850 |
| v5.dialog | 17940 | 18197 |
| v5.grid_workflow | 11442 | 11627 |
| v5.quick_entry | 5916 | 6003 |
| v5.standalone | 5819 | 5810 |
| v5.translation | 5197 | 5200 |
| v5.web_form | 4730 | 5917 |
| erp.sales_invoice | 18127 | 19961 |
| erp.stock_entry | 17206 | 17529 |

## Differences (structure and requests counted only; --all lists them)

- [api] v5.form_todo / api / `allocated_to.api.chain`: ["ControlLink","ControlReadOnly","ControlInput","Control"] -> ["ControlLink","ControlReadOnly","ControlInput","Control","er"]
- [api] v5.form_todo / api / `status.api.chain`: ["ControlSelect","ControlReadOnly","ControlInput","Control"] -> ["ControlSelect","ControlReadOnly","ControlInput","Control","er"]
- [api] v5.form_todo / api / `reference_name.api.chain`: ["ControlDynamicLink","ControlLink","ControlReadOnly","ControlInput","Control"] -> ["ControlDynamicLink","ControlLink","ControlReadOnly","ControlInput","Control","er"]
- [events] v5.form_todo / link-focus-opens-list: ["status:blur","allocated_to:select-change","allocated_to:focus","allocated_to:awesomplete-open"] -> ["allocated_to:select-change","allocated_to:focus","allocated_to:awesomplete-open"]
- [behaviour] v5.form_todo / enter-on-action-row-with-unmatched-text / `row`: "Advanced Search" -> undefined
- [behaviour] v5.form_todo / enter-on-action-row-with-unmatched-text / `dialogs`: [] -> undefined
- [behaviour] v5.form_todo / enter-on-action-row-with-unmatched-text / `list_open`: true -> undefined
- [behaviour] v5.form_todo / enter-on-action-row-with-unmatched-text / `state`: {"get_value":"adm","model":"","input_value":"adm","input_visible":true,"input_disabled":false,"wrapper_visible":true,"disp_visible":false,"disp_text":null,"d... -> undefined
- [behaviour] v5.form_todo / enter-on-action-row-with-unmatched-text / `error`: undefined -> "no row matching Advanced Search"
- [events] v5.form_todo / enter-on-action-row-with-unmatched-text: ["allocated_to:select-change","frm:allocated_to","reference_name:select-change","reference_name:change","reference_name:blur","allocated_to:select-change","a... -> ["allocated_to:select-change","frm:allocated_to","reference_name:select-change","reference_name:change","reference_name:blur","allocated_to:select-change","a...
- [events] v5.form_todo / advanced-search: ["allocated_to:select-change","frm:allocated_to","allocated_to:select-change","allocated_to:awesomplete-open","allocated_to:focus","allocated_to:awesomplete-... -> ["allocated_to:select-change","allocated_to:awesomplete-close","allocated_to:blur","allocated_to:select-change","allocated_to:awesomplete-open","allocated_to...
- [api] v5.form_user_titles / api / `language.api.chain`: ["ControlLink","ControlReadOnly","ControlInput","Control"] -> ["ControlLink","ControlReadOnly","ControlInput","Control","er"]
- [api] v5.form_user_titles / api / `desk_theme.api.chain`: ["ControlSelect","ControlReadOnly","ControlInput","Control"] -> ["ControlSelect","ControlReadOnly","ControlInput","Control","er"]
- [events] v5.form_user_titles / title-link-search: ["language:blur","language:awesomplete-close","language:select-change","language:awesomplete-open","language:focus","language:awesomplete-open"] -> ["language:awesomplete-close","language:blur","language:select-change","language:awesomplete-open","language:focus","language:awesomplete-open"]
- [api] v5.dialog / api / `user.api.chain`: ["ControlLink","ControlReadOnly","ControlInput","Control"] -> ["ControlLink","ControlReadOnly","ControlInput","Control","er"]
- [api] v5.dialog / api / `dn.api.chain`: ["ControlDynamicLink","ControlLink","ControlReadOnly","ControlInput","Control"] -> ["ControlDynamicLink","ControlLink","ControlReadOnly","ControlInput","Control","er"]
- [api] v5.dialog / api / `kind.api.chain`: ["ControlSelect","ControlReadOnly","ControlInput","Control"] -> ["ControlSelect","ControlReadOnly","ControlInput","Control","er"]
- [events] v5.dialog / link-get_query-in-df: ["user:blur","user:awesomplete-close","user:select-change","user:awesomplete-open","user:focus","user:awesomplete-open"] -> ["user:awesomplete-close","user:blur","user:select-change","user:awesomplete-open","user:focus","user:awesomplete-open"]
- [api] v5.grid_workflow / add-row-and-open-cell / `api.chain`: ["ControlLink","ControlReadOnly","ControlInput","Control"] -> ["ControlLink","ControlReadOnly","ControlInput","Control","er"]
- [events] v5.grid_workflow / grid-link-search: ["state:blur","state:awesomplete-close","state:select-change","state:awesomplete-open","state:focus","state:awesomplete-open"] -> ["state:awesomplete-close","state:blur","state:select-change","state:awesomplete-open","state:focus","state:awesomplete-open"]
- [api] v5.quick_entry / api / `country.api.chain`: ["ControlLink","ControlReadOnly","ControlInput","Control"] -> ["ControlLink","ControlReadOnly","ControlInput","Control","er"]
- [api] v5.quick_entry / api / `address_type.api.chain`: ["ControlSelect","ControlReadOnly","ControlInput","Control"] -> ["ControlSelect","ControlReadOnly","ControlInput","Control","er"]
- [api] v5.standalone / make_control-only_input / `api.chain`: ["ControlLink","ControlReadOnly","ControlInput","Control"] -> ["ControlLink","ControlReadOnly","ControlInput","Control","er"]
- [api] v5.standalone / make_control-select / `api.chain`: ["ControlSelect","ControlReadOnly","ControlInput","Control"] -> ["ControlSelect","ControlReadOnly","ControlInput","Control","er"]
- [api] v5.web_form / api / `language.api.chain`: ["ControlAutocomplete","ControlReadOnly","ControlInput","Control"] -> ["ControlAutocomplete","ControlReadOnly","ControlInput","Control","la"]
- [api] v5.web_form / api / `time_zone.api.chain`: ["ControlSelect","ControlReadOnly","ControlInput","Control"] -> ["ControlSelect","ControlReadOnly","ControlInput","Control","la"]
- [api] erp.sales_invoice / api / `customer.api.chain`: ["ControlLink","ControlReadOnly","ControlInput","Control"] -> ["ControlLink","ControlReadOnly","ControlInput","Control","er"]
- [api] erp.sales_invoice / api / `naming_series.api.chain`: ["ControlSelect","ControlReadOnly","ControlInput","Control"] -> ["ControlSelect","ControlReadOnly","ControlInput","Control","er"]
- [api] erp.sales_invoice / items-grid-open / `api.chain`: ["ControlLink","ControlReadOnly","ControlInput","Control"] -> ["ControlLink","ControlReadOnly","ControlInput","Control","er"]
- [api] erp.stock_entry / api / `stock_entry_type.api.chain`: ["ControlLink","ControlReadOnly","ControlInput","Control"] -> ["ControlLink","ControlReadOnly","ControlInput","Control","er"]
- [api] erp.stock_entry / api / `purpose.api.chain`: ["ControlSelect","ControlReadOnly","ControlInput","Control"] -> ["ControlSelect","ControlReadOnly","ControlInput","Control","er"]
- [events] erp.stock_entry / warehouse-get_query: ["stock_entry_type:select-change","stock_entry_type:change","stock_entry_type:blur","from_warehouse:select-change","from_warehouse:focus","from_warehouse:awe... -> ["stock_entry_type:select-change","stock_entry_type:change","stock_entry_type:blur","from_warehouse:select-change","from_warehouse:focus","from_warehouse:awe...
