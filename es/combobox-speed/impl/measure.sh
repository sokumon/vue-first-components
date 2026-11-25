#!/usr/bin/env bash
# ./measure.sh <TAG> <FUI abs path> [runs]  -> bench builds + timing/memory/counts/rerenders into impl/raw
set -euo pipefail
cd "$(dirname "$0")/../bench"; . ~/fb/env.sh; export NODE_PATH=~/fb/pw/node_modules
T=$1; F=$2; R=${3:-7}; OUT=../impl/raw
for m in prod count dev; do FUI=$F TAG=$T MODE=$m npx --no-install vite build --logLevel error; done
node run.cjs $T-prod timing $R $OUT
node run.cjs $T-prod memory 5 $OUT
node run.cjs $T-count counts 1 $OUT
node run.cjs $T-dev rerenders 1 $OUT
