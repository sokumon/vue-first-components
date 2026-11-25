#!/bin/bash
# run-suite.sh <label> : drain RQ, then frappe's Playwright suite (~/fb/pwt/run.sh) under the bench lock.
# Output: ~/fb/pwt/<label>.txt, copied to wc/three-ways/results/suite-<label>.txt
W=/home/claude/vue-first-components/wc/three-ways
. ~/fb/env.sh
cd ~/fb/frappe-bench && timeout 300 bench --site v5.localhost worker --burst >/dev/null 2>&1
flock $W/bench.lock ~/fb/pwt/run.sh "$1"
cp ~/fb/pwt/$1.txt $W/results/suite-$1.txt
