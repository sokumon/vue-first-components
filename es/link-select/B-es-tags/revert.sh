#!/bin/bash
# Takes variant B off the bench and puts it back to legacy + one-vue (full build). Run under the bench lock.
set -e
W=/home/claude/vue-first-components/wc/three-ways
A=~/fb/frappe-bench/apps/frappe
cd $A
rm -rf frappe/public/js/es_link frappe/public/js/es_link.bundle.js frappe/public/css/es_link.bundle.css
rmdir frappe/public/css 2>/dev/null || true
python3 - <<PY
p="$A/frappe/hooks.py"; s=open(p).read()
s=s.replace('\t"es_link.bundle.js",\n','').replace('\t"es_link.bundle.css",\n','')
open(p,"w").write(s)
import json,glob,os
for f in ["$A/../../sites/assets/assets.json","$A/../../sites/assets/assets-rtl.json"]:
    if os.path.exists(f):
        d=json.load(open(f)); d={k:v for k,v in d.items() if not k.startswith("es_link.bundle")}; json.dump(d,open(f,"w"),indent=4)
for f in glob.glob("$A/../../sites/assets/frappe/dist/*/es_link.bundle.*"): os.remove(f)
for f in glob.glob("$A/../../sites/assets/frappe/dist/css-rtl/es_link.bundle.*"): os.remove(f)
PY
python3 - <<PY
import subprocess
base=open("$W/bench-backup/bench-legacy-onevue.diff").read()
cur=subprocess.run(["git","diff"],capture_output=True,text=True,cwd="$A").stdout
print("tracked diff == legacy+one-vue:", cur==base)
PY
git status --short --untracked-files=all | grep -v vue_first || true
