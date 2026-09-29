# QUAY Mentor Matching Platform

https://quay-mentor-matching.vercel.app/

Next.js 15 + Prisma (SQLite) MVP for managing QUAY's mentor network, matching mentors to curriculum sessions and startup requests, and tracking engagement and data health.

## Quick start
```bash
pnpm install
cp .env.example .env
pnpm db:push && pnpm db:seed
pnpm dev            # http://localhost:3000
pnpm test           # unit + integration (uses prisma/test.db)
```

## Features
| Area | Where |
|---|---|
| Mentor CRUD, search, verify, deactivate | `/mentors`, `src/lib/services/mentors.ts` |
| Session auto-suggestions (skips double-booked mentors) | `/sessions`, `src/lib/services/sessions.ts` |
| Startup recommendations + intro requests | `/startups`, `/requests`, `src/lib/services/requests.ts` |
| Matching engine: expertise (alias-aware), engagement, responsiveness, freshness, load | `src/lib/matching.ts` |
| Job-change / staleness flags | `/flags`, `POST /api/webhooks/job-change`, `/api/flags/scan` |
| Slack intake (`/add-mentor`) | `POST /api/slack/intake`, `src/lib/slack.ts` |
| Dashboard metrics | `/`, `GET /api/analytics` |

## Integrations
- **Slack**: create a Slack app with a slash command `/add-mentor` → `https://<host>/api/slack/intake`, and set `SLACK_SIGNING_SECRET`. Formats: `Name | email | Title @ Company | tags | linkedin-url` or `name: …; email: …; company: …`. Existing mentors (matched by email) are updated, and role changes are logged.
- **Job changes**: LinkedIn isn't scraped. Point an enrichment provider or a Zapier/Clay flow at `POST /api/webhooks/job-change` with header `x-webhook-secret: $JOB_CHANGE_WEBHOOK_SECRET` and body `{ email, title, company }`. Changes are queued for admin approval.
- **Stale scan**: run `GET /api/flags/scan` daily (e.g. with Vercel Cron). The window is `STALE_AFTER_DAYS`, 180 by default.
- **Access**: set `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` to protect the app. There are no per-user roles yet.

## Deploying
SQLite is fine locally. For Vercel, switch `provider` in `prisma/schema.prisma` to `postgresql` and set `DATABASE_URL`, then run `pnpm db:push`.
