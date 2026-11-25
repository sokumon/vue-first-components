#!/bin/bash
# session.sh <command...> : under the bench lock, for the whole run: take variant B off if it is on the bench
# (it is left applied between B's own locked runs), apply A, run the command, revert A, put B back as it was.
# Inner commands must not take the lock again (flock on a new fd would wait for ourselves).
W=/home/claude/vue-first-components/wc/three-ways
. ~/fb/env.sh; export NODE_PATH=~/fb/pw/node_modules
AV=$W/A-vue-components
exec 9>$W/bench.lock
echo "[session] waiting for bench lock"; flock 9; echo "[session] lock held $(date +%T)"
A=~/fb/frappe-bench/apps/frappe
STASH=$AV/b-stash
B_ON=0
if grep -q es_link.bundle $A/frappe/hooks.py; then
	B_ON=1; rm -rf $STASH; mkdir -p $STASH
	cp $A/frappe/hooks.py $STASH/hooks.py
	cp -r $A/frappe/public/js/es_link $STASH/es_link
	cp $A/frappe/public/js/es_link.bundle.js $STASH/
	cp $A/frappe/public/css/es_link.bundle.css $STASH/ 2>/dev/null
	python3 - <<PY
p="$A/frappe/hooks.py"; s=open(p).read(); open(p,"w").write(s.replace('\t"es_link.bundle.js",\n','').replace('\t"es_link.bundle.css",\n',''))
PY
	echo "[session] variant B was applied: hooks entries taken off (files stashed in $STASH)"
fi
restore_b() {
	if [ $B_ON = 1 ]; then cp $STASH/hooks.py $A/frappe/hooks.py; cd ~/fb/frappe-bench && . ~/fb/env.sh && bench --site v5.localhost clear-cache && bench --site erp.localhost clear-cache; echo "[session] variant B's hooks entries put back"; fi
}
if $AV/apply.sh; then
	"$@"; rc=$?
else rc=99; echo "[session] apply failed"; fi
$AV/revert.sh
restore_b
echo "[session] done rc=$rc $(date +%T)"
exit $rc
