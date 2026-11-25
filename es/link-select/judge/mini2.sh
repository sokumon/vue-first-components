#!/bin/bash
W=/home/claude/vue-first-components/wc/three-ways; J=$W/results/judge
. ~/fb/env.sh; export NODE_PATH=~/fb/pw/node_modules
cd $W/judge && STEPS=form-switch-docs,switch-doc-with-list-open,read-only-toggle ONLY=v5 node break.cjs $1 > $J/break-$1.out 2>&1; tail -1 $J/break-$1.out
[ -n "$2" ] && $W/B-es-tags/revert.sh
true
