#!/bin/bash
# verify-assets.sh : both sites must serve the es_link bundle hashes in sites/assets/assets.json (Frappe's
# in-process client_cache of assets.json sometimes keeps the old map after clear-cache). Retries clear-cache.
# Run inside the bench lock.
. ~/fb/env.sh
J=/tmp/claude-1001/-home-claude-vue-first-components/c3b8c519-714a-4950-9c65-c4896ba6eedf/scratchpad
mkdir -p $J
want=$(python3 -c "import json;a=json.load(open('$HOME/fb/frappe-bench/sites/assets/assets.json'));print(' '.join(sorted(v.split('/')[-1] for k,v in a.items() if k in ('es_link.bundle.js','es_link.bundle.css'))))")
for i in 1 2 3 4 5 6; do
	ok=1
	for s in v5.localhost:8000 erp.localhost:8001; do
		curl -s -c $J/cj-$s -X POST http://$s/api/method/login -d 'usr=Administrator&pwd=admin' >/dev/null
		got=$(curl -s -b $J/cj-$s http://$s/desk | grep -o 'es_link\.bundle\.[A-Z0-9]*\.\(js\|css\)' | sort -u | tr '\n' ' ')
		for w in $want; do echo "$got" | grep -q "$w" || ok=0; done
		[ $ok = 1 ] || echo "[verify] $s serves '$got' want '$want'"
	done
	[ $ok = 1 ] && { echo "[verify] both sites serve $want"; exit 0; }
	(cd ~/fb/frappe-bench && bench --site v5.localhost clear-cache && bench --site erp.localhost clear-cache) >/dev/null 2>&1
	sleep 3
done
echo "[verify] FAILED"; exit 1
