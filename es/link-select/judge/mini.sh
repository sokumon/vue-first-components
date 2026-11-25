#!/bin/bash
# judge/mini.sh <label> [specs2] : break (v2, strict visibility) + leak (+ grid/dialog/form specs), inside a held lock
W=/home/claude/vue-first-components/wc/three-ways; J=$W/results/judge
. ~/fb/env.sh; export NODE_PATH=~/fb/pw/node_modules
L=$1
cd $W/judge && node break.cjs $L > $J/break-$L.out 2>&1; tail -1 $J/break-$L.out
node leak.cjs $L > $J/leak-$L.out 2>&1; cat $J/leak-$L.out
if [ -n "$2" ]; then
 cd ~/fb/frappe-bench && timeout 300 bench --site v5.localhost worker --burst >/dev/null 2>&1
 cd ~/fb/frappe-bench/apps/frappe
 NODE_PATH=$HOME/fb/pwt/node_modules BASE_URL=http://v5.localhost:8000 $HOME/fb/pwt/node_modules/.bin/playwright test --config playwright.config.js --retries=0 --reporter=list playwright/tests/grid.spec.js playwright/tests/grid_keyboard_shortcut.spec.js playwright/tests/grid_dropdown_position.spec.js playwright/tests/dialog_primary_action.spec.js playwright/tests/form.spec.js playwright/tests/multi_select_dialog.spec.js > $J/specs2-$L.txt 2>&1
 grep -E "✘|passed|failed|flaky|did not run" $J/specs2-$L.txt | cut -c1-160
fi
