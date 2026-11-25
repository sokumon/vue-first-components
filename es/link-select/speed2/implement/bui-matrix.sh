#!/bin/bash
# runs b-ui-flags.cjs once per flag set given as args ("" = none)
cd /home/claude/vue-first-components/wc/three-ways/speed2/implement
for f in "$@"; do echo "== FLAGS=$f"; FLAGS="$f" timeout 300 node b-ui-flags.cjs 2>&1 | grep -E "FAIL|FAILED|passed|PASS" | grep -v "^PASS" | cut -c1-400; done
