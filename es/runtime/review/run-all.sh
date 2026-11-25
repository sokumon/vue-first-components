#!/bin/bash
# Adversarial review suites. One browser at a time. BUILD=proto swaps in wc/jq/sweep-shell/proto/dist-nomin.
cd "$(dirname "$0")"; . ~/fb/env.sh
node desk-build/build.mjs   # mobile_nav_es.bundle.js + other_app.bundle.js via frappe's esbuild + frappe-vue plugin (copy)
for t in claims desk shared safety attrs big perf mobile twobundles; do echo "== $t"; node t-$t.cjs 2>&1 | grep -E '^(PASS|FAIL)|FAILED|ALL PASS'; done
PAGE=mobile-bare.html node t-mobile.cjs 2>&1 | grep -E 'ISSUE 3'
for t in claims desk shared safety big; do echo "== proto $t"; BUILD=proto node t-$t.cjs 2>&1 | grep -E '^(PASS|FAIL)|FAILED|ALL PASS'; done
