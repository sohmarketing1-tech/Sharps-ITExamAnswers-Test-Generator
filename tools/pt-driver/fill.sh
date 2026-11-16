#!/bin/bash
# fill.sh X Y "text": click a box, clear it, type, press Tab
P="$(cd "$(dirname "$0")" && pwd)"
$P/mouse click $1 $2; sleep 0.2
osascript -e 'tell application "System Events" to keystroke "a" using command down' -e 'delay 0.1' -e "tell application \"System Events\" to keystroke \"$3\"" -e 'delay 0.1' -e 'tell application "System Events" to key code 48'
sleep 0.3
