#!/bin/bash
# Builds wc/jq/dist: the IIFE (Vue inside), the ES module (vue external), the two stylesheets.
set -e
cd "$(dirname "$0")"; . ~/fb/env.sh
MODE=iife ../node_modules/.bin/vite build --logLevel warn
mv dist/es-wc-spike.css dist/es-ui.raw.css
MODE=esm ../node_modules/.bin/vite build --logLevel warn
node scripts/tags.cjs
node scripts/css.mjs
rm -f dist/esm/es-wc-spike.css  # component <style> blocks are already in dist/es-ui*.css
node scripts/esm-check.mjs
ls -la dist dist/esm | grep -v '^total'
