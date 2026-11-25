#!/bin/bash
# Builds the prototype fix into proto/dist (never wc/jq/dist): IIFE + its CSS as es-ui.css.
set -e
cd "$(dirname "$0")"; . ~/fb/env.sh
KEEP_PROP_TYPES=1 MODE=iife OUT=dist ../../../node_modules/.bin/vite build --logLevel warn
mv dist/es-wc-spike.css dist/es-ui.css
ls -la dist
