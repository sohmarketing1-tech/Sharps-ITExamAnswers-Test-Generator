#!/bin/bash
# Tiny Packet Tracer driver. Coordinates are screen points (screenshot is shrunk to 1470 wide = points).
#   pt.sh shot NAME            -> screenshot to NAME.png (point-sized)
#   pt.sh click X Y            -> left click
#   pt.sh dclick X Y           -> double click
#   pt.sh type "text"          -> type text
#   pt.sh key return|tab|esc   -> press a key
D="$(cd "$(dirname "$0")" && pwd)/shots"; mkdir -p "$D"
front='tell application "System Events" to set frontmost of process "PacketTracer" to true'
case "$1" in
  shot) screencapture -x "$D/raw.png" && sips -Z 1470 "$D/raw.png" --out "$D/$2.png" >/dev/null && echo "$D/$2.png" ;;
  click) osascript -e "$front" -e 'delay 0.2' -e "tell application \"System Events\" to click at {$2, $3}" >/dev/null ;;
  dclick) osascript -e "$front" -e 'delay 0.2' -e "tell application \"System Events\" to click at {$2, $3}" -e 'delay 0.05' -e "tell application \"System Events\" to click at {$2, $3}" >/dev/null ;;
  type) osascript -e "$front" -e 'delay 0.2' -e "tell application \"System Events\" to keystroke \"$2\"" ;;
  key) case "$2" in return) c=36;; tab) c=48;; esc) c=53;; down) c=125;; up) c=126;; *) c=$2;; esac
       osascript -e "$front" -e 'delay 0.1' -e "tell application \"System Events\" to key code $c" ;;
esac
