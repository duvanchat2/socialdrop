<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# SocialDrop

## QUÉ ES
Scheduler de publicación masiva en redes sociales.
Stack: NX monorepo, NestJS (3333), Next.js 14 (3000),
PostgreSQL + Prisma, BullMQ + Redis.
Repo: github.com/duvanchat2/socialdrop
Deploy: https://app.socialdrop.online
VPS: root@62.84.186.32 — /opt/socialdrop (pm2 via /root/.nvm/versions/node/v22.22.1/bin/pm2)

## QUÉ HACER
- Una rama por feature: feat/nombre
- Build: npx nx build api --skip-nx-cache + npx nx build web --skip-nx-cache
- Cero errores TypeScript antes de push
- PAUL: /paul:plan → /paul:apply → /paul:unify
- Tras migrar Prisma: `npx prisma generate --schema=libs/prisma/prisma/schema.prisma` ANTES de `nx build api`

## QUÉ NO HACER
- NUNCA importar enums desde @prisma/client
- NUNCA tocar docker-compose.yml ni nginx
- NUNCA mergear a main sin build limpio
- NUNCA tocar en VPS: n8n, chatwoot, openclaw
- NUNCA poner `/api` sufijo en NEXT_PUBLIC_API_URL (apiFetch ya concatena el path `/api/...`)

## DOCS
@docs/deploy.md
@docs/api-patterns.md

## ESTADO ACTUAL (19 abril 2026)

### ✅ Funcionando en producción
- Facebook — publicando
- Instagram — publicando
- Dashboard con métricas
- Calendario con drag & drop
- Nuevo Post rediseñado
- Sistema de Cola (/queue)

### ⏳ Pendiente aprobación
- TikTok — esperando aprobación en TikTok Developer Portal

### 🔲 Por implementar
- YouTube — provider implementado, sin probar
- Twitter/X — sin credenciales
- LinkedIn — solo stub
- AI Assistant (Anthropic API)

### 🔲 Features planificadas
- Mejoras calendario: tooltip, week view
- AI Assistant con tool use
- Repurposing: TikTok → Instagram Reels → YouTube Shorts
