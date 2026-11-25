#!/bin/bash
# wait until no other headless browser runs for 5s in a row, then run the command
. ~/fb/env.sh
free=0
while [ $free -lt 5 ]; do
	if pgrep -f headless_shell >/dev/null; then free=0; else free=$((free+1)); fi
	sleep 1
done
cd /home/claude/vue-first-components/wc/one-vue
NODE_PATH=~/fb/pw/node_modules "$@"
