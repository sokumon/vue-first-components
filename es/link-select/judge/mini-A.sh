#!/bin/bash
W=/home/claude/vue-first-components/wc/three-ways
for f in ~/fb/frappe-bench/sites/assets/frappe/dist/js/tw_a.bundle.*.js; do case $f in *.map) ;; *) echo "$f $(stat -c%s $f) gz=$(gzip -9c $f | wc -c)";; esac; done > $W/results/judge/size-J-A.txt
$W/judge/mini.sh J-A2 specs2
