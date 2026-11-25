#!/bin/bash
# judge/inner.sh <label> : run inside a variant's session (bench lock already held, variant applied).
# harness + diff, Link/Select specs x2, grid.spec, break checks, render-inclusive perf, perf.cjs
W=/home/claude/vue-first-components/wc/three-ways; J=$W/results/judge; mkdir -p $J
. ~/fb/env.sh; export NODE_PATH=~/fb/pw/node_modules
L=$1
echo "== harness $(date +%T)"
cd $W/harness && node run.cjs $L > $J/harness-$L.out 2>&1; tail -12 $J/harness-$L.out
node diff.cjs ../results/harness-legacy.json ../results/harness-$L.json > $J/diff-$L.md; head -14 $J/diff-$L.md
echo "== break $(date +%T)"
cd $W/judge && node break.cjs $L > $J/break-$L.out 2>&1; tail -2 $J/break-$L.out
echo "== perf2 $(date +%T)"
node perf2.cjs $L > $J/perf2-$L.out 2>&1; tail -3 $J/perf2-$L.out
echo "== leak $(date +%T)"
cd $W/judge && node leak.cjs $L > $J/leak-$L.out 2>&1; cat $J/leak-$L.out
echo "== perf $(date +%T)"
cd $W/harness && node perf.cjs $L 7 > $J/perf-$L.out 2>&1; tail -2 $J/perf-$L.out
echo "== specs $(date +%T)"
cd ~/fb/frappe-bench && timeout 300 bench --site v5.localhost worker --burst >/dev/null 2>&1
cd ~/fb/frappe-bench/apps/frappe
SPECS="playwright/tests/control_link.spec.js playwright/tests/control_link_combobox.spec.js playwright/tests/control_dynamic_link.spec.js playwright/tests/control_select.spec.js playwright/tests/link_selector.spec.js"
NODE_PATH=$HOME/fb/pwt/node_modules BASE_URL=http://v5.localhost:8000 $HOME/fb/pwt/node_modules/.bin/playwright test --config playwright.config.js --retries=0 --reporter=list --repeat-each=2 $SPECS > $J/specs-$L.txt 2>&1
grep -E "✘|passed|failed|flaky|did not run" $J/specs-$L.txt | tail -12
echo "== grid+dialog+form specs $(date +%T)"
cd ~/fb/frappe-bench && timeout 300 bench --site v5.localhost worker --burst >/dev/null 2>&1
cd ~/fb/frappe-bench/apps/frappe
NODE_PATH=$HOME/fb/pwt/node_modules BASE_URL=http://v5.localhost:8000 $HOME/fb/pwt/node_modules/.bin/playwright test --config playwright.config.js --retries=0 --reporter=list playwright/tests/grid.spec.js playwright/tests/grid_keyboard_shortcut.spec.js playwright/tests/grid_dropdown_position.spec.js playwright/tests/dialog_primary_action.spec.js playwright/tests/form.spec.js playwright/tests/multi_select_dialog.spec.js > $J/specs2-$L.txt 2>&1
grep -E "✘|passed|failed|flaky|did not run" $J/specs2-$L.txt | tail -12
echo "== done $(date +%T)"
