#!/bin/bash
# session.sh <command...> : under the bench lock for the whole run: make sure variant B is on the bench
# (re-applies it if another agent's session took it off or the files differ), then run the command.
# Inner commands must not take the lock again.
W=/home/claude/vue-first-components/wc/three-ways; B=$W/B-es-tags; A=~/fb/frappe-bench/apps/frappe
. ~/fb/env.sh; export NODE_PATH=~/fb/pw/node_modules
exec 9>$W/bench.lock
echo "[bsession] waiting for bench lock"; flock 9; echo "[bsession] lock held $(date +%T)"
if ! grep -q es_link.bundle $A/frappe/hooks.py || ! cmp -s $B/desk/es_link.bundle.js $A/frappe/public/js/es_link.bundle.js \
	|| ! cmp -s $B/build/dist/es-link.js $A/frappe/public/js/es_link/es-link.js || ! cmp -s $B/build/dist/es_link.bundle.css $A/frappe/public/css/es_link.bundle.css; then
	echo "[bsession] (re)applying B"; $B/apply.sh || exit 99
fi
"$@"; rc=$?
echo "[bsession] done rc=$rc $(date +%T)"
exit $rc
