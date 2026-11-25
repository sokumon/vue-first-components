#!/bin/bash
# run-all.sh <label> : everything, inside session.sh (bench lock held, A applied)
W=/home/claude/vue-first-components/wc/three-ways; AV=$W/A-vue-components
. ~/fb/env.sh; export NODE_PATH=~/fb/pw/node_modules
$AV/run-harness.sh "$1"
cd $W/harness && node perf.cjs "$1" 7 > $AV/results/perf-$1.out 2> $AV/results/perf-$1.err; tail -3 $AV/results/perf-$1.out
$AV/run-specs.sh "$1" 2
cd ~/fb/frappe-bench && timeout 300 bench --site v5.localhost worker --burst >/dev/null 2>&1
~/fb/pwt/run.sh "suite-$1"; cp ~/fb/pwt/suite-$1.txt $AV/results/suite-$1.txt
