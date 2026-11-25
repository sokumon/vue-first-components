#!/bin/bash
# run inside session.sh
cd /home/claude/vue-first-components/wc/three-ways/speed2/verify
../implement/verify-assets.sh || exit 98
MODES=es,legacy ROUNDS=${ROUNDS:-5} node forms.cjs "$1" > out-forms-$1.log 2>&1; grep " | " out-forms-$1.log
