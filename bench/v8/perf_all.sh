#!/bin/bash
# perf_all.sh <mode> : 3 runs of the form/control timings and the row timings in that mode -> ~/fb/pwt/perf_<mode>.txt
. ~/fb/env.sh
M=$1; O=~/fb/pwt/perf_$M.txt; : > $O
cd ~/fb/pw
if [ "$M" = v8 ]; then F=perf_forms_v8.cjs; P=perf_v8.cjs; else F=perf_forms.cjs; P=perf.cjs; fi
for i in 1 2 3; do echo "== forms run $i" >> $O; node $F >> $O 2>&1; done
for i in 1 2 3; do echo "== rows run $i" >> $O; node $P 2>&1 | sed -n '1,/self time/p' >> $O; done
echo done >> $O
