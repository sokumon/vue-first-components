#!/bin/bash
# Puts variant A on the bench (on top of legacy + one-vue) and rebuilds. Run inside session.sh (bench lock held).
set -e
AV=/home/claude/vue-first-components/wc/three-ways/A-vue-components
W=/home/claude/vue-first-components/wc/three-ways
A=~/fb/frappe-bench/apps/frappe
cd $A
[ "$(git branch --show-current)" = v5-desk-probe ] || { echo "not on v5-desk-probe"; exit 1; }
[ "$(cat ~/fb/pwt/mode/current)" = legacy ] || { echo "bench mode is not legacy"; exit 1; }
python3 - <<PY
import subprocess
base=open("$W/bench-backup/bench-legacy-onevue.diff").read()
cur=subprocess.run(["git","diff"],capture_output=True,text=True,cwd="$A").stdout
if cur!=base: raise SystemExit("bench differs from legacy+one-vue: check by hand")
PY
# untracked files of the variant
rm -rf frappe/public/js/tw_a; cp -r $AV/src/tw_a frappe/public/js/tw_a
cp $AV/src/tw_a.bundle.js frappe/public/js/tw_a.bundle.js
cp $AV/src/controls/link_globals.js frappe/public/js/frappe/form/controls/link_globals.js
# tracked files: hooks.py (mode v8's order, with tw_a.bundle.js in place of vue_first8.bundle.js), control.js, web_form.bundle.js
git apply $AV/bench-A.patch
. ~/fb/env.sh
node esbuild --production --apps frappe --files frappe/tw_a.bundle.js,frappe/controls.bundle.js,frappe/web_form.bundle.js 2>&1 | tail -4
cd ~/fb/frappe-bench && bench --site v5.localhost clear-cache && bench --site erp.localhost clear-cache
echo "A applied"
