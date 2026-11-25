#!/bin/bash
# measure.sh <label> : forms (es vs legacy, 3 rounds) + micro synth/heap + judge/perf2. Run inside the lock.
L=$1; W=/home/claude/vue-first-components/wc/three-ways; cd $W/speed2/implement
./verify-assets.sh || exit 98
MODES=es,legacy ROUNDS=3 node forms.cjs forms-$L > out-forms-$L.log 2>&1; grep " | " out-forms-$L.log
MODES=es,legacy PARTS=synth,heap ROUNDS=3 node micro.cjs micro-$L > out-micro-$L.log 2>&1; tail -3 out-micro-$L.log
cd $W/judge && node perf2.cjs $L > $W/speed2/implement/out-perf2-$L.log 2>&1; tail -5 $W/speed2/implement/out-perf2-$L.log
