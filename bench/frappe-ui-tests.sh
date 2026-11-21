#!/bin/bash
# Runs frappe's own Playwright specs for forms, controls, grids and dialogs against v5.localhost.
# Usage: run.sh <label>   -> ~/fb/pwt/<label>.txt
. ~/fb/env.sh
cd ~/fb/frappe-bench/apps/frappe
SPECS=$(ls playwright/tests | grep -E "^(control_|form\.|form_set|form_tab|form_web|grid|data_field|datetime_field|dialog|client_script|table_multiselect|multi_select|depends_on)" | sed 's#^#playwright/tests/#')
NODE_PATH=$HOME/fb/pwt/node_modules BASE_URL=http://v5.localhost:8000 \
  $HOME/fb/pwt/node_modules/.bin/playwright test --config playwright.config.js --retries=0 --reporter=list $SPECS > $HOME/fb/pwt/$1.txt 2>&1
tail -15 $HOME/fb/pwt/$1.txt
