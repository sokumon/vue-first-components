#!/bin/bash
# Builds the B runtime: build/dist/es-link.js (ESM, vue external, es-combobox + es-select only) and
# build/dist/es_link.bundle.css (scoped Tailwind + component styles + desk/glue.css). No bench access.
set -e
cd "$(dirname "$0")/build"; . ~/fb/env.sh
../../../node_modules/.bin/vite build --logLevel warn
node css.mjs
cat dist/es-link.css ../desk/glue.css > dist/es_link.bundle.css
ls -la dist
