#!/bin/bash
# Runs every suite on wc/jq/dist, then on the prototype (PROTO=1). One browser at a time.
cd "$(dirname "$0")"; . ~/fb/env.sh
for mode in ${MODES:-dist proto}; do
  for t in baseline overlays menus tabs app toast; do
    if [ $mode = proto ]; then PROTO=1 timeout 300 node t-$t.cjs > out-$mode-$t.txt 2>&1; else timeout 300 node t-$t.cjs > out-$mode-$t.txt 2>&1; fi
    echo "$mode $t: $(tail -1 out-$mode-$t.txt)"
  done
done
