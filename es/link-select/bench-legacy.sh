#!/bin/bash
# bench-legacy.sh : put the bench in the baseline state, legacy controls + one shared Vue (one-vue.diff),
# full rebuild. Idempotent. Variants start from this state and add their own patch on top.
set -e
W=/home/claude/vue-first-components/wc/three-ways
A=~/fb/frappe-bench/apps/frappe
cd $A
[ "$(git branch --show-current)" = v5-desk-probe ] || { echo "bench frappe is not on v5-desk-probe"; exit 1; }
if git apply --check /home/claude/vue-first-components/wc/one-vue/one-vue.diff 2>/dev/null; then
	git apply /home/claude/vue-first-components/wc/one-vue/one-vue.diff && echo "one-vue applied"
elif git apply --check -R /home/claude/vue-first-components/wc/one-vue/one-vue.diff 2>/dev/null; then
	echo "one-vue already applied"
else echo "one-vue.diff neither applies nor reverses: bench differs, check by hand"; exit 1; fi
flock $W/bench.lock ~/fb/pwt/mode.sh legacy
. ~/fb/env.sh; cd ~/fb/frappe-bench
flock $W/bench.lock bench build > $W/results/build-legacy-onevue.log 2>&1
bench --site v5.localhost clear-cache; bench --site erp.localhost clear-cache
~/fb/start_server.sh; ~/fb/start_erp_server.sh
