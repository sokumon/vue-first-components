#!/bin/bash
# Puts variant B on the bench (on top of legacy + one-vue) and rebuilds the two bundles. Run under the bench lock.
set -e
B=/home/claude/vue-first-components/wc/three-ways/B-es-tags
W=/home/claude/vue-first-components/wc/three-ways
A=~/fb/frappe-bench/apps/frappe
cd $A
[ "$(git branch --show-current)" = v5-desk-probe ] || { echo "not on v5-desk-probe"; exit 1; }
[ "$(cat ~/fb/pwt/mode/current)" = legacy ] || { echo "bench mode is not legacy"; exit 1; }
python3 - <<PY
import subprocess
base=open("$W/bench-backup/bench-legacy-onevue.diff").read()
cur=subprocess.run(["git","diff"],capture_output=True,text=True,cwd="$A").stdout
if cur!=base and "es_link.bundle" not in cur: raise SystemExit("bench differs from legacy+one-vue: check by hand")
PY
mkdir -p frappe/public/js/es_link frappe/public/css
cp $B/build/dist/es-link.js frappe/public/js/es_link/es-link.js
cp $B/desk/es_link.bundle.js frappe/public/js/es_link.bundle.js
cp $B/build/dist/es_link.bundle.css frappe/public/css/es_link.bundle.css
python3 - <<PY
p="$A/frappe/hooks.py"; s=open(p).read()
if "es_link.bundle.js" not in s:
    s=s.replace('\t"controls.bundle.js",\n','\t"controls.bundle.js",\n\t"es_link.bundle.js",\n',1)
    s=s.replace('app_include_css = [\n\t"desk.bundle.css",\n','app_include_css = [\n\t"desk.bundle.css",\n\t"es_link.bundle.css",\n',1)
open(p,"w").write(s)
PY
git diff frappe/hooks.py > $B/hooks.applied.diff
. ~/fb/env.sh
node esbuild --production --apps frappe --files frappe/es_link.bundle.js,frappe/es_link.bundle.css 2>&1 | tail -4
cd ~/fb/frappe-bench && bench --site v5.localhost clear-cache && bench --site erp.localhost clear-cache
echo applied
