# legacy vs B2

| class | differences |
|---|---:|
| behaviour | 0 |
| api | 0 |
| structure | 0 |
| events | 1 |
| requests | 0 |
| errors | 0 |

| flow | A ms | B ms |
|---|---:|---:|
| v5.form_todo | 40027 | 40764 |
| v5.form_user_titles | 7827 | 7719 |
| v5.dialog | 17940 | 18204 |
| v5.grid_workflow | 11442 | 11649 |
| v5.quick_entry | 5916 | 6204 |
| v5.standalone | 5819 | 5847 |
| v5.translation | 5197 | 5292 |
| v5.web_form | 4730 | 4680 |
| erp.sales_invoice | 18127 | 18317 |
| erp.stock_entry | 17206 | 17209 |

## Differences

- [events] v5.form_todo / link-focus-opens-list: ["status:blur","allocated_to:select-change","allocated_to:focus","allocated_to:awesomplete-open"] -> ["allocated_to:select-change","allocated_to:focus","allocated_to:awesomplete-open"]
