# Roadmap: SocialDrop

## Overview

SocialDrop ships in two immediate phases: first improving the calendar UX with color coding, tooltips, and week view; then adding an AI assistant powered by Claude for content creation, accessible from both the API and the web frontend.

## Current Milestone

**v0.2 Calendar + AI Assistant** (v0.2.0)
Status: Not started
Phases: 0 of 2 complete

## Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 01 | Calendar Improvements | 1 | Not started | - |
| 02 | AI Assistant | 1 | Not started | - |

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

---
*Roadmap created: 2026-03-31*
*Last updated: 2026-03-31*
