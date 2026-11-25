#!/bin/bash
# Runs every shell-group suite on wc/jq/dist, then on the prototype (proto/dist-nomin). One browser at a time.
cd "$(dirname "$0")"; . ~/fb/env.sh
for t in shell parts settings mobile app toast tabs menus overlays; do
  timeout 400 node t-$t.cjs > out-dist-$t.txt 2>&1; echo "dist  $t: $(tail -1 out-dist-$t.txt)"
  PROTO=dist-nomin timeout 400 node t-$t.cjs > out-proto-$t.txt 2>&1; echo "proto $t: $(tail -1 out-proto-$t.txt)"
done
