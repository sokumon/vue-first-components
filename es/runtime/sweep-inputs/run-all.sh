#!/bin/bash
# Runs every suite on wc/jq/dist, then on the prototype build (PROTO=1 -> proto/dist/es-ui.iife.js). One browser at a time.
cd "$(dirname "$0")"; . ~/fb/env.sh
for mode in dist proto; do
  for t in simple core selects dates misc desk perf; do
    if [ $mode = proto ]; then PROTO=1 timeout 600 node t-$t.cjs > out-$mode-$t.txt 2>&1; else timeout 600 node t-$t.cjs > out-$mode-$t.txt 2>&1; fi
    echo "$mode $t: $(tail -1 out-$mode-$t.txt)"
  done
done
