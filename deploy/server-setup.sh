#!/usr/bin/env bash
# One-time setup of the answrit.net Google Cloud server (Ubuntu 24.04, e2-micro).
# Run on the server: sudo bash server-setup.sh /tmp/answrit-backup.tar.gz
set -euo pipefail
BACKUP="${1:?usage: server-setup.sh <backup.tar.gz>}"
APP_USER=answrit
APP_DIR=/srv/answrit/app

# 1. Swap file: the free server has only 1 GB of memory.
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 2. System packages: Python, plus Caddy as the web server (it handles HTTPS automatically later).
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q python3-venv python3-pip caddy git

# 3. App user and files, unpacked from the PythonAnywhere backup.
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir /srv/answrit --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR"
tar xf "$BACKUP" -C "$APP_DIR" --strip-components=1 Sharps-ITExamAnswers-Test-Generator
tar xf "$BACKUP" -C /srv/answrit pip-freeze.txt || true
chown -R "$APP_USER:$APP_USER" /srv/answrit
git config --system --add safe.directory "$APP_DIR"

# 4. Python environment with the same package versions as PythonAnywhere, plus gunicorn.
sudo -u "$APP_USER" python3 -m venv /srv/answrit/venv
sudo -u "$APP_USER" /srv/answrit/venv/bin/pip install -q --upgrade pip
sudo -u "$APP_USER" /srv/answrit/venv/bin/pip install -q -r /srv/answrit/pip-freeze.txt gunicorn

# 5. Run the app as a service that starts on boot and restarts if it crashes.
#    One process with threads, so it behaves like PythonAnywhere's single app.
cat > /etc/systemd/system/answrit.service <<EOF
[Unit]
Description=answrit.net Flask app
After=network.target

[Service]
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
ExecStart=/srv/answrit/venv/bin/gunicorn --workers 1 --threads 4 --timeout 60 --bind 127.0.0.1:8000 app:app
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# 6. Caddy: send web traffic on port 80 to the app. HTTPS is added at domain switch time.
cat > /etc/caddy/Caddyfile <<'EOF'
:80 {
    encode gzip
    reverse_proxy 127.0.0.1:8000
}
EOF

systemctl daemon-reload
systemctl enable --now answrit
systemctl restart caddy
sleep 3
systemctl --no-pager --lines=5 status answrit | head -12
curl -s -o /dev/null -w "local test: HTTP %{http_code}\n" http://127.0.0.1/
