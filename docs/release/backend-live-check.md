# Backend Live Check

Date: 2026-07-02

## Commands
| Command | Result | Notes |
| --- | --- | --- |
| `npx prisma generate` | PASS | Prisma Client generated. |
| `npx prisma migrate deploy` | FAIL | Neon host returned P1001 unreachable even after approval; 33 migrations detected. |
| `npm run db:seed` | PASS | Seed completed after approval; demo user/org created or retained. |
| `npm run dev` | PASS | Next.js dev server started at `http://localhost:3000`. |

## Endpoint Checks
| Endpoint | Result | Notes |
| --- | --- | --- |
| `/` | PASS | HTTP 200. |
| `/signin` | PASS | HTTP 200. |
| `/api/health` | PASS | HTTP 200, database reachable. |
| `/api/ready` | PASS | HTTP 200, database ready. |
| `/admin/extension-enrollments` | PASS_AUTH_REDIRECT | HTTP 307 unauthenticated redirect. |
| `/api/extension/*` probes | PASS_AUTH_REDIRECT | Unauthenticated synthetic probes redirected. Full enrolled-device flow needs valid token/session. |

## Status
PARTIAL. Runtime served locally and DB readiness passed, but `prisma migrate deploy` must be rerun successfully before production release.
