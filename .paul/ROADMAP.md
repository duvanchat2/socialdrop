# Roadmap: SocialDrop

## Overview

SocialDrop ships incrementally: calendar UX improvements, AI assistant, then a full automation layer (webhooks, flow engine, inbox, sequences) inspired by ZernFlow but using Meta Graph API directly.

## Current Milestone

**v0.3 Automation Layer** (v0.3.0)
Status: In progress
Phases: 0 of 6 complete

## Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 01 | Calendar Improvements | 1 | Deferred | - |
| 02 | AI Assistant | 2 | Deferred | - |
| 03 | Meta Webhooks Backend | 1 | Planning | - |
| 04 | Flow Engine + Prisma Models | 1 | Not started | - |
| 05 | Flow Builder UI | 1 | Not started | - |
| 06 | Inbox | 1 | Not started | - |
| 07 | Sequences | 1 | Not started | - |
| 08 | Navigation Update | 1 | Not started | - |

## Phase Details

### Phase 01: Calendar Improvements

**Goal:** Deliver a polished, platform-aware calendar UX with color coding, overflow pills, hover tooltips, and a week/month toggle persisted in localStorage
**Depends on:** Nothing (standalone frontend work)
**Research:** Unlikely (existing calendar page, UI-only changes)

**Scope:**
- Color code posts by platform (Instagram=pink, TikTok=black, etc.)
- Max 3 posts per day cell with "+N más" overflow pill
- Tooltip on hover showing caption + time + platform
- Week/Month view toggle persisted in localStorage

**Files:**
- `apps/web/src/app/calendar/page.tsx` ONLY

**Plans:**
- [ ] 01-01: Implement calendar color coding, overflow pills, tooltips, and week/month toggle

### Phase 02: AI Assistant

**Goal:** Add an AI assistant powered by Claude API — NestJS backend module, Next.js chat page, and sidebar nav link
**Depends on:** Phase 01 complete
**Research:** Unlikely (known stack: @anthropic-ai/sdk + NestJS + Next.js)

**Scope:**
- Install @anthropic-ai/sdk, add ANTHROPIC_API_KEY to .env
- NestJS assistant module at `apps/api/src/modules/assistant/`
- Next.js chat page at `apps/web/src/app/assistant/page.tsx`
- "Asistente IA" link in AppShell.tsx sidebar

**Plans:**
- [ ] 02-01: Backend assistant module (NestJS + Claude API)
- [ ] 02-02: Frontend chat page + sidebar nav link

### Phase 03: Meta Webhooks Backend

**Goal:** Create NestJS webhooks module that receives and verifies Meta Graph API webhook events (comments, DMs, postbacks) and dispatches to flow engine
**Depends on:** Nothing (standalone backend module)
**Research:** Unlikely (Meta webhook verification is documented pattern)

**Scope:**
- `webhook.controller.ts` — GET (verify) + POST (receive events) at `/api/webhooks/meta`
- `webhook.service.ts` — parse payload, identify event type, emit for flow engine
- `webhook.module.ts` — NestJS module registration
- Register in `app.module.ts`
- Add `META_WEBHOOK_VERIFY_TOKEN` to `.env.example`

**Plans:**
- [ ] 03-01: Meta webhooks controller + service + module

### Phase 04: Flow Engine + Prisma Models

**Goal:** Flow CRUD API + engine that processes Meta events and executes nodes (send DM, reply comment, add tag, delay, condition, AI reply)
**Depends on:** Phase 03 (webhook events feed flow engine)
**Research:** Unlikely (BullMQ delayed jobs already in project)

**Plans:**
- [ ] 04-01: Prisma models (Flow, FlowExecution, Contact) + migrations
- [ ] 04-02: Flows CRUD endpoints + Flow Engine execution logic

### Phase 05: Flow Builder UI

**Goal:** React Flow canvas to visually build automation flows with trigger + action nodes
**Depends on:** Phase 04 (API must exist)
**Research:** Likely (@xyflow/react installation and patterns)

**Plans:**
- [ ] 05-01: Flow list page + Flow builder canvas (React Flow)

### Phase 06: Inbox

**Goal:** Unified inbox showing Instagram/Facebook conversations with manual reply and flow assignment
**Depends on:** Phase 03 (webhooks populate conversations)
**Research:** Unlikely (follows existing page patterns)

**Plans:**
- [ ] 06-01: Inbox backend (GET conversations, POST reply) + frontend page

### Phase 07: Sequences

**Goal:** Drip campaign sequences — ordered DM steps with delays via BullMQ
**Depends on:** Phase 04 (flow engine + contacts)
**Research:** Unlikely (BullMQ delayed jobs already used)

**Plans:**
- [ ] 07-01: Sequences backend + frontend page

### Phase 08: Navigation Update

**Goal:** Add Automation section to AppShell sidebar (Flows, Inbox, Sequences)
**Depends on:** Phase 05, 06, 07 (pages must exist)
**Research:** Unlikely (existing sidebar pattern)

**Plans:**
- [ ] 08-01: AppShell.tsx sidebar automation section

---
*Roadmap created: 2026-03-31*
*Last updated: 2026-04-20*
