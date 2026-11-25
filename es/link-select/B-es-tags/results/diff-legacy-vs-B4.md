# legacy vs B4

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
| v5.form_todo | 40027 | 41208 |
| v5.form_user_titles | 7827 | 7899 |
| v5.dialog | 17940 | 18022 |
| v5.grid_workflow | 11442 | 11650 |
| v5.quick_entry | 5916 | 6098 |
| v5.standalone | 5819 | 5900 |
| v5.translation | 5197 | 5640 |
| v5.web_form | 4730 | 4850 |
| erp.sales_invoice | 18127 | 19908 |
| erp.stock_entry | 17206 | 17530 |

## Differences

- [events] v5.form_todo / advanced-search: ["allocated_to:select-change","frm:allocated_to","allocated_to:select-change","allocated_to:awesomplete-open","allocated_to:focus","allocated_to:awesomplete-... -> ["allocated_to:select-change","frm:allocated_to","allocated_to:select-change","frm:allocated_to","allocated_to:select-change","allocated_to:awesomplete-open"...
