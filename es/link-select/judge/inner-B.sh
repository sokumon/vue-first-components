#!/bin/bash
# inside B's session.sh: record built sizes, run judge/inner.sh, then take B off (revert.sh) while the lock is held
W=/home/claude/vue-first-components/wc/three-ways
ls -la ~/fb/frappe-bench/sites/assets/frappe/dist/js/ ~/fb/frappe-bench/sites/assets/frappe/dist/css/ | grep es_link | grep -v map > $W/results/judge/size-J-B.txt
for f in ~/fb/frappe-bench/sites/assets/frappe/dist/js/es_link.bundle.*.js ~/fb/frappe-bench/sites/assets/frappe/dist/css/es_link.bundle.*.css; do echo "$f $(stat -c%s $f) gz=$(gzip -9c $f | wc -c)"; done >> $W/results/judge/size-J-B.txt
$W/judge/inner.sh J-B
$W/B-es-tags/revert.sh
