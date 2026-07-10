#!/usr/bin/env bash
#
# Daily off-site PostgreSQL backup for SocialDrop.
#
# Usage: ./scripts/backup-db.sh
#
# Required env vars:
#   DATABASE_URL          Postgres connection string (already used by the app)
#   BACKUP_REMOTE         rclone remote + path, e.g. "r2:socialdrop-backups/postgres"
#                          (configure the "r2" remote once with `rclone config`)
# Optional env vars:
#   BACKUP_RETENTION_DAYS Days to keep local + remote dumps before pruning (default: 30)
#   BACKUP_DIR             Local staging directory (default: /var/backups/socialdrop)
#
# Exit code is non-zero on any failure, so this can be wired into an alerting
# wrapper (cron MAILTO, healthchecks.io curl ping, PR #23's alert channel, etc.)
# by checking `$?` after invocation.

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_REMOTE:?BACKUP_REMOTE is required (rclone remote:path)}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/socialdrop}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
DUMP_FILE="$BACKUP_DIR/socialdrop-$TIMESTAMP.dump"

echo "[backup-db] Dumping database to $DUMP_FILE ..."
pg_dump -Fc --dbname="$DATABASE_URL" --file="$DUMP_FILE"

echo "[backup-db] Uploading to $BACKUP_REMOTE ..."
rclone copy "$DUMP_FILE" "$BACKUP_REMOTE" --checksum

echo "[backup-db] Pruning local dumps older than $BACKUP_RETENTION_DAYS days ..."
find "$BACKUP_DIR" -name 'socialdrop-*.dump' -mtime "+$BACKUP_RETENTION_DAYS" -delete

echo "[backup-db] Pruning remote dumps older than $BACKUP_RETENTION_DAYS days ..."
rclone delete "$BACKUP_REMOTE" --min-age "${BACKUP_RETENTION_DAYS}d"

echo "[backup-db] Done: $DUMP_FILE"
