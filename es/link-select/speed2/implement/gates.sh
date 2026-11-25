#!/bin/bash
# gates.sh <label> : b-ui, inner-specs x2, full harness + diff vs legacy. Run inside session.sh.
L=$1; W=/home/claude/vue-first-components/wc/three-ways
echo "== b-ui"; node $W/B-es-tags/check/b-ui.cjs 2>&1 | tail -12
echo "== inner-specs x2"; $W/B-es-tags/inner-specs.sh $L 2
echo "== harness"; cd $W/harness && node run.cjs $L > $W/speed2/implement/out-harness-$L.log 2>&1; tail -3 $W/speed2/implement/out-harness-$L.log
node diff.cjs ../results/harness-legacy.json ../results/harness-$L.json > $W/speed2/implement/diff-legacy-vs-$L.txt 2>&1; head -40 $W/speed2/implement/diff-legacy-vs-$L.txt
