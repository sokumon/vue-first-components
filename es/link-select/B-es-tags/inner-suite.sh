#!/bin/bash
# inner-suite.sh <label> : ../run-suite.sh without its flock (run inside session.sh). -> results/suite-<label>.txt
W=/home/claude/vue-first-components/wc/three-ways
. ~/fb/env.sh
cd ~/fb/frappe-bench && timeout 300 bench --site v5.localhost worker --burst >/dev/null 2>&1
~/fb/pwt/run.sh "$1"
cp ~/fb/pwt/$1.txt $W/B-es-tags/results/suite-$1.txt
