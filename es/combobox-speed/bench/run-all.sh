#!/usr/bin/env bash
# Full baseline: builds npm + clone in every mode, then runs each suite serially (one browser at a time).
#   ./run-all.sh [outDir] [runs]      e.g. ./run-all.sh ../baseline/raw 7
# FUI_LIST="npm clone" by default; add an absolute checkout path for a patched copy (TAG names it).
set -euo pipefail
cd "$(dirname "$0")"
. ~/fb/env.sh
export NODE_PATH=~/fb/pw/node_modules
OUT=${1:-../baseline/raw}; RUNS=${2:-7}
FUI_LIST=${FUI_LIST:-"npm clone"}
for f in $FUI_LIST; do
  for m in prod count prof dev; do FUI=$f MODE=$m npx --no-install vite build --logLevel error; done
done
for f in $FUI_LIST; do
  t=${TAG:-$f}
  [ -d "dist/$t-prod" ] || t=$(basename "$f")
  node run.cjs $t-prod timing $RUNS $OUT
  node run.cjs $t-prod memory $RUNS $OUT
  node run.cjs $t-count counts 1 $OUT
  node run.cjs $t-prof profile 5 $OUT
  node run.cjs $t-dev dev 5 $OUT
  node run.cjs $t-dev rerenders 1 $OUT
  node analyze-profile.cjs $t-prof $OUT/$t-prof-mount100-run*.cpuprofile > $OUT/$t-profile-attribution.md
done
node report.cjs $OUT $(for f in $FUI_LIST; do echo ${TAG:-$(basename $f)}; done) > $OUT/tables.md
echo done
