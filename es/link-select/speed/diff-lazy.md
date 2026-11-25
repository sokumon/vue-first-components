# legacy vs B-lazy

| class | differences |
|---|---:|
| behaviour | 0 |
| api | 0 |
| structure | 0 |
| events | 1 |
| requests | 1 |
| errors | 0 |

| flow | A ms | B ms |
|---|---:|---:|
| v5.form_todo | 40027 | 40342 |
| v5.form_user_titles | 7827 | 7691 |
| v5.dialog | 17940 | 17981 |
| v5.grid_workflow | 11442 | 11745 |
| v5.quick_entry | 5916 | 6065 |
| v5.standalone | 5819 | 5823 |
| v5.translation | 5197 | 5347 |
| v5.web_form | 4730 | 4726 |
| erp.sales_invoice | 18127 | 18463 |
| erp.stock_entry | 17206 | 17064 |

## Differences (structure and requests counted only; --all lists them)

- [events] erp.stock_entry / warehouse-get_query: ["stock_entry_type:select-change","stock_entry_type:change","stock_entry_type:blur","from_warehouse:select-change","from_warehouse:focus","from_warehouse:awe... -> ["stock_entry_type:select-change","stock_entry_type:change","stock_entry_type:blur","from_warehouse:select-change","from_warehouse:focus","from_warehouse:awe...
