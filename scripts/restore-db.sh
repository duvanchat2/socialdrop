#!/usr/bin/env bash
#
# Restore a SocialDrop PostgreSQL backup produced by scripts/backup-db.sh.
#
# Usage: ./scripts/restore-db.sh <dump-file-or-rclone-path>
#
# Examples:
#   ./scripts/restore-db.sh /var/backups/socialdrop/socialdrop-2026-07-10T03-00-00Z.dump
#   ./scripts/restore-db.sh r2:socialdrop-backups/postgres/socialdrop-2026-07-10T03-00-00Z.dump
#
# Required env vars:
#   DATABASE_URL   Target Postgres connection string to restore INTO.
#                  ALWAYS point this at a staging/empty database first — this
#                  script does not ask for confirmation before dropping objects.

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
SOURCE="${1:?Usage: restore-db.sh <dump-file-or-rclone-path>}"

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

if [[ "$SOURCE" == *:* && "$SOURCE" != /* ]]; then
  echo "[restore-db] Downloading $SOURCE via rclone ..."
  rclone copy "$SOURCE" "$WORKDIR"
  DUMP_FILE="$WORKDIR/$(basename "$SOURCE")"
else
  DUMP_FILE="$SOURCE"
fi

echo "[restore-db] Restoring $DUMP_FILE into \$DATABASE_URL ..."
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "$DUMP_FILE"

echo "[restore-db] Done."
