#!/bin/bash
# Usage: BUILD=build|build-fix ./run-all.sh  -> runs every t-*.cjs against that build
cd "$(dirname "$0")"; . ~/fb/env.sh
B=${BUILD:-build}; mkdir -p results/$B
for t in t-fields t-formlayout t-listcontrols t-tables t-condition t-timeline t-upload t-apps t-email; do
  BUILD=$B timeout 300 node $t.cjs > results/$B/$t.txt 2>&1
  for f in results-*.json; do mv "$f" results/$B/; done 2>/dev/null
  echo "$t: $(grep -c '^PASS' results/$B/$t.txt) pass, $(grep -c '^FAIL' results/$B/$t.txt) fail, $(grep 'console errors' results/$B/$t.txt)"
done
