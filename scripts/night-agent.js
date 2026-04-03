#!/usr/bin/env node
'use strict';

const { OpenAI } = require('openai');
const fs = require('fs');
const { execSync } = require('child_process');

const client = new OpenAI({
  apiKey: process.env.ZAI_API_KEY,
  baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
});
const tasks = (process.env.TASKS || 'debug,docs,summary,tests,issues').split(',').map(t => t.trim());
const REPO = 'duvanchat2/socialdrop';
const GH_TOKEN = process.env.GITHUB_TOKEN || '';
const results = {};

function exec(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', ...opts });
  } catch (e) {
    return e.stdout || e.stderr || String(e.message);
  }
}

function ghGet(path) {
  return exec(
    `curl -sf -H "Authorization: token ${GH_TOKEN}" "https://api.github.com${path}"`,
  );
}

function ghPost(path, data) {
  const body = JSON.stringify(data).replace(/'/g, `'\\''`);
  return exec(
    `curl -sf -X POST -H "Authorization: token ${GH_TOKEN}" -H "Content-Type: application/json" ` +
    `"https://api.github.com${path}" -d '${body}'`,
  );
}

async function ask(prompt, maxTokens = 2000) {
  const res = await client.chat.completions.create({
    model: 'glm-4-plus',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  return res.choices[0].message.content ?? '';
}

// ── TASK 1: Debug analysis ────────────────────────────────────────────────────
async function runDebug() {
  console.log('[debug] Running debug analysis...');

  const gitLog  = exec('git log --oneline -20');
  const tsErrors = exec('npx tsc --noEmit 2>&1 | head -60');
  const issues  = ghGet(`/repos/${REPO}/issues?state=open&per_page=20`);

  const text = await ask(
    `Analyze this SocialDrop (NestJS API + Next.js web + Prisma + BullMQ) project status.

Recent commits:
${gitLog}

TypeScript errors:
${tsErrors || 'None found'}

Open GitHub issues:
${issues}

1. List new bugs found in recent code changes
2. Suggest fixes for TypeScript errors if any
3. Identify which open issues may relate to recent commits
4. Format as JSON: { "bugs": [], "fixes": [], "relatedIssues": [] }`,
  );

  results.debug = text;
  console.log('[debug] Done');
}

// ── TASK 2: Update CLAUDE.md ──────────────────────────────────────────────────
async function runDocs() {
  console.log('[docs] Updating CLAUDE.md...');

  const currentClaude = fs.existsSync('CLAUDE.md') ? fs.readFileSync('CLAUDE.md', 'utf8') : '';
  const gitLog        = exec('git log --oneline -10');
  const packageJson   = fs.readFileSync('package.json', 'utf8');

  const text = await ask(
    `Update the CLAUDE.md file for SocialDrop (NestJS API port 3333, Next.js web port 3000, Prisma + PostgreSQL, BullMQ + Redis, deployed at solokids.shop).

Current CLAUDE.md:
${currentClaude}

Recent commits (last 10):
${gitLog}

package.json:
${packageJson}

Generate an updated CLAUDE.md with sections:
- What works ✅
- What's pending ⏳
- Known bugs 🐛
- How to start the project locally
- Recent changes
- Next priorities

Return ONLY the markdown content, no explanation.`,
    3000,
  );

  fs.writeFileSync('CLAUDE.md', text);
  results.docs = 'CLAUDE.md updated';
  console.log('[docs] Done');
}

// ── TASK 3: Daily summary ─────────────────────────────────────────────────────
async function runSummary() {
  console.log('[summary] Generating daily summary...');

  const gitLog  = exec('git log --oneline --since="24 hours ago"');
  const gitStats = exec('git diff --stat HEAD~5 HEAD 2>/dev/null || echo "No stats"');

  const text = await ask(
    `Generate a brief daily summary for SocialDrop project in Spanish (under 200 words).

Commits in last 24h:
${gitLog || 'No commits today'}

Recent file changes:
${gitStats}

Include:
1. Lo que se logró hoy
2. Lo que sigue pendiente
3. Tarea recomendada para mañana`,
    800,
  );

  results.summary = text;

  const date = new Date().toISOString().split('T')[0];
  fs.mkdirSync('docs/summaries', { recursive: true });
  fs.writeFileSync(`docs/summaries/${date}.md`, `# Resumen ${date}\n\n${text}\n`);
  console.log('[summary] Done →', `docs/summaries/${date}.md`);
}

// ── TASK 4: Run tests ─────────────────────────────────────────────────────────
async function runTests() {
  console.log('[tests] Running test suite...');

  const unitResults = exec('npx nx test api --passWithNoTests 2>&1 | tail -30');
  const apiResults  = exec('API_URL=https://solokids.shop timeout 120 bash scripts/test-api.sh 2>&1 || true');

  results.tests = { unit: unitResults, api: apiResults };

  const failed = unitResults.includes('FAIL') || apiResults.includes('✗');
  if (failed) {
    console.log('[tests] Failures detected — opening GitHub issue');
    const issueBody =
      `## Test failures detected by night agent\n\n` +
      `**Unit tests:**\n\`\`\`\n${unitResults.slice(0, 2000)}\n\`\`\`\n\n` +
      `**API tests:**\n\`\`\`\n${apiResults.slice(0, 2000)}\n\`\`\``;
    ghPost(`/repos/${REPO}/issues`, {
      title: `Test failures — ${new Date().toISOString().split('T')[0]}`,
      body: issueBody,
      labels: ['bug', 'priority-high'],
    });
    console.log('[tests] GitHub issue created');
  }

  console.log('[tests] Done');
}

// ── TASK 5: Analyze GitHub issues ────────────────────────────────────────────
async function runIssues() {
  console.log('[issues] Analyzing GitHub issues...');

  const openIssues = ghGet(`/repos/${REPO}/issues?state=open&per_page=20`);
  const gitLog     = exec('git log --oneline -20');

  const text = await ask(
    `Analyze open GitHub issues and recent commits for SocialDrop.

Open issues: ${openIssues}
Recent commits: ${gitLog}

Which issues were likely resolved by recent commits?
Return JSON: { "resolved": [issueNumber], "stillOpen": [issueNumber], "newSuggested": [{"title": "", "body": "", "labels": []}] }`,
  );

  results.issues = text;
  console.log('[issues] Done');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('════════════════════════════════');
  console.log('SOCIALDROP NIGHT AGENT');
  console.log(`Tasks: ${tasks.join(', ')}`);
  console.log('════════════════════════════════\n');

  if (tasks.includes('debug'))   await runDebug();
  if (tasks.includes('docs'))    await runDocs();
  if (tasks.includes('summary')) await runSummary();
  if (tasks.includes('tests'))   await runTests();
  if (tasks.includes('issues'))  await runIssues();

  console.log('\n════════════════════════════════');
  console.log('NIGHT AGENT REPORT');
  console.log('════════════════════════════════');
  for (const [key, val] of Object.entries(results)) {
    console.log(`\n[${key.toUpperCase()}]`);
    console.log(typeof val === 'string' ? val : JSON.stringify(val, null, 2));
  }

  const date = new Date().toISOString().split('T')[0];
  fs.mkdirSync('docs/reports', { recursive: true });
  fs.writeFileSync(
    `docs/reports/${date}.json`,
    JSON.stringify({ date, tasks, results }, null, 2),
  );

  console.log(`\nAgent complete. Report → docs/reports/${date}.json`);
}

main().catch(err => {
  console.error('Night agent failed:', err);
  process.exit(1);
});
