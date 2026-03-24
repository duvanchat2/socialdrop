/**
 * SocialDrop — Connection Test Script
 * Run with: npx ts-node --esm scripts/test-connections.ts
 * Or:       node --loader ts-node/esm scripts/test-connections.ts
 */
import { config } from 'dotenv';
import { Client } from 'pg';
import { createClient } from 'redis';
import Queue from 'bullmq';

config(); // Load .env

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function ok(msg: string) { console.log(`  ${GREEN}✓${RESET} ${msg}`); }
function fail(msg: string, err?: unknown) {
  console.log(`  ${RED}✗${RESET} ${msg}`);
  if (err) console.log(`    ${RED}${(err as Error).message}${RESET}`);
}
function section(title: string) { console.log(`\n${YELLOW}▸ ${title}${RESET}`); }

async function testPostgres() {
  section('PostgreSQL');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query('SELECT version()');
    ok(`Connected — ${result.rows[0].version.split(' ').slice(0, 2).join(' ')}`);
    await client.end();
  } catch (err) {
    fail('Cannot connect to PostgreSQL', err);
    fail('Check DATABASE_URL in your .env');
  }
}

async function testRedis() {
  section('Redis');
  const client = createClient({
    socket: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    },
  });
  try {
    await client.connect();
    await client.ping();
    ok('Connected and responding to PING');
    await client.disconnect();
  } catch (err) {
    fail('Cannot connect to Redis', err);
    fail('Check REDIS_HOST and REDIS_PORT in your .env');
  }
}

async function testBullMQ() {
  section('BullMQ');
  const connection = {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  };
  const testQueue = new (Queue as any).Queue('test-connections', { connection });
  try {
    const job = await testQueue.add('ping', { test: true });
    ok(`Job enqueued — id: ${job.id}`);
    await testQueue.close();
    ok('Queue closed cleanly');
  } catch (err) {
    fail('BullMQ queue test failed', err);
  }
}

async function testGoogleDrive() {
  section('Google Drive API');
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret || clientId.includes('PLACEHOLDER')) {
    console.log(`  ${YELLOW}⚠${RESET} GOOGLE_CLIENT_ID/SECRET not configured (skipping)`);
    return;
  }

  try {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/api/drive/callback',
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      response_type: 'code',
      access_type: 'offline',
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    ok(`OAuth URL generated successfully`);
    console.log(`    ${YELLOW}→ To test full flow, visit:${RESET}`);
    console.log(`    ${authUrl.slice(0, 80)}...`);
  } catch (err) {
    fail('Google Drive config error', err);
  }
}

function checkPlaceholders() {
  section('Environment Variables');
  const vars = [
    'DATABASE_URL', 'REDIS_HOST', 'JWT_SECRET',
    'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
    'FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET',
    'INSTAGRAM_APP_ID', 'TIKTOK_CLIENT_KEY',
    'YOUTUBE_CLIENT_ID', 'X_API_KEY',
  ];

  const configured: string[] = [];
  const placeholders: string[] = [];

  for (const v of vars) {
    const val = process.env[v];
    if (!val || val.includes('PLACEHOLDER') || val === '') {
      placeholders.push(v);
    } else {
      configured.push(v);
    }
  }

  if (configured.length) ok(`Configured (${configured.length}): ${configured.join(', ')}`);
  if (placeholders.length) {
    fail(`Need credentials (${placeholders.length}): ${placeholders.join(', ')}`);
  }
}

async function main() {
  console.log('\n🔍 SocialDrop — Connection Tests\n' + '─'.repeat(40));

  checkPlaceholders();
  await testPostgres();
  await testRedis();
  await testBullMQ();
  await testGoogleDrive();

  console.log('\n' + '─'.repeat(40));
  console.log('Done. Fix any ✗ items above before starting the app.\n');
  process.exit(0);
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
