#!/bin/sh
set -eu

echo "[LabNest] Generating Prisma Client..."
npm run prisma:generate

echo "[LabNest] Applying pending database migrations..."
npx prisma migrate deploy

if [ ! -f .next/BUILD_ID ]; then
  echo "[LabNest] Creating the production build..."
  npm run build
else
  echo "[LabNest] Reusing the existing production build."
fi

echo "[LabNest] Starting the production server on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}..."
exec npm run start -- -H "${HOSTNAME:-0.0.0.0}" -p "${PORT:-3000}"
