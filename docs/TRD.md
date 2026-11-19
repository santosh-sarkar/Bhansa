# TRD.md — Technical Requirements Document

Implements `PRD.md`. Approved choices are in `DECISIONS.md`. Pending items are marked **(PD-xxx)**; ask before building on them.

---

## 1. Stack

| Area | Choice |
|---|---|
| Language | TypeScript (strict), Node.js LTS |
| Backend | Express, MVC structure |
| ORM / DB | Prisma, PostgreSQL |
| Validation | Zod |
| API docs | OpenAPI generated from Zod, served as Swagger UI at `/api/docs` |
| Auth | JWT access token + rotating refresh token with revocation, httpOnly cookies |
| Real-time | Socket.IO |
| Cache / queues | Redis, BullMQ |
| Frontend | Next.js (App Router, SSR), React, TypeScript |
| Frontend libs | TanStack Query, Zustand, Tailwind CSS, shadcn/ui |
| Images | Cloudinary |
| Email | Resend |
| Payments | eSewa ePay v2 |
| Tests | Vitest, Supertest (backend); Vitest, React Testing Library (frontend) |
| Local dev | Docker Compose (Postgres, Redis, test DB) |
| Hosting | Vercel (frontend), Render or Railway (backend), Neon (Postgres), managed Redis |

Install the **latest stable** versions at setup time and pin them in `package.json`. Ask before choosing a major version that conflicts with another package.

---

## 2. Architecture constraints

1. Express is the only backend. Next.js renders pages and calls the Express API. No business logic in Next.js.
2. Backend follows MVC with the folder layout in `CODING_STANDARDS.md`.
3. All input is validated by Zod. Zod schemas generate the OpenAPI spec.
4. Every operational table has `outlet_id`. Org-level data has `organization_id`.
5. Business rules live in services (PD-001) or models, not in routes.
6. Long-running or scheduled work goes to BullMQ jobs, not request handlers.

---

## 3. API conventions

Base path: `/api/v1`. Full endpoint list in `API.md`.

**Success**
```json
{ "success": true, "data": { }, "meta": { "page": 1, "limit": 20, "total": 100 } }
```

**Error**
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [ ] } }
```

- Status codes: 200, 201, 204, 400 (validation), 401 (unauthenticated), 403 (forbidden), 404, 409 (conflict), 422 (business rule), 429, 500, 503 (health check only: a dependency is down).
- Pagination: `?page=1&limit=20`, max limit 100.
- IDs are UUIDs. Timestamps are ISO 8601 UTC.
- Money is sent as strings with 2 decimals (`"250.00"`) to avoid float issues.
- Outlet-scoped routes require header `X-Outlet-Id`. Public guest routes derive the outlet from the QR token.
- Mutating payment and order-creation endpoints accept an idempotency key (PD-019).

---

## 4. Authentication and sessions

- **Access token:** JWT, short life (15 minutes), httpOnly Secure cookie. Claims: `sub` (user id), `org` (organization id), `sa` (super admin flag). Role and permissions are **not** trusted from the token; they are resolved per outlet from the database (PD-005 for caching).
- **Refresh token:** opaque random value, 7 days, httpOnly Secure cookie scoped to the auth routes (`/api/v1/auth`) so logout can revoke the current session family. Stored **hashed** in `refresh_tokens` with a `family_id`.
- **Rotation:** each refresh issues a new token and marks the old one used. Reusing an old token revokes the entire family.
- **Revocation:** logout revokes the current family; logout-all revokes all families for the user; deactivating a user revokes all.
- **Passwords:** hashed with argon2id (PD-002). Minimum length and breach-safe rules in `SECURITY.md`.
- **Password reset:** forgot-password always returns 200 (no account enumeration) and queues a 1-hour, hashed, single-use token; repeat requests within five minutes reuse the pending token. Reset consumes the token, stores the new hash and revokes every refresh-token family.
- **Staff invitations:** Owner or Manager with `staff.manage` invites by email, role and outlet. Invitations expire after 7 days and store only the SHA-256 token hash. Re-inviting the same email revokes the pending invitation and issues a fresh link. Manager may target only outlets they manage and cannot grant a role above their own; Owner invitations are organization-wide. The email links to `FRONTEND_URL/accept-invite?token=...`. Acceptance (`POST /auth/accept-invite`) takes the token, full name and password (minimum 8 characters), consumes the invitation in one serializable transaction, creates the account in the inviting organization with a verified email, adds the role and outlet assignment, and signs the user in with the normal cookies. An account belongs to exactly one organization: any existing account email is rejected with 409 at invite and acceptance time (D-051). Unknown, revoked or expired tokens return 400; already accepted or already consumed invitations return 409.
- **Staff management:** `GET /staff` is organization-wide for an Owner and outlet-scoped for a Manager; inactive staff are included and can be filtered with `status`, `role`, `page` and `limit`. `PATCH /staff/:id/role` changes every assignment: Owner becomes one organization-wide assignment, demoting an Owner places them at `X-Outlet-Id`, and Waiter/Kitchen collapse to one assignment. Managers can only change staff whose assignments are all in outlets they manage, can never touch Owners or grant a role above their own, and the last active Owner cannot be demoted. `PATCH /staff/:id/deactivate` sets `is_active = false` and revokes all refresh tokens. Self-deactivation, Manager-to-Owner deactivation and deactivating an already inactive account return 409. The last active Owner cannot be deactivated. `PUT /staff/:id/assignments` replaces the outlet assignments: Owner is rejected (organization-wide), Waiter/Kitchen must get exactly one outlet, Manager may get many; Managers can only assign outlets they manage.
- **Cookies and CSRF:** PD-004. Default proposal: same parent domain in production, SameSite=Lax, custom header required on mutating requests; Next.js rewrites proxy to Express in local dev.
- **Guest identity:** random `guest_token` stored in a cookie, linked to a table session. Guests have no account.
- **Socket auth:** staff sockets authenticate from the access cookie during handshake; guest sockets authenticate with the guest token.

---

## 5. Multi-tenancy

- Hierarchy: Organization → Outlet → operational data.
- Middleware chain for outlet routes: `auth → subscriptionGuard → outletContext → permission → validate → controller`.
- **Subscription guard:** `src/middlewares/subscriptionGuard.ts` runs after auth, before outletContext. Checks organization's subscription status: trialing/active = full access; grace = read-only (mutations blocked with 403 `SUBSCRIPTION_READ_ONLY`); suspended/cancelled = all blocked with 403 `SUBSCRIPTION_SUSPENDED`; no subscription = read-only for mutations (403 `FORBIDDEN`). Exempts `/health`, `/auth/*`, `/docs*`.
- **Subscription details endpoint:** `GET /api/v1/plans/subscription` (protected by `billing.manage` + subscription guard) returns plan, status, trial/grace dates, override limits, and actual usage vs limits for outlets, staff, and menu items. Usage counts actual outlets (non-deleted), active staff with assignments, and active menu items.
- **Trial expiry job:** Daily BullMQ job (`trial-expiry-check`) runs at 01:00 UTC. Processes: 1) Sends 3-day and 1-day reminder emails before trial ends, 2) Moves expired trials to grace (sets `grace_ends_at` = 7 days), sends notification, 3) Moves expired grace to suspended, sends notification. Uses `emailService` with templates (`trialExpiryReminder`, `trialExpired`, `trialSuspended`).
- `outletContext` reads `X-Outlet-Id`, verifies the user has an assignment for it (Owner: any outlet in own organization), and attaches `req.outlet`. A missing or malformed header returns 400 `VALIDATION_ERROR`; an outlet outside the organization, without an assignment, or soft-deleted returns 403 `FORBIDDEN`. Inactive outlets still resolve (with `is_active = false`) so read-only reports keep working; order creation checks the flag.
- Models accept the tenant id as a required argument. A model function without a tenant filter is a bug.
- Permission check: `can(user, outlet, permissionCode)` runs in `services/authz/permission.service.ts` and `requirePermission(code)` guards outlet routes after `outletContext`. Permissions are read from staff assignments on every request (no cache first, PD-005); an assignment with `outlet_id = NULL` applies to every outlet in the user's organization and cross-organization outlets are always denied.
- Staff assignment: Owner has `outlet_id = NULL` (all outlets). Manager can have several assignments. Waiter and Kitchen exactly one (enforced in the service layer).
- Plan limits are enforced in services using `getLimits(organization)`, which merges plan values with subscription overrides. The helper returns `{ maxOutlets, maxStaff, maxMenuItems, multiOutletEnabled, features }`; `null` limits mean unlimited. Convenience helpers `canCreateOutlet`, `canAddStaff`, `canAddMenuItem` check current usage against effective limits, ignoring soft-deleted resources. Only the latest active (trialing/active/grace) subscription is considered; suspended/cancelled subscriptions are ignored.
- **Plan limit middleware:** `src/middlewares/planLimit.ts` exports `planLimitMiddleware('outlet'|'staff'|'menuItem')` factory that checks limits before resource creation. Returns 403 `PLAN_LIMIT_REACHED` with current usage and limit details. Attaches `req.planLimitInfo` for controller use. Ready for outlet creation (O-003), staff creation, and menu item creation (M-002).
- **Outlet listing:** `GET /api/v1/outlets` returns paginated list of outlets the user can access (Owner: all organization outlets; Manager/Waiter/Kitchen: assigned outlets only). Supports pagination, `is_active` filter, and search. `GET /api/v1/outlets/:id` returns outlet details for assigned outlets. Both require auth + `X-Outlet-Id` header.
- Optional hardening: PostgreSQL Row-Level Security as a second layer (not required for v1; ask before adding).

---

## 6. Real-time (Socket.IO)

Rooms:

| Room | Members |
|---|---|
| `outlet:{id}:waiters` | Waiters, Managers of that outlet |
| `outlet:{id}:kitchen` | Kitchen staff, Managers |
| `outlet:{id}:managers` | Managers, Owner |
| `session:{id}` | Guest(s) at that table session |

Events (server → client):

| Event | Room | When |
|---|---|---|
| `order:pending` | waiters | Guest places an order |
| `order:confirmed` | kitchen | Waiter confirms (new order for kitchen) |
| `order:rejected` | session | Waiter rejects |
| `order:status_changed` | waiters, kitchen, session | Any status change |
| `item:availability_changed` | managers, waiters | Manual or auto change |
| `stock:low` | managers, kitchen | Stock below threshold |
| `session:bill_requested` | waiters | Guest requests bill |
| `session:closed` | session, waiters | Payment completed |

Rules: events are emitted by services after the DB transaction commits. Clients refetch via TanStack Query when needed. Never emit data from another outlet.

---

## 7. Background jobs (BullMQ)

| Job | Trigger | Does |
|---|---|---|
| `trial-expiry` | Daily schedule | trialing → grace → suspended; sends reminder emails (e.g. 3 days and 1 day before) |
| `subscription-reminder` | Daily schedule | Renewal reminders |
| `low-stock-alert` | After stock change | Creates notification and email, de-duplicated |
| `esewa-reconcile` | Every few minutes | Re-checks pending eSewa payments via the status API |
| `send-email` | On demand | Sends transactional email through Resend with retries |
| `session-cleanup` | Scheduled | Flags stale open sessions for staff review (does not auto-delete) |

Jobs must be idempotent and safe to retry.

---

## 8. Payments

### 8.1 Customer payments with eSewa (ePay v2)

Based on the official ePay v2 documentation. **Before coding PAY-003 to PAY-006, re-read https://developer.esewa.com.np and confirm every field name, URL and rule. If anything differs, ask the user.**

- Each outlet stores its own eSewa **product code** and **secret key**, encrypted at rest (PD-011, PD-012). Test mode uses eSewa's sandbox endpoints; production uses the live endpoints. Endpoint URLs are config values, not hardcoded.
- Flow:
  1. Server creates a `payments` row (`pending`) with a unique `transaction_uuid`.
  2. Server builds the form fields and an **HMAC-SHA256 signature, base64-encoded**, over the `signed_field_names` values (documented signed fields are `total_amount`, `transaction_uuid`, `product_code`, in that order).
  3. Browser posts the form to eSewa's ePay v2 form endpoint.
  4. eSewa redirects the customer to our success or failure URL; the success redirect carries a base64 JSON `data` value that has its own signature.
  5. Server verifies that response signature using the signed fields it lists, checks the amount, transaction id and product code against the pending payment, **then calls eSewa's status check API** before marking the payment succeeded.
- A redirect is **not** proof of payment. If the status check times out, leave the payment `pending` and let the reconcile job retry.
- All steps are idempotent. A repeated callback must not create duplicate payments or close a session twice.
- Success and failure URLs point to the frontend; the frontend calls the backend verify endpoint (see `API.md`).
- Never log secret keys or full signatures.

### 8.2 Cash payments

Staff with `payment.record` records the amount received; the bill is marked paid and the session closes.

### 8.3 SaaS subscription payments

Manual in v1 (D-019, PD-013): owner pays, submits a reference, Super Admin approves, subscription period extends.

---

## 9. Files and email

- **Images:** uploaded through the backend to Cloudinary (type and size limits in `SECURITY.md`); store the URL and public id. Alternative signed direct upload can be proposed later.
- **Email (Resend):** verification, password reset, staff invitation, trial and renewal reminders, low-stock alerts. Templates live in `backend/src/lib/email/templates/`. Sending goes through the `send-email` job.

---

## 10. Configuration

All env vars are validated by Zod at startup (`config/env.ts`); the app refuses to start if one is missing. Proposed variables (the agent must ask before adding any not listed):

```
NODE_ENV, PORT, APP_URL, FRONTEND_URL
DATABASE_URL, TEST_DATABASE_URL, REDIS_URL
JWT_ACCESS_SECRET, JWT_ACCESS_TTL, REFRESH_TOKEN_TTL_DAYS
COOKIE_DOMAIN
ENCRYPTION_KEY                      # for stored payment credentials
CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
RESEND_API_KEY, EMAIL_FROM
ESEWA_FORM_URL, ESEWA_STATUS_URL    # sandbox or live
SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD   # seed only
```

Frontend: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_APP_NAME` (default from `config/brand`).

---

## 11. Performance targets

- API p95 under 300 ms for common reads at demo scale.
- Kitchen event delivery under 1 second.
- Index every outlet-scoped lookup (see `DATABASE.md`).
- Public menu is cacheable; use SSR with short revalidation (confirm approach at F-010).
- Load test the order and stock-deduction path before the demo (target and tool agreed with the user then).

---

## 12. Logging and observability

- Structured JSON logs with request id (PD-003). No secrets, tokens, passwords or full card/wallet data.
- `GET /api/v1/health` checks API, DB and Redis.
- Audit log rows for sensitive actions (staff changes, price changes, discounts, payment overrides, plan changes).
- **Audit log helper:** `src/services/audit/audit.service.ts` provides `writeAuditLog` and typed convenience helpers for all sensitive actions from `SECURITY.md` §10: staff invites/removals/role changes/deactivations, menu item CRUD, outlet overrides, discounts, payment overrides, plan changes, subscription payments, login failures, and Super Admin actions. All writes use `Prisma.DbNull`/`Prisma.JsonNull` for append-only JSON `meta` fields. The helper accepts optional `organizationId`, `outletId`, `userId`, and writes a single audit row with action, entity, entityId, and arbitrary meta.

---

## 13. Deployment and CI

- Dockerfiles for backend and frontend; Docker Compose for local dev.
- CI (GitHub Actions): install, lint, type-check, run tests on every pull request.
- Prisma migrations run on deploy.
- Seed script creates plans, roles, permissions, a Super Admin, and a demo restaurant with realistic data.
- Environments: local, production. Ask before adding staging.
