#!/bin/bash
# run-all.sh <label> : everything for the mode the bench is in now, each step under the bench lock.
#   1. harness (differential flows)  -> results/harness-<label>.json, results/<label>/shots/
#   2. perf                          -> results/perf-<label>.json
#   3. Link/Select specs (x2)        -> results/specs-<label>.txt
#   4. full frappe suite (~17 min)   -> results/suite-<label>.txt   (skip with SKIP_SUITE=1)
# Then diff against the legacy baseline: node harness/diff.cjs results/harness-legacy.json results/harness-<label>.json
set -e
W=/home/claude/vue-first-components/wc/three-ways
. ~/fb/env.sh
cd $W/harness
NODE_PATH=~/fb/pw/node_modules flock $W/bench.lock node run.cjs "$1"
NODE_PATH=~/fb/pw/node_modules flock $W/bench.lock node perf.cjs "$1" 7 > $W/results/perf-$1.out
$W/run-specs.sh "$1" 2
[ -n "$SKIP_SUITE" ] || $W/run-suite.sh "$1"
node $W/harness/diff.cjs $W/results/harness-legacy.json $W/results/harness-$1.json > $W/results/diff-legacy-vs-$1.md || true
head -12 $W/results/diff-legacy-vs-$1.md
