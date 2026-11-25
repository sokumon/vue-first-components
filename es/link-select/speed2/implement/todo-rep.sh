#!/bin/bash
# todo-rep.sh <label> <n> : run harness flow v5.form_todo n times and print the event-class diffs vs legacy
cd /home/claude/vue-first-components/wc/three-ways/harness
for i in $(seq 1 $2); do node run.cjs $1-$i v5.form_todo > /dev/null 2>&1; echo "-- $1-$i"; node diff.cjs ../results/harness-legacy.json ../results/harness-$1-$i.json | grep "^- \[" | grep "form_todo" | cut -c1-90; done
