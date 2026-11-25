#!/bin/bash
# Take B off, undo one-vue, back to v8page with a full build; verify against wc/one-vue/bench-backup.
set -e
W=/home/claude/vue-first-components/wc/three-ways; A=~/fb/frappe-bench/apps/frappe; BK=/home/claude/vue-first-components/wc/one-vue/bench-backup
. ~/fb/env.sh
exec 9>$W/bench.lock; flock 9
$W/B-es-tags/revert.sh
cd $A
git apply -R /home/claude/vue-first-components/wc/one-vue/one-vue.diff
~/fb/pwt/mode.sh v8page
rm -f ~/fb/frappe-bench/sites/assets/assets.json
cd ~/fb/frappe-bench && bench build > $W/speed/restore-build.log 2>&1
bench --site v5.localhost clear-cache; bench --site erp.localhost clear-cache
~/fb/start_server.sh >/dev/null 2>&1 || true; ~/fb/start_erp_server.sh >/dev/null 2>&1 || true
cd $A
echo "branch: $(git branch --show-current) head: $(git rev-parse --short HEAD) (backup: $(cat $BK/head.txt))"
git diff | cmp -s - $BK/bench.diff && echo "tracked diff == backup" || echo "TRACKED DIFF DIFFERS"
git status --porcelain | cmp -s - $BK/status-porcelain.txt && echo "status == backup" || echo "STATUS DIFFERS"
echo "mode: $(cat ~/fb/pwt/mode/current)"
grep -c ':requires\|es_link\|tw_a' ~/fb/frappe-bench/sites/assets/assets.json || true
cd ~/fb/pw && NODE_PATH=~/fb/pw/node_modules node probe_v8.cjs 2>&1 | tail -2; NODE_PATH=~/fb/pw/node_modules node probe_page_v8.cjs 2>&1 | tail -2
