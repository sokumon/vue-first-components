#!/bin/bash
# inner-specs.sh <label> [repeat] : ../run-specs.sh without its flock (run inside session.sh). -> results/specs-<label>.txt
W=/home/claude/vue-first-components/wc/three-ways
. ~/fb/env.sh
cd ~/fb/frappe-bench && timeout 300 bench --site v5.localhost worker --burst >/dev/null 2>&1
cd ~/fb/frappe-bench/apps/frappe
SPECS="playwright/tests/control_link.spec.js playwright/tests/control_link_combobox.spec.js playwright/tests/control_dynamic_link.spec.js playwright/tests/control_select.spec.js playwright/tests/link_selector.spec.js"
NODE_PATH=$HOME/fb/pwt/node_modules BASE_URL=http://v5.localhost:8000 \
  $HOME/fb/pwt/node_modules/.bin/playwright test --config playwright.config.js --retries=0 --reporter=list --repeat-each=${2:-1} $SPECS > $W/B-es-tags/results/specs-$1.txt 2>&1
grep -E "✘|passed|failed|flaky|did not run" $W/B-es-tags/results/specs-$1.txt | tail -20
