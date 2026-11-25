#!/bin/bash
# harness + diff for label $1 (inside session.sh)
W=/home/claude/vue-first-components/wc/three-ways
. ~/fb/env.sh; export NODE_PATH=~/fb/pw/node_modules
cd $W/harness && node run.cjs "$1" ${@:2} > $W/A-vue-components/results/harness-$1.out 2>&1
node diff.cjs ../results/harness-legacy.json ../results/harness-$1.json > $W/A-vue-components/results/diff-$1.md
head -30 $W/A-vue-components/results/diff-$1.md
