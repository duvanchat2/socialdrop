# SocialDrop

## What This Is

SocialDrop is a social media scheduling and management platform built as an NX monorepo. It provides a NestJS backend API (port 3333) and a Next.js web frontend (port 3000), connected to PostgreSQL via Prisma. The platform allows users to schedule, queue, and publish content across social media platforms with an AI assistant for content creation.

## Core Value

Content creators and brands can schedule and publish social media posts across platforms from a single dashboard, with AI-assisted content generation.

## Current State

| Attribute | Value |
|-----------|-------|
| Type | Application |
| Version | 0.1.0 |
| Status | Active Development |
| Last Updated | 2026-03-31 |

**Production URLs:**
- https://solokids.shop — Production app (VPS: /opt/socialdrop)

## Requirements

### Core Features

- Schedule and publish posts across social platforms (Instagram, TikTok, etc.)
- Calendar view with color-coded posts by platform
- AI assistant for content/caption generation
- Queue management with BullMQ + Redis
- User authentication and dashboard

### Validated (Shipped)

- [x] NX monorepo scaffold (NestJS API + Next.js web)
- [x] Prisma schema and PostgreSQL integration
- [x] BullMQ + Redis queue setup
- [x] TikTok token integration (fixed)
- [x] Basic calendar page
- [x] Scheduler with Colombia timezone
- [x] Edit modal

### Active (In Progress)

- [ ] Calendar improvements (color coding, +N pills, tooltips, week/month toggle)
- [ ] AI Assistant module (backend + frontend)

### Planned (Next)

- [ ] Phase 01: Calendar improvements
- [ ] Phase 02: AI Assistant (backend module + frontend chat + sidebar link)

### Out of Scope

- Modifying docker-compose.yml
- Modifying nginx config files
- Touching other VPS apps: n8n, chatwoot, openclaw
- Removing existing .env vars

## Target Users

**Primary:** Content creators, social media managers, small brands
- Need to post consistently across multiple platforms
- Want to plan content in advance
- Benefit from AI-assisted caption writing

## Context

**Business Context:**
Deployed at solokids.shop on a shared Ubuntu VPS managed with PM2 and nginx. Other apps (n8n, chatwoot, openclaw) share the same VPS and must not be affected.

**Technical Context:**
NX monorepo with two apps: `api` (NestJS, port 3333) and `web` (Next.js, port 3000). Database schema lives at `libs/prisma/prisma/schema.prisma`, Prisma client generated in `libs/prisma/src/`. Queue system uses BullMQ + Redis.

## Constraints

### Technical Constraints

- NX build required after every change: `npx nx build api --skip-nx-cache` / `npx nx build web --skip-nx-cache`
- New NestJS modules must be registered in AppModule before testing
- DTOs must use class-validator
- All Swagger endpoints need @ApiTags and @ApiOperation
- suppressHydrationWarning required on Next.js body tag
- Browser-only components need dynamic imports with ssr:false
- Client-side env vars require NEXT_PUBLIC_ prefix
- Prisma schema changes require `prisma migrate dev`

### Business Constraints

- Never modify: docker-compose.yml, nginx configs, other VPS apps
- Production .env: APP_URL=https://solokids.shop
- Only ADD new env vars, never remove existing ones
- VPS SSH: root@solokids.shop, app at /opt/socialdrop

## Key Decisions

| Decision | Rationale | Date | Status |
|----------|-----------|------|--------|
| NX monorepo | Shared libs (Prisma), independent app builds | — | Active |
| BullMQ + Redis for queues | Reliable scheduled post delivery | — | Active |
| Prisma + PostgreSQL | Type-safe DB access, shared client lib | — | Active |
| @anthropic-ai/sdk for AI | Claude API for assistant feature | 2026-03-31 | Active |

## Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Zero TS errors on build | 0 errors | TBD | In progress |
| Calendar UX improvement | Color + tooltip + week view | Not started | Planned |
| AI assistant functional | Chat with Claude API | Not started | Planned |

## Tech Stack / Tools

| Layer | Technology | Notes |
|-------|------------|-------|
| Monorepo | NX | Shared libs, per-app builds |
| Backend | NestJS | Port 3333 |
| Frontend | Next.js | Port 3000 |
| Database | PostgreSQL + Prisma | Schema: libs/prisma/prisma/schema.prisma |
| Queue | BullMQ + Redis | Scheduled post delivery |
| AI | @anthropic-ai/sdk | Claude API |
| Hosting | Ubuntu VPS | solokids.shop, PM2 + nginx |
| Repo | GitHub | github.com/duvanchat2/socialdrop |

## Links

| Resource | URL |
|----------|-----|
| Repository | github.com/duvanchat2/socialdrop |
| Production | https://solokids.shop |

---
*PROJECT.md — Updated when requirements or context change*
*Last updated: 2026-03-31*
