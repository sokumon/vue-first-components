#!/bin/bash
# Times desk asset builds. Usage: run.sh <label>
. ~/fb/env.sh
APP=~/fb/frappe-bench/apps/frappe
B=$APP/frappe/public/js/vue_first.bundle.js
OUT=~/fb/buildtime/results-$1.txt; : > $OUT
t() { local s=$(date +%s.%N); "$@" > /dev/null 2>&1; local rc=$?; echo "$(echo "$(date +%s.%N) - $s" | bc) rc=$rc"; }
cd $APP
for i in 1 2 3 4 5; do echo "desk esbuild (all frappe bundles, with v5): $(t node esbuild --production --apps frappe)" >> $OUT; done
for i in 1 2 3 4 5; do echo "v5 bundle only (--files frappe/vue_first.bundle.js): $(t node esbuild --production --apps frappe --files frappe/vue_first.bundle.js)" >> $OUT; done
for i in 1 2 3 4 5; do echo "desk.bundle only: $(t node esbuild --production --apps frappe --files frappe/desk.bundle.js)" >> $OUT; done
mv $B /tmp/claude-1001/vfb.js
for i in 1 2 3 4 5; do echo "desk esbuild (all frappe bundles, WITHOUT v5): $(t node esbuild --production --apps frappe)" >> $OUT; done
mv /tmp/claude-1001/vfb.js $B
cd ~/fb/frappe-bench
echo "bench build --app frappe (warm, islands cached): $(t bench build --app frappe)" >> $OUT
rm -f $APP/frappe/public/dist/island/.inputs.json $APP/frappe/public/dist/page-island/.inputs.json
echo "bench build --app frappe (cold islands): $(t bench build --app frappe)" >> $OUT
echo "bench build (all apps, warm): $(t bench build)" >> $OUT
ls ~/fb/frappe-bench/apps >> $OUT
cat $OUT
