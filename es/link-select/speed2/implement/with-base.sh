#!/bin/bash
# with-base.sh <command...> : under the bench lock, put the PRE-speed2 B (speed2/implement/base) on the bench,
# run the command, and leave it there (the next session.sh sees the difference and re-applies the current B).
W=/home/claude/vue-first-components/wc/three-ways; I=$W/speed2/implement/base; A=~/fb/frappe-bench/apps/frappe
. ~/fb/env.sh; export NODE_PATH=~/fb/pw/node_modules
exec 9>$W/bench.lock; flock 9; echo "[base] lock held $(date +%T)"
grep -q es_link.bundle $A/frappe/hooks.py || { echo "B hooks not applied: run session.sh first"; exit 99; }
cp $I/dist/es-link.js $A/frappe/public/js/es_link/es-link.js
cp $I/desk/es_link.bundle.js $A/frappe/public/js/es_link.bundle.js
cp $I/dist/es_link.bundle.css $A/frappe/public/css/es_link.bundle.css
(cd $A && node esbuild --production --apps frappe --files frappe/es_link.bundle.js,frappe/es_link.bundle.css 2>&1 | tail -1)
(cd ~/fb/frappe-bench && bench --site v5.localhost clear-cache && bench --site erp.localhost clear-cache)
"$@"; rc=$?; echo "[base] done rc=$rc $(date +%T)"; exit $rc
