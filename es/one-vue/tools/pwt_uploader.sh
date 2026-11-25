#!/bin/bash
# Frappe's own file_uploader + control_attach specs against v5.localhost
. ~/fb/env.sh
cd ~/fb/frappe-bench/apps/frappe
NODE_PATH=$HOME/fb/pwt/node_modules BASE_URL=http://v5.localhost:8000 timeout 1200 $HOME/fb/pwt/node_modules/.bin/playwright test --config playwright.config.js --retries=0 --reporter=list --workers=1 playwright/tests/file_uploader.spec.js playwright/tests/control_attach.spec.js
