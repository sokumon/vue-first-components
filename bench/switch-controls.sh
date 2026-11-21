#!/bin/bash
# mode.sh legacy|v5 : switch the bench between the original form controls and the v5 ones, and rebuild.
set -e
A=~/fb/frappe-bench/apps/frappe; B=$A/frappe/public/js; S=~/fb/pwt/mode
mkdir -p $S
[ -f $S/entry.v5.js ] || cp /tmp/claude-1001/stage/entry.v5controls.js $S/entry.v5.js
[ -f $S/entry.legacy.js ] || cp ~/vue-first-components/bench/desk/vue_first.bundle.js.legacy $S/entry.legacy.js 2>/dev/null || true
cd $A
git show HEAD:frappe/hooks.py > $S/hooks.orig.py
if [ "$1" = legacy ]; then
	cp $S/entry.legacy.js $B/vue_first.bundle.js
	python3 - <<PY
s=open("$S/hooks.orig.py").read().replace('\t"telemetry.bundle.js",\n','\t"telemetry.bundle.js",\n\t"vue_first.bundle.js",\n')
open("$A/frappe/hooks.py","w").write(s)
PY
	git show HEAD:frappe/public/js/frappe/form/controls/control.js > frappe/public/js/frappe/form/controls/control.js
else
	cp $S/entry.v5.js $B/vue_first.bundle.js
	python3 - <<PY
s=open("$S/hooks.orig.py").read().replace('\t"controls.bundle.js",\n','\t"vue_first.bundle.js",\n\t"controls.bundle.js",\n')
open("$A/frappe/hooks.py","w").write(s)
PY
	git show HEAD:frappe/public/js/frappe/form/controls/control.js | python3 -c 'import sys; s=sys.stdin.read(); print(s.replace("import \"./base_control\";\nimport \"./base_input\";\nimport \"./data\";\n","// v5 test branch: Control, ControlInput and ControlData come from vue_first.bundle.js\n"), end="")' > frappe/public/js/frappe/form/controls/control.js
fi
. ~/fb/env.sh
node esbuild --production --apps frappe --files frappe/vue_first.bundle.js,frappe/controls.bundle.js 2>&1 | tail -1
cd ~/fb/frappe-bench && bench --site v5.localhost clear-cache
