#!/bin/bash
# run under with-base.sh: speed2 base B (before this phase), es + legacy-in-that-build, 3 rounds; perf2v es once
cd /home/claude/vue-first-components/wc/three-ways/speed2/verify
../implement/verify-assets.sh || exit 98
MODES=es,legacy ROUNDS=3 node forms.cjs Vbase > out-forms-Vbase.log 2>&1; grep " | " out-forms-Vbase.log
MODE=es node perf2v.cjs Vbase-es > out/perf2v-Vbase-es.log 2>&1; tail -16 out/perf2v-Vbase-es.log
