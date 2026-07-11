// Local, disposable Postgres for verifying Prisma migrations before touching
// any real database. Requires: npm install --no-save embedded-postgres
// Usage: node scripts/pg-test-runner.mjs (leave running), then in another
// shell: DATABASE_URL="postgresql://postgres:postgres@localhost:54329/socialdrop_test" npx prisma migrate deploy --schema=libs/prisma/prisma/schema.prisma
import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';

const dataDir = path.resolve('C:/Users/duvan/pgtest-data');

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'postgres',
  port: 54329,
  persistent: false,
});

async function main() {
  console.log('Initializing...');
  await pg.initialise();
  console.log('Starting...');
  await pg.start();
  console.log('Creating database socialdrop_test...');
  await pg.createDatabase('socialdrop_test');
  console.log('READY');
  setInterval(() => {}, 60_000); // keep process alive
}

main().catch((err) => {
  console.error('FAILED', err);
  process.exit(1);
});

process.on('SIGINT', async () => {
  await pg.stop();
  process.exit(0);
});
