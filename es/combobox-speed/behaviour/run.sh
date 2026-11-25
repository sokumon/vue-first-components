#!/usr/bin/env bash
# ./run.sh <TAG> <FUI path>   -> builds dev+prod and runs the checks; diff with: node check.cjs --diff out/a.json out/b.json
set -euo pipefail
cd "$(dirname "$0")"; . ~/fb/env.sh; export NODE_PATH=~/fb/pw/node_modules
for m in dev prod; do FUI=$2 TAG=$1 MODE=$m npx --no-install vite build --logLevel error; node check.cjs $1-$m; done
