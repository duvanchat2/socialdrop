/**
 * One-off backfill: encrypts any plaintext accessToken/refreshToken still
 * stored on Integration/DriveConfig rows (written before TokenVault existed).
 *
 * NOT run automatically — this is application-level crypto, not a Prisma
 * schema migration, so it can't be a `prisma migrate` SQL file. Run it once
 * manually against the target database, with TOKEN_ENCRYPTION_KEY set:
 *
 *   npx tsx libs/prisma/prisma/scripts/encrypt-existing-tokens.ts
 *
 * Idempotent: rows whose tokens already look like our iv:tag:ciphertext
 * format are skipped, so it's safe to re-run.
 */
import { PrismaClient } from '@prisma/client';
import { encryptToken, isEncryptedToken } from '../../src/lib/token-vault.js';

const prisma = new PrismaClient();

async function encryptIntegrations() {
  const rows = await prisma.integration.findMany({
    select: { id: true, accessToken: true, refreshToken: true },
  });

  let updated = 0;
  for (const row of rows) {
    const data: { accessToken?: string; refreshToken?: string } = {};
    if (row.accessToken && !isEncryptedToken(row.accessToken)) {
      data.accessToken = encryptToken(row.accessToken);
    }
    if (row.refreshToken && !isEncryptedToken(row.refreshToken)) {
      data.refreshToken = encryptToken(row.refreshToken);
    }
    if (Object.keys(data).length > 0) {
      await prisma.integration.update({ where: { id: row.id }, data });
      updated++;
    }
  }
  console.log(`Integration: encrypted ${updated}/${rows.length} row(s)`);
}

async function encryptDriveConfigs() {
  const rows = await prisma.driveConfig.findMany({
    select: { id: true, accessToken: true, refreshToken: true },
  });

  let updated = 0;
  for (const row of rows) {
    const data: { accessToken?: string; refreshToken?: string } = {};
    if (row.accessToken && !isEncryptedToken(row.accessToken)) {
      data.accessToken = encryptToken(row.accessToken);
    }
    if (row.refreshToken && !isEncryptedToken(row.refreshToken)) {
      data.refreshToken = encryptToken(row.refreshToken);
    }
    if (Object.keys(data).length > 0) {
      await prisma.driveConfig.update({ where: { id: row.id }, data });
      updated++;
    }
  }
  console.log(`DriveConfig: encrypted ${updated}/${rows.length} row(s)`);
}

async function main() {
  if (!process.env.TOKEN_ENCRYPTION_KEY) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be set before running this script');
  }
  await encryptIntegrations();
  await encryptDriveConfigs();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
