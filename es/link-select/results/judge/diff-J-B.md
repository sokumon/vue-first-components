# legacy vs J-B

| class | differences |
|---|---:|
| behaviour | 0 |
| api | 0 |
| structure | 0 |
| events | 2 |
| requests | 1 |
| errors | 0 |

| flow | A ms | B ms |
|---|---:|---:|
| v5.form_todo | 40027 | 41143 |
| v5.form_user_titles | 7827 | 7849 |
| v5.dialog | 17940 | 18266 |
| v5.grid_workflow | 11442 | 11732 |
| v5.quick_entry | 5916 | 6190 |
| v5.standalone | 5819 | 5895 |
| v5.translation | 5197 | 5375 |
| v5.web_form | 4730 | 4766 |
| erp.sales_invoice | 18127 | 19949 |
| erp.stock_entry | 17206 | 17274 |

## Differences (structure and requests counted only; --all lists them)

- [events] v5.form_todo / advanced-search: ["allocated_to:select-change","frm:allocated_to","allocated_to:select-change","allocated_to:awesomplete-open","allocated_to:focus","allocated_to:awesomplete-... -> ["allocated_to:select-change","frm:allocated_to","allocated_to:select-change","frm:allocated_to","allocated_to:select-change","allocated_to:awesomplete-open"...
- [events] erp.stock_entry / warehouse-get_query: ["stock_entry_type:select-change","stock_entry_type:change","stock_entry_type:blur","from_warehouse:select-change","from_warehouse:focus","from_warehouse:awe... -> ["stock_entry_type:select-change","stock_entry_type:change","stock_entry_type:blur","from_warehouse:select-change","from_warehouse:focus","from_warehouse:awe...
