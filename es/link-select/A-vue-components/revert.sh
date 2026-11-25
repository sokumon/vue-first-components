#!/bin/bash
# Takes variant A off the bench: back to legacy + one-vue, and rebuilds the bundles A touched.
# FULL=1 runs bench-legacy.sh's full `bench build` instead. Run inside session.sh (bench lock held).
set -e
AV=/home/claude/vue-first-components/wc/three-ways/A-vue-components
W=/home/claude/vue-first-components/wc/three-ways
A=~/fb/frappe-bench/apps/frappe
cd $A
git apply -R $AV/bench-A.patch 2>/dev/null && echo "patch reversed" || echo "patch was not applied"
rm -rf frappe/public/js/tw_a frappe/public/js/tw_a.bundle.js frappe/public/js/frappe/form/controls/link_globals.js
python3 - <<PY
import json,glob,os
for f in ["$A/../../sites/assets/assets.json","$A/../../sites/assets/assets-rtl.json"]:
    if os.path.exists(f):
        d=json.load(open(f)); d={k:v for k,v in d.items() if not k.startswith("tw_a.bundle")}; json.dump(d,open(f,"w"),indent=4)
for f in glob.glob("$A/../../sites/assets/frappe/dist/js/tw_a.bundle.*"): os.remove(f)
import subprocess
base=open("$W/bench-backup/bench-legacy-onevue.diff").read()
cur=subprocess.run(["git","diff"],capture_output=True,text=True,cwd="$A").stdout
print("tracked diff == legacy+one-vue:", cur==base)
PY
. ~/fb/env.sh
node esbuild --production --apps frappe --files frappe/controls.bundle.js,frappe/web_form.bundle.js 2>&1 | tail -3
cd ~/fb/frappe-bench && bench --site v5.localhost clear-cache && bench --site erp.localhost clear-cache
echo "A reverted"
