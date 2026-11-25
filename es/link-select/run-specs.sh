#!/bin/bash
# run-specs.sh <label> [repeat=1] : frappe's Link/Select specs only, under the bench lock.
#   control_link.spec, control_link_combobox.spec, control_dynamic_link.spec, control_select.spec, link_selector.spec
# Output: wc/three-ways/results/specs-<label>.txt
W=/home/claude/vue-first-components/wc/three-ways
. ~/fb/env.sh
cd ~/fb/frappe-bench && timeout 300 bench --site v5.localhost worker --burst >/dev/null 2>&1
cd ~/fb/frappe-bench/apps/frappe
SPECS="playwright/tests/control_link.spec.js playwright/tests/control_link_combobox.spec.js playwright/tests/control_dynamic_link.spec.js playwright/tests/control_select.spec.js playwright/tests/link_selector.spec.js"
NODE_PATH=$HOME/fb/pwt/node_modules BASE_URL=http://v5.localhost:8000 flock $W/bench.lock \
  $HOME/fb/pwt/node_modules/.bin/playwright test --config playwright.config.js --retries=0 --reporter=list --repeat-each=${2:-1} $SPECS > $W/results/specs-$1.txt 2>&1
grep -E "✘|passed|failed|flaky|did not run" $W/results/specs-$1.txt | tail -20
