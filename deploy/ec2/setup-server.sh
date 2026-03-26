#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/eduno-exam}"

if command -v apt-get >/dev/null 2>&1; then
  PKG="apt"
elif command -v dnf >/dev/null 2>&1; then
  PKG="dnf"
else
  echo "Unsupported OS: neither apt-get nor dnf found."
  exit 1
fi

echo "[1/8] Updating system packages..."
if [[ "$PKG" == "apt" ]]; then
  sudo apt-get update -y
else
  sudo dnf update -y
fi

echo "[2/8] Installing core dependencies..."
if [[ "$PKG" == "apt" ]]; then
  sudo apt-get install -y nginx git curl unzip python3 python3-pip
else
  sudo dnf install -y nginx git unzip python3 python3-pip
fi

echo "[3/8] Installing Node.js 20..."
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v20.* ]]; then
  if [[ "$PKG" == "apt" ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  else
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo dnf install -y nodejs
  fi
fi

echo "[4/8] Installing PM2..."
sudo npm install -g pm2

echo "[5/8] Installing Python libs for OMR PDF rendering..."
if python3 -m pip install --help 2>/dev/null | grep -q -- "--break-system-packages"; then
  python3 -m pip install --upgrade --user --break-system-packages pymupdf pillow
else
  python3 -m pip install --upgrade --user pymupdf pillow
fi

echo "[6/8] Creating app directory..."
sudo mkdir -p "$APP_DIR"
sudo chown -R "$USER":"$USER" "$APP_DIR"

echo "[7/8] Enabling nginx service..."
sudo systemctl enable nginx
sudo systemctl start nginx

echo "[8/8] Enabling PM2 startup service..."
sudo env PATH="$PATH:/usr/bin:/usr/local/bin" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null 2>&1 || true

echo "Server setup complete."
echo "Next: copy app code to $APP_DIR and run deploy/ec2/deploy-app.sh"
