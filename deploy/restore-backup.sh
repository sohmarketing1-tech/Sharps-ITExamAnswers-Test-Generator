#!/usr/bin/env bash
# Load a PythonAnywhere backup onto the server, replacing the app folder contents.
# Run on the server: sudo bash restore-backup.sh /tmp/answrit-backup.tar
set -euo pipefail
BACKUP="${1:?usage: restore-backup.sh <backup.tar>}"
APP_DIR=/srv/answrit/app

# Keep a copy of the current server data first, just in case.
SNAP=/srv/answrit/pre-restore-$(date +%Y%m%d-%H%M%S)
mkdir -p "$SNAP"
cp -a "$APP_DIR"/users.json "$APP_DIR"/user_data.json "$APP_DIR"/chat.json "$SNAP"/ 2>/dev/null || true

systemctl stop answrit
tar xf "$BACKUP" -C "$APP_DIR" --strip-components=1 Sharps-ITExamAnswers-Test-Generator
chown -R answrit:answrit /srv/answrit
systemctl start answrit
sleep 3

cd "$APP_DIR"
python3 - <<'EOF'
import json
u = json.load(open("users.json"))
print("accounts:", len(u.get("users", u)) if isinstance(u, dict) else len(u))
for f in ("user_data.json", "chat.json"):
    json.load(open(f)); print(f, "valid")
EOF
ls -l users.json user_data.json chat.json
systemctl is-active answrit
curl -s -o /dev/null -w "local test: HTTP %{http_code}\n" http://127.0.0.1/
