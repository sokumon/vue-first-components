#!/bin/bash
# inner-quick.sh <label> : harness (all flows) + diff + Link/Select specs once + B UI checks (inside session.sh)
W=/home/claude/vue-first-components/wc/three-ways; B=$W/B-es-tags
. ~/fb/env.sh; export NODE_PATH=~/fb/pw/node_modules
cd $W/harness
node run.cjs "$1" 2>&1 | tail -11
node diff.cjs ../results/harness-legacy.json ../results/harness-$1.json --all > $B/results/diff-legacy-vs-$1.md; sed -n 3,10p $B/results/diff-legacy-vs-$1.md; grep '^- ' $B/results/diff-legacy-vs-$1.md | cut -c1-300
node $B/check/b-ui.cjs > $B/results/b-ui-$1.txt 2>&1; grep -v '^\s' $B/results/b-ui-$1.txt | cut -c1-300
$B/inner-specs.sh "$1" 1
