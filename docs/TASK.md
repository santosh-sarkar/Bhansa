# TASK.md — Task Breakdown

The agent works on **one task at a time**, in order, and stops after each task to ask the user whether to continue.

---

## 1. Workflow for every task (mandatory)

```
1. IMPLEMENT   write the feature (small, modular, CODING_STANDARDS.md)
2. UPDATE      set status in this file + update affected docs (DATABASE.md, API.md, DECISIONS.md)
3. WRITE TESTS cover happy path, validation, permissions, tenant isolation (TESTING.md)
4. SWAGGER     update OpenAPI (generated from Zod) for new or changed endpoints
5. RUN TESTS   run the real script, report real output
6. ASK USER    "Proceed to <next task>?"  → wait for the answer
```

Frontend tasks: step 4 means "update API client types if the API changed, otherwise write N/A".
Docs-only or setup tasks: skip steps that do not apply and say so in the report.

### Task template (copy when expanding a task)

```
### <ID> <title>
Goal:
Depends on:
Files (planned):
Pending decisions needed: (ask before starting)
Acceptance:
- [ ] 
Checklist: [ ] implement  [ ] update  [ ] tests  [ ] swagger  [ ] run tests  [ ] user approved next
```

### Status legend

⬜ todo · 🟡 in progress · ⛔ blocked (waiting for user decision) · ✅ done

**Current task:** `R-012` (Request bill, table status updates).

### Before starting a task, the agent must

1. Read the task and the docs it touches.
2. Check `DECISIONS.md` for **PENDING** items in the "Needed by" column. If any apply, ask the user first.
3. State its plan in a few lines and flag anything unclear. Do not guess.

---

## 2. Phase 0 — Foundation

| ID | Task | Depends | Needs decision | Status |
|---|---|---|---|---|
| T-001 | User reviews and approves all docs; answers PD items needed for setup | — | PD-001 | ✅ |
| T-002 | Repo skeleton: root files, `.gitignore`, `docker-compose.yml` (Postgres, Redis, test Postgres), root `.env.example` for Docker plus a `.env.example` per app, README with per-folder commands. Independent `package.json` per app, no root package | T-001 | | ✅ |
| T-003 | Backend scaffold: TypeScript strict, Express `app.ts` and `server.ts`, ESLint, Prettier, scripts, folder layout, path aliases | T-002 | PD-001 | ✅ |
| T-004 | Env config validated with Zod (`config/env.ts`), `config/brand.ts`, `config/constants.ts` | T-003 | | ✅ |
| T-005 | Prisma setup, `lib/prisma.ts`, `GET /health` (API + DB) | T-004 | | ✅ |
| T-006 | Base migration from `restaurant_saas_schema.sql` plus migration 002 additions (`DATABASE.md`), Prisma schema sync | T-005 | PD-017 | ✅ |
| T-007 | Seed script: roles, permissions, role-permissions, plans | T-006 | | ✅ |
| T-008 | `AppError`, error codes, response helper, global error handler, 404 handler | T-003 | | ✅ |
| T-009 | Zod `validate` middleware (params, query, body) | T-008 | | ✅ |
| T-010 | Test setup: Vitest, Supertest, test DB, factories, auth helpers, `npm test` scripts | T-006 | PD-016 | ✅ |
| T-011 | Logger and request-id middleware | T-003 | PD-003 | ✅ |
| T-012 | Redis client (`lib/redis.ts`), rate-limit middleware, `/health` checks Redis | T-005 | | ✅ |
| T-013 | Swagger setup: OpenAPI registry from Zod, `/api/docs`, `/api/docs.json`, test that routes are documented | T-009 | | ✅ |
| T-014 | Security middleware: helmet, CORS allowlist, cookie parser, body limits | T-004 | PD-004 | ✅ |
| T-015 | CI workflow: install, lint, type-check, test | T-010 | | ✅ |

---

## 3. Phase 1 — Auth and tenancy (backend)

| ID | Task | Depends | Needs decision | Status |
|---|---|---|---|---|
| A-001 | Register: create organization, default outlet "Main Branch", owner, trial subscription, in one transaction | T-007, T-009 | | ✅ |
| A-002 | Email service on Resend plus `send-email` BullMQ job and verification template | T-012 | | ✅ |
| A-003 | Verify email and resend verification | A-001, A-002 | | ✅ |
| A-004 | Password hashing util and login (sets access and refresh cookies); blocks unverified email | A-003 | PD-002, PD-004 | ✅ |
| A-005 | Auth middleware (verify access token) and `GET /auth/me` (user, assignments, permissions) | A-004 | | ✅ |
| A-006 | Refresh-token rotation with token family and reuse detection | A-004 | | ✅ |
| A-007 | Logout, logout-all, revocation helpers | A-006 | | ✅ |
| A-008 | Forgot and reset password (revokes refresh tokens) | A-002, A-007 | | ✅ |
| A-009 | Permission middleware: `can(user, outlet, permission)` | A-005 | PD-005 | ✅ |
| A-010 | Outlet-context middleware (`X-Outlet-Id` verified against assignment) | A-005 | | ✅ |
| A-011 | Tenant-isolation test helper reused by later modules | A-010 | | ✅ |
| A-012 | Staff invitations: create, list, revoke, email | A-009, A-010 | | ✅ |
| A-013 | Accept invitation (create or attach account, assign role and outlet) | A-012 | | ✅ |
| A-014 | Staff list, change role, deactivate (Manager cannot touch Owners) | A-013 | | ✅ |
| A-015 | Staff outlet assignments: Manager may have many; Waiter and Kitchen exactly one | A-014 | | ✅ |
| A-016 | Audit-log helper (`audit_logs`) used by sensitive actions | A-005 | | ✅ |

---

## 4. Phase 2 — Plans and subscription (backend)

| ID | Task | Depends | Status |
|---|---|---|---|
| S-001 | `getLimits(organization)`: plan values merged with subscription overrides | A-001 | ✅ |
| S-002 | Subscription guard middleware: trialing/active normal, grace read-only, suspended blocked | S-001 | ✅ |
| S-003 | `GET /subscription` with usage versus limits | S-001 | ✅ |
| S-004 | Trial-expiry job (trialing → grace → suspended) and reminder emails | S-002, A-002 | ✅ |
| S-005 | Custom-plan request endpoint (creates lead) | A-005 | ✅ |
| S-006 | Plan-limit check helper used by outlets, staff and menu creation | S-001 | ✅ |

---

## 5. Phase 3 — Outlets, tables, QR (backend)

| ID | Task | Depends | Needs decision | Status |
|---|---|---|---|---|
| O-001 | List and get outlets the user can access | A-010 | | ✅ |
| O-002 | Update outlet profile and settings (address, phone, timezone, VAT, service charge) | O-001 | | ✅ |
| O-003 | Create outlet (Owner, plan-gated by `max_outlets`) | S-006, O-001 | | ✅ |
| O-004 | Deactivate outlet (blocks new orders, keeps history) | O-003 | | ✅ |
| O-005 | Save last active outlet (`PATCH /me/active-outlet`, Owner and Manager only) | A-010 | | ✅ |
| TB-001 | Table CRUD per outlet | A-010 | | ✅ |
| TB-002 | QR token generation and regeneration | TB-001 | | ✅ |
| TB-003 | QR image endpoint | TB-002 | PD-006 | ✅ |

---

## 6. Phase 4 — Menu (backend)

| ID | Task | Depends | Needs decision | Status |
|---|---|---|---|---|
| M-001 | Category CRUD (org level) | A-009 | | ✅ |
| M-002 | Menu item CRUD (org level, soft delete) with plan limit check | M-001, S-006 | | ✅ |
| M-003 | Variants and add-ons (`menu_item_options`) | M-002 | | ✅ |
| M-004 | Image upload to Cloudinary (type and size limits) | M-002 | | ✅ |
| M-005 | Per-outlet override (price, availability) | M-002, A-010 | PD-018 | ✅ |
| M-006 | Manual availability toggle (Manager, Owner, Kitchen) | M-005 | | ✅ |
| M-007 | Effective menu query for an outlet (item + override + `auto_unavailable`) | M-005 | | ✅ |

---

## 7. Phase 5 — Ordering and real-time (backend)

| ID | Task | Depends | Needs decision | Status |
|---|---|---|---|---|
| R-001 | Socket.IO server, handshake auth, room joining after assignment check | A-010 | | ✅ |
| R-002 | Public: resolve QR token → outlet, table, effective menu | TB-002, M-007 | | ✅ |
| R-003 | Public: start or join table session, guest cookie | R-002 | | ✅ |
| R-004 | Public: place order → `pending_confirmation`; server-side pricing; snapshots; order number | R-003 | PD-019, PD-020 | ✅ |
| R-005 | Public: rate limits per IP, QR token and session; cart size limits | R-004, T-012 | | ✅ |
| R-006 | Order transitions module (allowed transitions in one place) | R-004 | | ✅ |
| R-007 | Waiter: list pending orders, confirm, reject (with reason) | R-006, R-001 | | ✅ |
| R-008 | Waiter or Manager places an order for a table (auto-confirmed) | R-006 | | ✅ |
| R-009 | Kitchen board query and item/order status updates | R-006 | PD-009, PD-010 | ✅ |
| R-010 | Order cancellation with reason and permission rules | R-006 | PD-008 | ✅ |
| R-011 | Guest order status and add more orders to the same session | R-004 | | ✅ |
| R-012 | Request bill, table status updates (free, occupied, needs bill) | R-011 | | ✅ |
| R-013 | Emit socket events for all order and session transitions (after commit) | R-007, R-009, R-012 | | ✅ |

---

## 8. Phase 6 — Inventory (backend)

| ID | Task | Depends | Status |
|---|---|---|---|
| I-001 | Ingredient CRUD (org level) | A-009 | ✅ |
| I-002 | Recipes: set menu item ingredients and quantities | I-001, M-002 | ✅ |
| I-003 | Outlet stock list and low thresholds | I-001, A-010 | ✅ |
| I-004 | Restock (Owner, Manager) with movement record | I-003 | ⬜ |
| I-005 | Stock adjustment and wastage (Owner, Manager, Kitchen) | I-003 | ⬜ |
| I-006 | Stock movement history endpoint | I-004 | ⬜ |
| I-007 | Auto deduction on order confirm: transaction, row locks, movements | R-007, I-002 | ⬜ |
| I-008 | Auto restore on cancellation | I-007, R-010 | ⬜ |
| I-009 | Auto-unavailable propagation and recovery on restock | I-007 | ⬜ |
| I-010 | Low-stock alert job: notification, socket, email, de-duplicated | I-007, A-002 | ⬜ |
| I-011 | Concurrency test: two orders race for the last ingredient | I-007 | ⬜ |

---

## 9. Phase 7 — Billing and payments (backend)

| ID | Task | Depends | Needs decision | Status |
|---|---|---|---|---|
| PAY-001 | Generate bill for a session (subtotal, VAT, service charge, discount with permission and audit) | R-012 | | ⬜ |
| PAY-002 | Cash payment, close session, free table, complete orders | PAY-001 | | ⬜ |
| PAY-003 | eSewa settings per outlet: product code and encrypted secret, test mode flag | A-010 | PD-011, PD-012 | ⬜ |
| PAY-004 | eSewa initiate: pending payment, `transaction_uuid`, HMAC-SHA256 signed form fields (re-check official docs first) | PAY-003, PAY-001 | | ⬜ |
| PAY-005 | eSewa verify: signature check, field match, status check API, idempotent success | PAY-004 | | ⬜ |
| PAY-006 | eSewa reconcile job for pending payments | PAY-005, T-012 | | ⬜ |
| PAY-007 | Printable invoice | PAY-002 | PD-007 | ⬜ |
| PAY-008 | Subscription payment reference (Owner) and Super Admin approval extending the period | S-003 | PD-013 | ⬜ |

---

## 10. Phase 8 — Notifications and analytics (backend)

| ID | Task | Depends | Status |
|---|---|---|---|
| N-001 | Notification model, list, mark read, read-all | A-010 | ⬜ |
| N-002 | Create notifications for key events (pending order, bill request, low stock, item unavailable) | N-001, R-013 | ⬜ |
| AN-001 | Summary: revenue, orders, average order value | PAY-002 | ⬜ |
| AN-002 | Revenue by day | AN-001 | ⬜ |
| AN-003 | Top items | AN-001 | ⬜ |
| AN-004 | Peak hours (outlet timezone) | AN-001 | ⬜ |
| AN-005 | Inventory report (stock, wastage, usage) | I-006 | ⬜ |
| AN-006 | Consolidated Owner analytics across outlets | AN-001, O-003 | ⬜ |

---

## 11. Phase 9 — Super Admin (backend)

| ID | Task | Depends | Status |
|---|---|---|---|
| SA-001 | Super Admin seed and guard middleware | T-007, A-005 | ⬜ |
| SA-002 | Organization list, filter, suspend and reactivate | SA-001 | ⬜ |
| SA-003 | Plan CRUD | SA-001 | ⬜ |
| SA-004 | Subscription overrides, extend trial, change plan | SA-003, S-001 | ⬜ |
| SA-005 | Leads list and mark handled | S-005, SA-001 | ⬜ |
| SA-006 | Platform stats | SA-001 | ⬜ |

---

## 12. Frontend tasks

Each runs after the backend tasks it needs. Structure and rules: `CODING_STANDARDS.md` section 3.

| ID | Task | Depends | Needs decision | Status |
|---|---|---|---|---|
| F-001 | Next.js scaffold (App Router, TS strict, Tailwind, shadcn/ui), folder layout, `config/brand.ts`, lint, test setup | T-001 | | ⬜ |
| F-002 | API client (credentials, `X-Outlet-Id`, error mapping), TanStack Query provider | F-001, T-008 | | ⬜ |
| F-003 | Auth store (Zustand), `middleware.ts` route protection, session bootstrap via `/auth/me` | F-002, A-005 | | ⬜ |
| F-004 | Public landing and pricing pages (SSR, SEO metadata) | F-001 | | ⬜ |
| F-005 | Register, login, verify email, forgot/reset password pages | F-003, A-008 | PD-014 | ⬜ |
| F-006 | Dashboard layout: permission-based sidebar, header, notification bell placeholder | F-003, A-009 | | ⬜ |
| F-007 | Staff pages: list, invite, role change, deactivate | F-006, A-015 | | ⬜ |
| F-008 | Outlet settings page and tables page with QR view and print | F-006, TB-003, O-002 | | ⬜ |
| F-009 | Menu management: categories, items, options, image upload | F-006, M-004 | | ⬜ |
| F-010 | Guest QR menu page (SSR, mobile first) | F-001, R-002 | | ⬜ |
| F-011 | Guest cart, place order, live tracking, add more, request bill | F-010, R-013 | | ⬜ |
| F-012 | Waiter screen: tables overview, pending confirmations, place order, serve | F-006, R-013 | | ⬜ |
| F-013 | Kitchen board: live columns, item status, out-of-stock toggle | F-006, R-013 | | ⬜ |
| F-014 | Inventory pages: ingredients, recipes, stock, restock, adjust, wastage, movements | F-006, I-006 | | ⬜ |
| F-015 | Billing and payment UI: bill view, cash payment, eSewa redirect, success and failure pages, eSewa settings | F-012, PAY-005 | | ⬜ |
| F-016 | Analytics dashboard | F-006, AN-004 | PD-015 | ⬜ |
| F-017 | Multi-outlet UI: switcher (Owner, Manager), add outlet, staff assignments, menu overrides | F-006, O-005, M-005 | | ⬜ |
| F-018 | Consolidated Owner dashboard | F-016, AN-006 | | ⬜ |
| F-019 | Subscription page: plan, usage, renewal reference, contact-us form | F-006, S-003, PAY-008 | | ⬜ |
| F-020 | Super Admin panel: organizations, plans, subscriptions, leads, stats | F-006, SA-006 | | ⬜ |
| F-021 | Notifications UI with real-time updates | F-006, N-002 | | ⬜ |
| F-022 | Polish: loading, empty and error states, responsive pass, accessibility basics | all UI | | ⬜ |

---

## 13. Release tasks

| ID | Task | Depends | Status |
|---|---|---|---|
| D-001 | Dockerfiles for backend, worker and frontend | F-022 | ⬜ |
| D-002 | Demo seed: realistic restaurant, menu, ingredients, recipes, staff; "try as Owner / Waiter / Kitchen / Guest" buttons | D-001 | ⬜ |
| D-003 | Deploy: Neon, Redis, Render or Railway, Vercel; env setup; production cookie and domain check | D-001 | ⬜ |
| D-004 | Load test of order and stock path; record results | D-003 | ⬜ |
| D-005 | README with screenshots and architecture diagram; final doc sync | D-003 | ⬜ |

---

## 14. Suggested working order

`Phase 0` → `Phase 1` → `F-001..F-006` → `Phase 2` → `Phase 3` + `F-007, F-008` → `Phase 4` + `F-009` → `Phase 5` + `F-010..F-013` → `Phase 6` + `F-014` → `Phase 7` + `F-015` → `Phase 8` + `F-016, F-021` → multi-outlet UI `F-017, F-018` → `Phase 9` + `F-019, F-020` → `F-022` → Release.

Multi-outlet is in v1, but the outlet-context middleware exists from A-010 onward, so every module is outlet-ready from its first task. The switcher UI (F-017) is added after the single-outlet flow works.

---

## 15. Progress log

| Date | Task | Result | Notes |
|---|---|---|---|
| 2026-11-10 | T-001 | ✅ done | Docs approved. Setup decisions recorded as D-034 to D-038; package layout and git handling as D-039 and D-040; PD-021 added; base schema SQL added to `docs/` |
| 2026-11-10 | T-002 | ✅ done | Root `.gitignore`, `.editorconfig`, `docker-compose.yml` (validated), root and per-app `.env.example`, README with per-folder test commands. No root package; no git commands |
| 2026-11-10 | T-003 | ✅ done | Backend scaffold: strict TypeScript, Express 5, `@/*` aliases, ESLint 10 + Prettier, full folder tree, scripts. Lint, type-check and build pass; server smoke-tested |
| 2026-11-10 | T-004 | ✅ done | Zod-validated env that refuses to start when invalid, brand config, API constants. Verified both the failure and success startup paths |
| 2026-11-10 | T-005 | ✅ done | Prisma 6.19.3 + client singleton + `/api/v1/health` (200 with database up, 503 with database down). Verified against a real Postgres instance |
| 2026-11-10 | T-006 | ✅ done | Migrations `20261110120000_init` and `20261110120100_additions` authored and applied to the Neon database. Prisma schema written in PascalCase with `@@map`, `migrate diff` reports no drift, 11 CHECK constraints and 5 partial indexes verified live |
| 2026-11-10 | T-007 | ✅ done | Idempotent seed: 4 roles, 15 permissions, 38 role-permission mappings (Waiter includes `order.cancel`), 3 NPR plans at price 0. Ran twice; counts unchanged |
| 2026-11-10 | T-008 | ✅ done | Error codes from `API.md`, `AppError`, success/error response helpers, 404 handler, global error handler. Health controller now uses the helper. Verified 200, 404, 409 with details and 500 without leaking internals |
| 2026-11-10 | T-009 | ✅ done | `validate` middleware for params, query and body; coerced/defaulted values replace the request data, unknown fields follow the schema (stripped by default), failures return `VALIDATION_ERROR` with section-prefixed paths. Verified valid and invalid requests |
| 2026-11-10 | T-010 | ✅ done | Jest + Supertest test suite with separate unit/integration projects, Neon test database (`Bhansa_test`), globalSetup runs migrations, per-file DB reset + reference data seed, factories for org/outlet/user/assignment/tenant. Initial tests: health endpoint (200/503), 404 envelope, validate middleware (valid/invalid), factory + reference data assertions. Coverage 100% on services (threshold 80% enforced). Switched from Vitest to Jest due to environment AppLocker blocking native .node modules. All quality checks pass. |
| 2026-11-10 | T-011 | ✅ done | pino logger with structured JSON output (dev: pretty, prod: JSON), request-id middleware (generates UUID or uses `x-request-id` header), request logging middleware, error handler now uses logger with request ID. Health check logs request start. Express type extensions for `req.id`, `req.params`, `req.query`, `req.body`, `res.json`, `res.status`. All tests pass (8/8), 100% coverage on services, quality checks pass. |
| 2026-11-10 | T-012 | ✅ done | ioredis client with lazy connect, graceful shutdown in server.ts. Rate-limit middleware with configurable window, max requests, key generator, and standard headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After). Health endpoint now checks Redis (`redis: "ok"`). Mock Redis in tests for CI. All tests pass (8/8), 100% coverage on services, quality checks pass. |
| 2026-11-10 | T-013 | ✅ done | @asteasolutions/zod-to-openapi v8 with Zod 4, OpenAPIRegistry for route registration. Swagger UI at `/api/v1/docs/` (with custom title, hidden topbar), JSON spec at `/api/v1/docs.json`. Health endpoint documented with 200/503 responses, security schemes (cookieAuth, guestAuth), X-Outlet-Id parameter. Test verifies docs.json, Swagger UI HTML, and document structure. All tests pass (11/11), quality checks pass. |
| 2026-11-10 | T-014 | ✅ done | helmet (CSP, HSTS, frameguard, noSniff, xssFilter, referrerPolicy), CORS (allowlist from FRONTEND_URL + localhost in dev, credentials, exposed rate-limit headers), cookie-parser (unsigned), body limit (1 MB JSON/urlencoded, 413 response). Middleware order: helmet → cors → express.json → express.urlencoded → cookie-parser → body-limit → request-id → request-log. All tests pass (11/11), quality checks pass. |
| 2026-11-10 | T-015 | ✅ done | GitHub Actions workflow at `.github/workflows/ci.yml`. Jobs: backend (install, prisma generate/migrate, lint, format:check, type-check, build, test with postgres/redis services) and frontend (placeholder). Runs on push/PR to main/develop. Uses Node 22, npm cache. All backend checks pass locally. |
| 2026-11-10 | A-001 | ✅ done | Register endpoint `POST /api/v1/auth/register` creates organization, default outlet "Main Branch", owner user with argon2id password hash, and trial subscription (14 days) in one serializable transaction. Owner gets "owner" role (no outlet_id). Validation: email, password (min 8), full_name, organization_name, organization_slug (alphanumeric + hyphens). Returns 201 with org/outlet/user/subscription. Duplicate email/slug → 409 CONFLICT. Validation errors → 400 VALIDATION_ERROR. 6 integration tests cover happy path, duplicate email, duplicate slug, invalid email, short password, invalid slug. Coverage 93.1% on auth services. All quality checks pass. |
| 2026-11-10 | A-002 | ✅ done | Resend email client, BullMQ email queue with worker, verification/password reset/invitation HTML templates. `sendVerificationEmail` queues emails via BullMQ (skipped in tests). `src/services/email/email.service.ts` returns early in test env. Email worker lazily initializes to avoid test DB connections. Register service sends verification email after transaction commits. All 17 tests pass (11 previous + 6 new). Coverage 87.9% (threshold 80% enforced). Quality checks pass. |
| 2026-11-10 | A-003 | ✅ done | `POST /api/v1/auth/verify-email` and `POST /api/v1/auth/resend-verification` endpoints. Verify endpoint validates token, marks user email_verified_at, returns 200. Resend endpoint rate-limits to once per 5 min, rejects verified emails (409), returns 200 for non-existent emails (security). 8 new integration tests cover valid/invalid tokens, rate limiting, verified email rejection, security for non-existent emails. All 25 tests pass, 81% coverage (threshold 80%). All quality checks pass. |
| 2026-11-10 | A-004 | ✅ done | `POST /api/v1/auth/login` endpoint with argon2id password hashing, JWT access token (15min), refresh token (7 days, rotated, family-based revocation). Sets httpOnly Secure SameSite=Lax cookies. Blocks unverified email (403) and deactivated accounts (403). 7 integration tests cover valid login, invalid credentials, unverified email, inactive account, validation errors. Access token in `access_token` cookie, refresh token in `refresh_token` cookie (path `/api/v1/auth/refresh`). 32 tests pass, 85.8% coverage (threshold 80%). All quality checks pass. |
| 2026-11-13 | A-005 | ✅ done | Access-token middleware (`src/middlewares/auth.ts`) verifies the `access_token` JWT cookie with `jose` and the `JWT_ACCESS_SECRET`, rejects missing/invalid/expired tokens with 401 `UNAUTHENTICATED`, and loads the user from the database (rejecting inactive or unverified users). Access tokens now carry the documented `sub`, `org` and `sa` claims. `GET /api/v1/auth/me` returns the user, organization, staff assignments (with role and outlet), the sorted union of role permissions, and the last used outlet. Optional-auth variant available for public-but-personalised routes. OpenAPI path registered with 200/401 schemas. 5 integration tests cover missing/invalid/expired tokens, deactivated user, and the full happy path. 37 tests pass (8 suites), 85.84% coverage (threshold 80%). Type-check, lint, format:check and build pass. |
| 2026-11-13 | A-006 | ✅ done | `POST /api/v1/auth/refresh` rotates the refresh-token cookie: the stored SHA-256 hash is looked up, the old row is marked `used_at`/`replaced_by`, and a new token is issued in the same `family_id` inside one transaction. Replaying an already-rotated token revokes the whole family and returns 401 `UNAUTHENTICATED`; revoked, expired, inactive-user and unknown tokens also return 401. `hashToken()` is now a real SHA-256 (register previously stored the raw verification token, so email verification could never succeed — fixed and covered by a real success test). Access/refresh cookie options moved to `utils/cookies.ts` and TTLs now come from `JWT_ACCESS_TTL` / `REFRESH_TOKEN_TTL_DAYS`. 7 new refresh tests (3 rewrites in verify-email). 44 tests pass (9 suites), 90.27% coverage (threshold 80%). Type-check, lint, format:check and build pass. |
| 2026-11-13 | A-007 | ✅ done | `POST /api/v1/auth/logout` revokes the refresh-token family from the refresh cookie and clears both auth cookies; repeated calls with a missing or unknown token stay 200 (idempotent). `POST /api/v1/auth/logout-all` revokes every family for the authenticated user. Revocation helpers live in `services/auth/revocation.service.ts` and are reused by refresh-token reuse detection. Refresh cookie path widened to `/api/v1/auth` (D-047) so logout can identify the family while keeping per-device sessions. 6 integration tests cover auth requirement, per-device revocation, cookie clearing, idempotency and logout-all. 50 tests pass (10 suites), 91.46% coverage (threshold 80%). Type-check, lint, format:check and build pass. |
| 2026-11-14 | A-008 | ✅ done | `POST /api/v1/auth/forgot-password` always returns 200 (no account enumeration) and queues a reset email only for an active account. The token is random, stored as a SHA-256 hash, single use, valid for 1 hour, and any pending reset token is invalidated when a new one is issued; repeat requests inside a 5-minute quiet window reuse the pending request (no second email, no extra token). `POST /api/v1/auth/reset-password` consumes the token inside a transaction, stores the new argon2id hash, revokes every refresh-token family for the user and clears the auth cookies; invalid, expired and reused tokens return 400 `VALIDATION_ERROR`. Password rules: minimum 8 characters and a small common-password deny list. 10 new integration tests (no enumeration, hashed/single-use token, quiet window, old password rejected, sessions revoked, expired/unknown token, weak password). 60 tests pass (11 suites), 89.75% coverage (threshold 80%). Type-check, lint, format:check and build pass. |
| 2026-11-14 | A-009 | ✅ done | `can(user, outlet, permissionCode)` in `services/authz/permission.service.ts` resolves permissions from staff assignments on every request (no cache, PD-005). An assignment with `outlet_id = NULL` applies to every outlet in the user's organization (Owner), outlet-scoped staff stay limited to their outlets, and outlets from another organization are always denied. Unknown permission codes, users without an assignment (including super admins) and users without an organization are denied by default. `requirePermission(code)` middleware rejects missing auth (401 `UNAUTHENTICATED`), missing outlet context (403) and missing permission (403 `FORBIDDEN`); `req.outlet` was added to the Express request type for the outlet-context task. Tests: a table-driven matrix covering all 4 roles × 15 permission codes against the PRD matrix, plus Owner/scope/cross-org/unknown-code/deny-by-default cases and middleware response tests. 131 tests pass (13 suites), 90.04% coverage, permission service 100%. Type-check, lint, format:check and build pass. |
| 2026-11-14 | A-010 | ✅ done | `outletContextMiddleware` resolves the untrusted `X-Outlet-Id` header in one query: the outlet must belong to the user's organization, must not be soft-deleted, and the user needs either a direct assignment or an Owner-style `outlet_id = NULL` assignment. It attaches `{ id, organization_id, name, is_active, timezone }` to `req.outlet` for `requirePermission` and downstream services. Missing or malformed headers return 400 `VALIDATION_ERROR`; unknown, cross-organization, unassigned and deleted outlets return 403 `FORBIDDEN`; unauthenticated requests return 401. Inactive outlets still resolve so reports keep working, leaving order creation to check `is_active`. 12 tests cover header validation, staff/Manager/Owner scoping, cross-org denial, inactive and deleted outlets, unknown ids, missing auth and users without an organization. 143 tests pass (14 suites), 90.04% coverage. Type-check, lint, format:check and build pass. |
| 2026-11-14 | A-011 | ✅ done | Added `tests/helpers/tenant.ts`: `createTestTenant(label)` builds an organization, an outlet and one verified user per staff role (Owner with `outlet_id = NULL`), `createIsolatedTenants()` returns two such tenants, `createSession(user, outletId)` signs a user in with a real signed access cookie, `tenantApi(app, session)` sends that cookie plus `X-Outlet-Id` on every method and supports `.at(outletId)` to switch outlets without changing the user, and `expectTenantDenied(response)` accepts a 403/404 failure envelope. A self-test runs the helper against `authMiddleware` + `outletContextMiddleware`: same-tenant access succeeds, cross-tenant and unassigned outlets are denied, outlet switching keeps the user, and the denial assertion rejects non-denials. 6 tests. 149 tests pass (15 suites), 90.04% coverage. Type-check, lint, format:check and build pass. |
| 2026-11-14 | A-012 | ✅ done | `POST /api/v1/staff/invitations`, `GET /api/v1/staff/invitations` and `DELETE /api/v1/staff/invitations/:id`, all behind `staff.manage` + `X-Outlet-Id`. Invitations expire after 7 days (D-048) and store only the SHA-256 token hash; re-inviting an email revokes the previous pending invitation. The target outlet defaults to the header outlet; Owner invitations are organization-wide, Manager may target only assigned outlets and cannot grant a role above their own (D-049). Listing is scoped the same way, marks expired pending rows, supports `status`, `page` and `limit`, and never exposes organization-wide invitations to outlet-scoped Managers. Same-organization staff emails and any other existing account return 409 (D-051). `sendInvitationEmail` queues one `send-invitation` job linking to `FRONTEND_URL/accept-invite?token=...`. Added an invitation factory and 27 integration tests covering hashing, email payload, replacement, hierarchy, outlet scoping, tenant isolation, expiry, pagination, revocation states and OpenAPI paths. Swagger generation was made lazy so every registered module appears. 176 tests pass (16 suites), 88.27% coverage (80% threshold), new service 86.81%. Type-check, lint, format:check and build pass. |
| 2026-11-14 | A-013 | ✅ done | `POST /api/v1/auth/accept-invite` consumes a pending invitation by its hashed token and, in one serializable transaction, creates the staff account in the inviting organization, marks the email verified, adds the invited role and outlet assignment, marks the invitation accepted, and issues a refresh token. The new user is signed in immediately with the normal access and refresh cookies (D-053). The body is `{ token, full_name, password }` with the register password rule (minimum 8 characters, D-052). Unknown, revoked and expired tokens return 400 (expired rows become `expired`); already accepted invitations, already consumed tokens and any existing account email return 409 (D-051). A second acceptance never creates a duplicate user. Invitations remain single-use even across concurrent requests. The invite-side check from A-012 now rejects every existing account, not only same-organization staff. Added the acceptance controller, service, schema and 10 integration tests covering the happy path with cookies and `/auth/me`, login with the chosen password, organization-wide Owner invitations, invalid/revoked/expired tokens, accepted/consumed invitations, duplicate accounts, payload validation and OpenAPI. 185 tests pass (17 suites), 88.40% coverage (80% threshold), new service 89.47%. Type-check, lint, format:check and build pass. |
| 2026-11-14 | A-014 | ✅ done | `GET /api/v1/staff` lists staff with `status`, `role`, `page` and `limit`; Owner sees the whole organization while Manager sees anyone assigned to a managed outlet, and inactive staff are included. Rows carry the user, active flag and every role/outlet assignment (D-055). `PATCH /api/v1/staff/:id/role` changes all assignments: Owner becomes one organization-wide assignment, demoting an Owner places them at `X-Outlet-Id`, Waiter/Kitchen collapse to a single assignment, and Managers cannot touch Owners, staff outside their outlets, or grant a role above their own; the last active Owner cannot be demoted (D-054). `PATCH /api/v1/staff/:id/deactivate` sets `is_active = false` and revokes every refresh token, blocking self-deactivation and Manager-to-Owner deactivation (D-056). The shared `services/staff/access.ts` helper now owns role ranking, caller-role resolution and manageable-outlet scoping; the invitation service reuses it. 29 integration tests cover list scoping, filters, pagination, tenant isolation, role promotion/demotion, hierarchy, multi-outlet collapse, last-owner guards, deactivation, token revocation and OpenAPI paths. 214 tests pass (18 suites), 89.22% coverage (80% threshold), `staff.service.ts` 92.2%. Type-check, lint, format:check and build pass. |
| 2026-11-14 | A-015 | ✅ done | `PUT /api/v1/staff/:id/assignments` replaces a staff member's outlet assignments with the given `outlet_ids` array (D-057). Owner is rejected (organization-wide). Waiter and Kitchen must receive exactly one outlet; Manager may receive many. Managers can only assign outlets they manage. Outlets must exist in the same organization and not be deleted. The shared `services/staff/access.ts` helper scopes the caller's manageable outlets. 10 integration tests cover Owner multi-outlet assignment, replacement/clearing, Manager scoping, Waiter/Kitchen single-outlet enforcement, Owner rejection, cross-org/deleted outlet 404, tenant isolation, and invalid bodies. 224 tests pass (18 suites), 89.45% coverage (80% threshold), `staff.service.ts` 92.38%. Type-check, lint, format:check and build pass. |
| 2026-11-14 | A-016 | ✅ done | Added `src/services/audit/audit.service.ts` with `writeAuditLog` and typed convenience helpers for all sensitive actions listed in `SECURITY.md` §10: staff invites/removals/role changes/deactivations, menu item CRUD, outlet overrides, discounts, payment overrides, plan changes, subscription payments, login failures, and Super Admin actions. All writes use `Prisma.DbNull`/`Prisma.JsonNull` for append-only JSON `meta` fields. The helper accepts optional `organizationId`, `outletId`, `userId`, and writes a single audit row with action, entity, entityId, and arbitrary meta. 15 unit tests cover the base writer and every convenience helper with valid UUIDs. 239 tests pass (19 suites), 89.72% coverage (80% threshold), `audit.service.ts` 95.45%. Type-check, lint, format:check and build pass. |
| 2026-11-14 | S-001 | ✅ done | Added `src/services/plans/plan.service.ts` with `getLimits(organization)` merging plan base values with subscription overrides (D-059). Returns `{ maxOutlets, maxStaff, maxMenuItems, multiOutletEnabled, features }`; treats `null` as unlimited. Includes `canCreateOutlet`, `canAddStaff`, `canAddMenuItem` helpers that check current usage against effective limits, ignoring soft-deleted resources. 14 unit tests cover base limits, overrides, suspended/cancelled subscriptions, multiple subscriptions (only latest active counts), and all three limit checks with soft-delete filtering. 253 tests pass (20 suites), 89.76% coverage (80% threshold), `plan.service.ts` 90.32%. Type-check, lint, format:check and build pass. |
| 2026-11-14 | S-002 | ✅ done | Added `src/middlewares/subscriptionGuard.ts` middleware that checks the organization's subscription status on every outlet-scoped request (after auth, before outletContext). Reads the latest active subscription (trialing/active/grace) or suspended/cancelled status. Allows full access for trialing/active subscriptions. In grace period: GET requests allowed; all mutations (POST/PATCH/PUT/DELETE) blocked with 403 `SUBSCRIPTION_READ_ONLY`. Suspended/cancelled: all requests blocked with 403 `SUBSCRIPTION_SUSPENDED`. No subscription: GET allowed, mutations blocked with 403 `FORBIDDEN`. Exempts `/health`, `/auth/*`, `/docs*`. 18 integration tests cover all states (trialing, grace, suspended, cancelled, none), mutating/read requests, tenant isolation, and exempt routes. 271 tests pass (21 suites), 89.76% coverage (80% threshold). Type-check, lint, format:check and build pass. |
| 2026-11-14 | S-003 | ✅ done | Added `GET /api/v1/plans/subscription` endpoint returning plan, status, trial/grace dates, override limits, and usage versus effective limits for outlets, staff, and menu items. Uses `getLimits` from S-001 and queries actual usage counts. Protected by `billing.manage` permission + subscription guard. 9 integration tests cover base response, usage counts, overrides, permissions, outlet header, and missing subscription. 280 tests pass (22 suites), 89.96% coverage (80% threshold), `subscription.service.ts` 100%. Type-check, lint, format:check and build pass. |
| 2026-11-14 | S-004 | ✅ done | Added `src/jobs/trialExpiry.queue.ts` with daily BullMQ job (`trial-expiry-check`) that runs at 01:00 UTC. Processes: 1) Sends 3-day and 1-day reminder emails before trial ends, 2) Moves expired trials to grace (sets `grace_ends_at` = 7 days), sends notification, 3) Moves expired grace to suspended, sends notification. Uses `emailService` with new templates (`trialExpiryReminder`, `trialExpired`, `trialSuspended`). 7 unit tests cover reminders, trial→grace, grace→suspended, full flow. 287 tests pass (23 suites), 90.01% coverage (80% threshold). Type-check, lint, format:check and build pass. |
| 2026-11-14 | S-005 | ✅ done | Added `POST /api/v1/plans/subscription/custom-plan-request` endpoint (protected by auth + outlet header) that creates a `CustomPlanLead` with `contact_name`, `contact_email`, optional `outlet_count` (1-100), and optional `message`. Organization ID is auto-filled from the authenticated user. Zod validation rejects invalid emails, empty names, out-of-range outlet_count, and overlong fields. 11 integration tests cover success cases, all validation rules, unauthenticated 401, missing outlet header 400, and DB persistence. 298 tests pass (24 suites), 87.91% coverage (80% threshold). Type-check, lint, format:check and build pass. |
| 2026-11-14 | S-006 | ✅ done | Added plan-limit check helper exports and middleware. Created `src/services/plans/index.ts` exporting `getLimits`, `canCreateOutlet`, `canAddStaff`, `canAddMenuItem` for easy imports. Created `src/middlewares/planLimit.ts` middleware factory (`planLimitMiddleware('outlet'|'staff'|'menuItem')`) that checks limits before resource creation and returns 403 `PLAN_LIMIT_REACHED` with details. Ready for use by O-003 (outlet creation), staff creation, and M-002 (menu item CRUD). 298 tests pass (24 suites), 87.91% coverage (80% threshold). Type-check, lint, format:check and build pass. |
| 2026-11-19 | O-001 | ✅ done | Added `GET /api/v1/outlets` (list outlets user can access) and `GET /api/v1/outlets/:id` (get outlet details) endpoints. Owner sees all organization outlets; Manager/Waiter/Kitchen see only assigned outlets. Supports pagination, `is_active` filter, and search. 32 integration tests cover listing, pagination, filters, tenant isolation, cross-tenant rejection, and access control. 334 tests pass (25 suites), 87.98% coverage (80% threshold). Type-check, lint, format:check and build pass. |
| 2026-11-19 | O-002 | ✅ done | Added `PATCH /api/v1/outlets/:id` endpoint (update outlet profile and settings). Owner can update all fields; Manager with `tables.manage` permission can update assigned outlets. Fields: name, address, phone, timezone, tax_percent (VAT), service_charge_percent, is_active. 5 integration tests cover owner updates, manager updates, tax/service charge, is_active, cross-tenant rejection. 334 tests pass (25 suites), 87.98% coverage (80% threshold). Type-check, lint, format:check and build pass. |
| 2026-11-19 | O-003 | ✅ done | Added `POST /api/v1/outlets` endpoint (create outlet). Owner only, plan-gated by `max_outlets` limit via planLimitMiddleware. Returns 403 `PLAN_LIMIT_REACHED` when limit exceeded. Validation for name, address, phone, timezone, tax_percent, service_charge_percent. 9 integration tests cover owner creation, minimal fields, role restrictions, validation rules, and plan limit enforcement. 335 tests pass (25 suites), 87.98% coverage (80% threshold). Type-check, lint, format:check and build pass. |
| 2026-11-19 | O-004 | ✅ done | Added `PATCH /api/v1/outlets/:id/deactivate` endpoint (deactivate outlet). Sets `is_active=false` which blocks new orders while keeping history. Owner only; Manager/Waiter/Kitchen rejected with 403. Cross-tenant access returns 403. 3 integration tests cover owner deactivation, manager rejection, cross-tenant rejection. 335 tests pass (25 suites), 87.98% coverage (80% threshold). Type-check, lint, format:check and build pass. |
| 2026-11-19 | O-005 | ✅ done | Added `PATCH /api/v1/outlets/me/active-outlet` endpoint (save last active outlet). Owner can set any outlet in their organization. Manager can only set outlets they are assigned to. Updates user's `last_outlet_id`. Requires `outlet_id` in body. 8 integration tests cover owner/manager setting, cross-tenant rejection, unassigned outlet rejection, 404/400/401 errors. 343 tests pass (25 suites), 88.12% coverage (80% threshold). Type-check, lint, format:check and build pass. |
| 2026-11-19 | TB-001 | ✅ done | Added Table CRUD per outlet endpoints under `/api/v1/outlets/:outletId/tables`. GET (list with pagination/filtering), GET by ID, POST (create), PATCH (update), DELETE (deactivate), POST regenerate-qr. Owner/Manager with `tables.manage` can create/update/deactivate/regenerate QR. Waiter/Kitchen can list/get. QR token auto-generated on create, regenerable. All endpoints require `X-Outlet-Id` header. 34 integration tests cover CRUD, QR regen, filters, permissions, tenant isolation. 377 tests pass (26 suites), 87.51% coverage (80% threshold). Type-check, lint, format:check and build pass. |
| 2026-11-19 | TB-002 | ✅ done | Added `GET /api/v1/public/tables/:qrToken` public endpoint to resolve QR token to table, outlet, and effective menu. Returns table details, outlet info, and effective menu with categories and items (including outlet price overrides). Handles inactive/deleted outlets, cross-tenant access, and invalid tokens. 10 integration tests cover valid resolution, error cases (404/400/401), and menu resolution. 387 tests pass (27 suites), 87.76% coverage (80% threshold). Type-check, lint, format:check and build pass. |
| 2026-11-19 | TB-003 | ✅ done | Added `GET /api/v1/outlets/:outletId/tables/:id/qr` endpoint to return QR code image (PNG) for a table. Uses `qrcode` library (per PD-006). Requires authentication and outlet context. Owner, Manager, and Waiter can access. 6 integration tests cover owner/manager/waiter access, cross-tenant rejection, 404 for non-existent table, 400 for invalid UUID. 393 tests pass (27 suites), 87.76% coverage (80% threshold). Type-check, lint, format:check and build pass. |
| 2026-11-19 | M-001 | ✅ done | Added Category CRUD endpoints under `/api/v1/menu/categories`: GET (list with pagination/filtering), GET by ID, POST (create), PATCH (update), DELETE (soft delete). Requires `menu.edit` permission (Owner/Manager). Uses new `requireOrgPermission` middleware for org-level permissions. 34 integration tests cover CRUD, filters, permissions, tenant isolation. 34 tests pass. Type-check, lint, format:check and build pass. |
| 2026-11-19 | M-002 | ✅ done | Added Menu Item CRUD endpoints under `/api/v1/menu/items`: GET (list with pagination/filtering by category, active status, vegetarian, search), GET by ID, POST (create), PATCH (update), DELETE (soft delete). Requires `menu.edit` permission (Owner/Manager). Plan-gated by `max_menu_items` via `planLimitMiddleware`. 40 integration tests cover CRUD, filters, permissions, plan limit, tenant isolation. 40 tests pass. Type-check, lint, format:check and build pass. |
| 2026-11-20 | M-003 | ✅ done | Added Menu Item Options (variants/addons) CRUD endpoints under `/api/v1/menu/items/:menuItemId/options`: GET (list with pagination, kind/is_active filters), GET by ID, POST (create), PATCH (update), DELETE (soft delete). Requires `menu.edit` permission (Owner/Manager). 37 integration tests cover CRUD, filters, permissions, tenant isolation. 37 tests pass. Type-check, lint, format:check and build pass. |
| 2026-11-20 | M-004 | ✅ done | Added `POST /api/v1/menu/items/upload/image` endpoint to upload menu images to Cloudinary. Uses `multer` for multipart handling with memory storage. Accepts JPEG, PNG, WebP up to 5MB. Returns secure URL and metadata. Requires `menu.edit` permission (Owner/Manager). 9 integration tests cover valid uploads, validation (type, size, missing file), permissions, tenant isolation. 9 tests pass. Type-check, lint, format:check and build pass. |
| 2026-11-20 | M-005 | ✅ done | Added Per-outlet override endpoints: `GET /api/v1/menu/items/:id/outlet-overrides` (list with outlet info) and `PUT /api/v1/menu/items/:id/outlet-overrides` (bulk upsert). Supports price_override, is_available, auto_unavailable per outlet. Owner has org-wide access, Manager limited to assigned outlets. 16 integration tests cover CRUD, filters, permissions, tenant isolation. 16 tests pass. Type-check, lint, format:check and build pass. |
| 2026-11-20 | M-006 | ✅ done | Added `PATCH /api/v1/menu/items/:id/availability` endpoint to toggle item availability per outlet. Uses `item.mark_unavailable` permission (Owner, Manager, Kitchen). Creates/updates `MenuItemOutletOverride.is_available`. Owner has org-wide access, Manager/Kitchen limited to assigned outlets. 13 integration tests cover permissions (owner/manager/kitchen/waiter), tenant isolation, validation, and edge cases. 29 tests pass (16 from M-005 + 13 new). Type-check, lint, format:check and build pass. |
| 2026-11-20 | M-007 | ✅ done | Added `GET /api/v1/menu/effective` endpoint for effective menu query per outlet. Returns active categories with items including outlet price overrides and availability (respects is_available and auto_unavailable). Requires authentication and X-Outlet-Id header. Accessible by Owner (org-wide), Manager/Waiter/Kitchen (assigned outlets). 28 integration tests cover authentication, role-based access, content filtering, price overrides, availability logic, and response structure. Type-check, lint, format:check and build pass. |
| 2026-11-20 | R-001 | ✅ done | Added Socket.IO server with handshake authentication and room joining. Handshake validates access token from cookie, loads user and checks organization membership. Rooms: `outlet:{id}:waiters` (waiters, managers, owners), `outlet:{id}:kitchen` (kitchen, managers, owners), `outlet:{id}:managers` (managers, owners), `session:{id}` (guests). `join:outlet` event validates outlet access via staff assignments. 6 integration tests cover authentication (valid/invalid/no token), authorization (join assigned/unassigned/different org outlets), and room joining. Type-check, lint, format:check and build pass. |
| 2026-11-20 | R-002 | ✅ done | Public QR token resolution endpoint (`GET /api/v1/public/tables/:qrToken`) already implemented in TB-002. Returns table details, outlet info, and effective menu with categories/items including outlet price overrides and availability (respects is_available and auto_unavailable from M-007). No authentication required. Handles invalid/inactive/deleted tokens and cross-tenant access. 10 integration tests cover valid resolution, invalid tokens, inactive tables, deleted/inactive outlets, and effective menu content. Type-check, lint, format:check and build pass. |
| 2026-11-20 | R-003 | ✅ done | Added public session endpoints: `POST /api/v1/public/sessions` (start/join table session, sets guest_token cookie) and `GET /api/v1/public/sessions/current` (get session details with orders, requires guest_token cookie). Creates new session or joins existing open session for the table. Guest token cookie (30-day expiry) set on session creation. 11 integration tests cover session creation, joining existing sessions, invalid/inactive/deleted QR tokens, current session retrieval with/without cookie, and orders inclusion. Type-check, lint, format:check and build pass. |
| 2026-11-20 | R-004 | ✅ done | Added public order placement endpoint `POST /api/v1/public/orders`. Places order from guest session with server-side pricing (validates against effective menu, calculates tax/service charge). Creates order with `pending_confirmation` status. Uses idempotency key (PD-019) and per-outlet-per-day order numbers (PD-020). Sets table status to occupied. Returns order with items including options. 16 integration tests cover order creation, pricing, idempotency, validation, options, and error cases. Type-check, lint, format:check and build pass. |
| 2026-11-21 | R-005 | ✅ done | Added rate limiting and cart size limits for public endpoints:
- POST /public/sessions: per IP (10/min) and per QR token (5/min)
- GET /public/sessions/current: per session (30/min)
- POST /public/orders: per IP (20/min) and per session (10/min)
- GET /public/orders/:id: per session (60/min)
- Cart size limits: max 50 items, max 20 qty/item, max 100 total qty
Uses existing rate-limit middleware (T-012) with Redis. 27 tests pass (11 session + 16 order). Type-check, lint, format:check and build pass. |

The agent appends a row after each completed task.
