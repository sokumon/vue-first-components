#!/bin/bash
# inner-all.sh <label> : harness, perf, B perf-extra, B UI checks, Link/Select specs x2, full suite (inside session.sh)
W=/home/claude/vue-first-components/wc/three-ways; B=$W/B-es-tags
. ~/fb/env.sh; export NODE_PATH=~/fb/pw/node_modules
cd $W/harness
node run.cjs "$1" 2>&1 | tail -12
node diff.cjs ../results/harness-legacy.json ../results/harness-$1.json --all > $B/results/diff-legacy-vs-$1.md; head -10 $B/results/diff-legacy-vs-$1.md
node perf.cjs "$1" 7 > $W/results/perf-$1.out 2> $W/results/perf-$1.err; cat $W/results/perf-$1.out | tail -3
node $B/check/perf-extra.cjs > $B/results/perf-extra-$1.json; cat $B/results/perf-extra-$1.json
node $B/check/b-ui.cjs > $B/results/b-ui-$1.txt 2>&1; tail -2 $B/results/b-ui-$1.txt
$B/inner-specs.sh "$1" 2
[ -n "$SKIP_SUITE" ] || $B/inner-suite.sh "$1"
