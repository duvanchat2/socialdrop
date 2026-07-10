# Backups de PostgreSQL

## Backup diario (off-site)

`scripts/backup-db.sh` hace `pg_dump -Fc` de la base de datos y lo sube a un
remote de `rclone` (R2/S3/B2, lo que esté configurado). Requiere:

- `DATABASE_URL` — ya está en el `.env` del proyecto.
- `BACKUP_REMOTE` — remote:path de rclone, ej. `r2:socialdrop-backups/postgres`.
- `rclone` configurado en el host (`rclone config`) con las credenciales del
  bucket destino — **pendiente de configurar en el VPS**, no incluido en este PR.

Retención por defecto: 30 días (local y remoto), configurable con
`BACKUP_RETENTION_DAYS`.

**Pendiente de aprobación manual:** wiring del cron (crontab del host o
servicio `backup` en `docker-compose.yml`) y las credenciales reales del
bucket — no se tocó `docker-compose.yml` en este PR.

## Restaurar un backup

```bash
DATABASE_URL="postgres://user:pass@host:5432/staging_db" \
  ./scripts/restore-db.sh /ruta/al/socialdrop-2026-07-10T03-00-00Z.dump

# o directo desde el remote:
DATABASE_URL="postgres://user:pass@host:5432/staging_db" \
  ./scripts/restore-db.sh r2:socialdrop-backups/postgres/socialdrop-2026-07-10T03-00-00Z.dump
```

**Siempre restaura primero contra una base de staging/vacía**, nunca
directo contra producción — el script usa `pg_restore --clean`, que
elimina objetos existentes antes de recrearlos.

Este procedimiento aún no se ha ejecutado contra un dump real en este
entorno (no hay credenciales de backup ni una base de staging disponibles
aquí) — verifícalo una vez tengas el primer backup real antes de confiar
en él para producción.

## Alertas de fallo

El script sale con código distinto de cero si `pg_dump`, `rclone copy` o el
prune fallan. Conéctalo a tu wrapper de alertas (cron `MAILTO`,
healthchecks.io, o el canal de alertas de PR #23) revisando `$?` tras la
ejecución — el wiring de la alerta en sí queda pendiente.
