#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/eduno-exam}"
CONF_SRC="$APP_DIR/deploy/ec2/nginx-eduno-exam.conf"

if [[ ! -f "$CONF_SRC" ]]; then
  echo "Nginx config not found: $CONF_SRC"
  exit 1
fi

sudo cp "$CONF_SRC" /etc/nginx/sites-available/eduno-exam
sudo ln -sf /etc/nginx/sites-available/eduno-exam /etc/nginx/sites-enabled/eduno-exam
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo "Nginx enabled for Eduno Exam."
