import pg from 'pg';
import { readFileSync } from 'fs';

const client = new pg.Client({
  connectionString: 'postgresql://postgres:postgres@localhost:54329/socialdrop_test',
});

const arg = process.argv[2];
const sql = arg.endsWith('.sql') ? readFileSync(arg, 'utf-8') : arg;

async function main() {
  await client.connect();
  try {
    const res = await client.query(sql);
    if (Array.isArray(res)) {
      for (const r of res) if (r.rows) console.log(JSON.stringify(r.rows, null, 2));
    } else if (res.rows) {
      console.log(JSON.stringify(res.rows, null, 2));
    } else {
      console.log('OK, rowCount:', res.rowCount);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
