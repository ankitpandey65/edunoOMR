#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/eduno-exam}"
PORT="${PORT:-3000}"

if [[ ! -f "$APP_DIR/package.json" ]]; then
  echo "package.json not found in $APP_DIR"
  echo "Copy your project files into $APP_DIR first."
  exit 1
fi

cd "$APP_DIR"

if [[ ! -f ".env" ]]; then
  echo ".env is missing in $APP_DIR"
  echo "Create .env using .env.example before deploying."
  exit 1
fi

echo "[1/6] Installing npm dependencies..."
npm ci

echo "[2/6] Generating Prisma client..."
npm run db:generate

echo "[3/6] Applying Prisma schema..."
npm run db:push

echo "[4/6] Building Next.js app..."
npm run build

echo "[5/6] Starting/restarting PM2 service..."
if pm2 describe eduno-exam >/dev/null 2>&1; then
  pm2 restart eduno-exam --update-env
else
  pm2 start ecosystem.config.cjs --env production
fi

echo "[6/6] Saving PM2 startup config..."
pm2 save
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null 2>&1 || true

echo "Deployment complete. App listens internally on port $PORT."
echo "Check logs: pm2 logs eduno-exam"
