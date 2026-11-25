#!/bin/bash
. ~/fb/env.sh
cd /home/claude/vue-first-components/wc/petite-all/shims-frappe-ui
node run.mjs c0-baseline - > logs-c0.txt 2>&1
node run.mjs c1-parse fragfix,parse > logs-c1.txt 2>&1
node run.mjs c2-ts fragfix,parse,ts > logs-c2.txt 2>&1
node run.mjs c3-globals fragfix,parse,ts,globals > logs-c3.txt 2>&1
node run.mjs c4-slots fragfix,parse,ts,globals,slots > logs-c4.txt 2>&1
node run.mjs c5-aliases fragfix,parse,ts,globals,slots,aliases > logs-c5.txt 2>&1
node run.mjs c6-setup fragfix,parse,ts,globals,slots,aliases,setup > logs-c6.txt 2>&1
echo done > sweep.done
