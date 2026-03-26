#!/usr/bin/env bash
set -euo pipefail

export NODE_ENV=production
export PORT="${PORT:-3000}"
export DATABASE_URL="${DATABASE_URL:-file:/app/prisma/prod.db}"

mkdir -p /app/prisma /app/public/uploads

echo "Generating Prisma client..."
npm run db:generate

echo "Applying Prisma schema..."
npm run db:push

echo "Starting Eduno Exam on port ${PORT}..."
exec npm run start -- -p "${PORT}"
