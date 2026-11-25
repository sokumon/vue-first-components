# legacy vs B1

| class | differences |
|---|---:|
| behaviour | 1 |
| api | 0 |
| structure | 0 |
| events | 15 |
| requests | 1 |
| errors | 0 |

| flow | A ms | B ms |
|---|---:|---:|
| v5.form_todo | 40027 | 40448 |
| v5.form_user_titles | 7827 | 7837 |
| v5.dialog | 17940 | 18129 |
| v5.grid_workflow | 11442 | 11740 |
| v5.quick_entry | 5916 | 6193 |
| v5.standalone | 5819 | 6014 |
| v5.translation | 5197 | 5286 |
| v5.web_form | 4730 | 4796 |
| erp.sales_invoice | 18127 | 19947 |
| erp.stock_entry | 17206 | 17231 |

## Differences (structure and requests counted only; --all lists them)

- [events] v5.form_todo / link-focus-opens-list: ["status:blur","allocated_to:select-change","allocated_to:focus","allocated_to:awesomplete-open"] -> ["allocated_to:select-change","allocated_to:focus","allocated_to:awesomplete-open"]
- [events] v5.form_todo / link-type-filters-list: ["allocated_to:awesomplete-open"] -> []
- [events] v5.form_todo / set_query-filters: ["allocated_to:select-change","frm:allocated_to","allocated_to:select-change","allocated_to:awesomplete-open","allocated_to:focus","allocated_to:awesomplete-... -> ["allocated_to:select-change","frm:allocated_to","allocated_to:select-change","allocated_to:awesomplete-open","allocated_to:focus","allocated_to:awesomplete-...
- [behaviour] v5.form_todo / get_query-assign / `active`: "Administrator" -> null
- [events] v5.form_todo / get_query-assign: ["allocated_to:select-change","frm:allocated_to","allocated_to:select-change","allocated_to:awesomplete-open","allocated_to:focus","allocated_to:awesomplete-... -> ["allocated_to:select-change","frm:allocated_to","allocated_to:select-change","allocated_to:awesomplete-open","allocated_to:focus","allocated_to:awesomplete-...
- [events] v5.form_todo / invalid-value-on-blur: ["allocated_to:select-change","frm:allocated_to","assigned_by:select-change","assigned_by:change","assigned_by:blur","allocated_to:select-change","allocated_... -> ["allocated_to:select-change","frm:allocated_to","assigned_by:select-change","assigned_by:change","assigned_by:blur","allocated_to:select-change","allocated_...
- [events] v5.form_todo / keyboard-arrows-escape: ["allocated_to:select-change","frm:allocated_to","allocated_to:select-change","allocated_to:awesomplete-open","allocated_to:focus","allocated_to:awesomplete-... -> ["allocated_to:select-change","frm:allocated_to","allocated_to:select-change","allocated_to:awesomplete-open","allocated_to:focus","allocated_to:awesomplete-...
- [events] v5.form_todo / keyboard-arrow-enter-picks-second: ["allocated_to:select-change","allocated_to:awesomplete-open","allocated_to:focus","allocated_to:awesomplete-open","allocated_to:awesomplete-select","allocat... -> ["allocated_to:select-change","allocated_to:awesomplete-open","allocated_to:focus","allocated_to:awesomplete-select","allocated_to:awesomplete-close","alloca...
- [events] v5.form_todo / enter-on-action-row-with-unmatched-text: ["allocated_to:select-change","frm:allocated_to","reference_name:select-change","reference_name:change","reference_name:blur","allocated_to:select-change","a... -> ["allocated_to:select-change","frm:allocated_to","reference_name:select-change","reference_name:change","reference_name:blur","allocated_to:select-change","a...
- [events] v5.form_todo / advanced-search: ["allocated_to:select-change","frm:allocated_to","allocated_to:select-change","allocated_to:awesomplete-open","allocated_to:focus","allocated_to:awesomplete-... -> ["allocated_to:select-change","frm:allocated_to","allocated_to:select-change","allocated_to:awesomplete-open","allocated_to:focus","allocated_to:awesomplete-...
- [events] v5.form_todo / create-new: ["allocated_to:select-change","allocated_to:awesomplete-open","allocated_to:focus","allocated_to:awesomplete-open","allocated_to:select-change","allocated_to... -> ["allocated_to:select-change","allocated_to:awesomplete-open","allocated_to:focus","allocated_to:select-change","allocated_to:awesomplete-select","allocated_...
- [events] v5.form_user_titles / title-link-search: ["language:blur","language:awesomplete-close","language:select-change","language:awesomplete-open","language:focus","language:awesomplete-open"] -> ["language:blur","language:awesomplete-close","language:select-change","language:awesomplete-open","language:focus"]
- [events] v5.dialog / link-get_query-in-df: ["user:blur","user:awesomplete-close","user:select-change","user:awesomplete-open","user:focus","user:awesomplete-open"] -> ["user:blur","user:awesomplete-close","user:select-change","user:awesomplete-open","user:focus"]
- [events] v5.grid_workflow / grid-link-search: ["state:blur","state:awesomplete-close","state:select-change","state:awesomplete-open","state:focus","state:awesomplete-open"] -> ["state:blur","state:awesomplete-close","state:select-change","state:awesomplete-open","state:focus"]
- [events] erp.sales_invoice / customer-type-pick: ["customer:awesomplete-open","customer:awesomplete-select","customer:awesomplete-close","customer:awesomplete-selectcomplete","customer:select-change","namin... -> ["customer:awesomplete-select","customer:awesomplete-close","customer:awesomplete-selectcomplete","customer:select-change","naming_series:select-change","cus...
- [events] erp.stock_entry / warehouse-get_query: ["stock_entry_type:select-change","stock_entry_type:change","stock_entry_type:blur","from_warehouse:select-change","from_warehouse:focus","from_warehouse:awe... -> ["stock_entry_type:select-change","stock_entry_type:change","stock_entry_type:blur","from_warehouse:select-change","from_warehouse:focus","from_warehouse:awe...
