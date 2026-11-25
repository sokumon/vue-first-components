#!/bin/bash
# Quick rebuild of the IIFE only (keeps the rest of dist).
set -e; cd "$(dirname "$0")"; . ~/fb/env.sh
KEEP=1 MODE=iife ../node_modules/.bin/vite build --logLevel warn
mv dist/es-wc-spike.css dist/es-ui.raw.css
node scripts/css.mjs
