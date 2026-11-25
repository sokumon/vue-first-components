#!/bin/bash
# gates.sh <label> : b-ui, inner-specs, full harness + diff vs legacy. Run inside session.sh.
L=$1; W=/home/claude/vue-first-components/wc/three-ways; V=$W/speed2/verify
$W/speed2/implement/verify-assets.sh || exit 98
echo "== b-ui"; node $W/B-es-tags/check/b-ui.cjs > $V/out-bui-$L.log 2>&1; grep -c "^PASS" $V/out-bui-$L.log; grep "^FAIL" $V/out-bui-$L.log; tail -2 $V/out-bui-$L.log
echo "== inner-specs"; $W/B-es-tags/inner-specs.sh $L
echo "== harness"; cd $W/harness && node run.cjs $L > $V/out-harness-$L.log 2>&1; tail -3 $V/out-harness-$L.log
node diff.cjs ../results/harness-legacy.json ../results/harness-$L.json > $V/diff-legacy-vs-$L.txt 2>&1; head -60 $V/diff-legacy-vs-$L.txt
