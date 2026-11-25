#!/bin/bash
# run inside session.sh: perf2v in alternating modes, 2 rounds
cd /home/claude/vue-first-components/wc/three-ways/speed2/verify
../implement/verify-assets.sh || exit 98
for r in 1 2; do
  ms="legacy es es+top legacy+top es+eager"; [ $r = 2 ] && ms="es+eager legacy+top es+top es legacy"
  for m in $ms; do MODE=$m node perf2v.cjs "$1-${m/+/_}-r$r" > out/perf2v-$1-${m/+/_}-r$r.log 2>&1 || echo "FAIL $m r$r"; echo "done $m r$r"; done
done
