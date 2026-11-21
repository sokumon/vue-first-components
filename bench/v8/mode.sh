#!/bin/bash
# mode.sh legacy|v5|v8|v8page : switch the bench between the original form controls, the v5 ones and the v8
# ones, and rebuild.
#   legacy: vue_first.bundle.js (v5 runtime, probe classes only) after telemetry; frappe's own controls
#   v5:     vue_first.bundle.js (v5 runtime + v5 controls) before controls.bundle.js
#   v8:     vue_first8.bundle.js (v8 runtime + v8 controls) before controls.bundle.js; frappe.ui.Page is page.js's
#   v8page: v8, and frappe.ui.Page is the v8 port (vue_first8/ui/Page.vue; vue_first8/page_port.js switches it)
set -e
A=~/fb/frappe-bench/apps/frappe; B=$A/frappe/public/js; S=~/fb/pwt/mode
mkdir -p $S
[ -f $S/entry.v5.js ] || cp /tmp/claude-1001/stage/entry.v5controls.js $S/entry.v5.js
[ -f $S/entry.legacy.js ] || cp ~/vue-first-components/bench/desk/vue_first.bundle.js.legacy $S/entry.legacy.js 2>/dev/null || true
cd $A
git show HEAD:frappe/hooks.py > $S/hooks.orig.py
strip_control_js() {
	git show HEAD:frappe/public/js/frappe/form/controls/control.js | python3 -c 'import sys; s=sys.stdin.read(); print(s.replace("import \"./base_control\";\nimport \"./base_input\";\nimport \"./data\";\n","// vue-first test branch: Control, ControlInput and ControlData come from the vue_first bundle loaded before this one\n"), end="")' > frappe/public/js/frappe/form/controls/control.js
}
case "$1" in
legacy)
	cp $S/entry.legacy.js $B/vue_first.bundle.js
	python3 - <<PY
s=open("$S/hooks.orig.py").read().replace('\t"telemetry.bundle.js",\n','\t"telemetry.bundle.js",\n\t"vue_first.bundle.js",\n')
open("$A/frappe/hooks.py","w").write(s)
PY
	git show HEAD:frappe/public/js/frappe/form/controls/control.js > frappe/public/js/frappe/form/controls/control.js
	FILES=frappe/vue_first.bundle.js,frappe/controls.bundle.js
	;;
v5)
	cp $S/entry.v5.js $B/vue_first.bundle.js
	python3 - <<PY
s=open("$S/hooks.orig.py").read().replace('\t"controls.bundle.js",\n','\t"vue_first.bundle.js",\n\t"controls.bundle.js",\n')
open("$A/frappe/hooks.py","w").write(s)
PY
	strip_control_js
	FILES=frappe/vue_first.bundle.js,frappe/controls.bundle.js
	;;
v8|v8page)
	cp $B/vue_first8/page_port.$([ "$1" = v8page ] && echo on || echo off).js $B/vue_first8/page_port.js
	python3 - <<PY
s=open("$S/hooks.orig.py").read().replace('\t"controls.bundle.js",\n','\t"vue_first8.bundle.js",\n\t"controls.bundle.js",\n')
open("$A/frappe/hooks.py","w").write(s)
PY
	strip_control_js
	FILES=frappe/vue_first8.bundle.js,frappe/controls.bundle.js
	;;
*) echo "usage: mode.sh legacy|v5|v8|v8page"; exit 1 ;;
esac
echo "$1" > $S/current
. ~/fb/env.sh
node esbuild --production --apps frappe --files $FILES 2>&1 | tail -3
cd ~/fb/frappe-bench && bench --site v5.localhost clear-cache
