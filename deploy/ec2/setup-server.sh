#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/eduno-exam}"

echo "[1/7] Updating apt packages..."
sudo apt-get update -y

echo "[2/7] Installing system dependencies..."
sudo apt-get install -y nginx git curl unzip python3 python3-pip

echo "[3/7] Installing Node.js 20..."
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v20.* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "[4/7] Installing PM2..."
sudo npm install -g pm2

echo "[5/7] Installing Python libs for OMR PDF rendering..."
python3 -m pip install --upgrade --user pymupdf pillow

echo "[6/7] Creating app directory..."
sudo mkdir -p "$APP_DIR"
sudo chown -R "$USER":"$USER" "$APP_DIR"

echo "[7/7] Enabling nginx service..."
sudo systemctl enable nginx
sudo systemctl start nginx

echo "Server setup complete."
echo "Next: copy app code to $APP_DIR and run deploy/ec2/deploy-app.sh"
