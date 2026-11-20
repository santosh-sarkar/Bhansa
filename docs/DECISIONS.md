# DECISIONS.md — Decision Log

Rule: the agent never re-asks an **approved** decision and never guesses a **pending** one. When a task needs a pending decision, ask the user with options and a recommendation (template in `AGENT.md`), then move it to the approved table.

---

## 1. Approved decisions

| ID | Topic | Decision | Notes |
|---|---|---|---|
| D-001 | Product name | **Bansa** | Keep in one config file (`config/brand`) so it is easy to change. Check domain and trademark before launch. |
| D-002 | Language | TypeScript (strict) | Backend and frontend |
| D-003 | Backend framework | Express | MVC structure |
| D-004 | ORM | Prisma | Partial unique indexes and CHECK constraints go in raw SQL migrations |
| D-005 | Validation | Zod | Single source for validation, types and Swagger |
| D-006 | Swagger | Generated from Zod schemas | zod-to-openapi style; no long comment blocks |
| D-007 | Frontend framework | Next.js (App Router, full SSR, not SPA mode) | Reason: SEO and fast first load on public pages |
| D-008 | Backend ownership | Express is the only backend | No Next.js API routes for business logic |
| D-009 | Frontend libs | TanStack Query, Zustand, Tailwind, shadcn/ui | |
| D-010 | Real-time | Socket.IO | Rooms per outlet and role |
| D-011 | Auth | JWT with refresh-token rotation and revocation | httpOnly cookies |
| D-012 | Jobs | Redis + BullMQ | |
| D-013 | Images | Cloudinary | |
| D-014 | Email | Resend | |
| D-015 | Testing | Vitest + Supertest (backend), Vitest + React Testing Library (frontend) | No Playwright. "Write tests and run the script." |
| D-016 | Repo | Monorepo: `/backend`, `/frontend`, `/docs` | |
| D-017 | Hosting | Vercel (frontend), Render or Railway (backend), Neon (Postgres), Docker for local dev | |
| D-018 | Customer payments | eSewa (ePay v2). Each restaurant enters its own merchant credentials, stored encrypted | Money goes straight to the restaurant |
| D-019 | SaaS subscription payments | Manual renewals: reminder emails, owner pays, Super Admin marks as received | eSewa has no auto-recurring billing |
| D-020 | Roles v1 | Super Admin, Owner, Manager, Waiter, Kitchen, guest Customer | Cashier and Delivery Rider are v2 |
| D-021 | Outlet switching | Only **Owner and Manager** can switch. Waiter and Kitchen belong to exactly one outlet | Multi-outlet is **in v1**, not v2 |
| D-022 | Hierarchy | Organization → Outlet → operational data. `outlet_id` on every operational table | |
| D-023 | Menu model | Shared master menu at org level with per-outlet overrides (price, availability) | |
| D-024 | Inventory | Ingredients and recipes shared at org level; stock per outlet. Manual + auto. Owner, Manager and Kitchen have access | Kitchen cannot edit recipes, costs or thresholds |
| D-025 | Stock deduction | At order confirmation; restored on cancellation (before preparing) | See pending PD-008 for exact cancel rules |
| D-026 | Fake-order protection | Guest orders start as `pending_confirmation`; waiter must confirm. **Always on** in v1 (no toggle) | |
| D-027 | Table sessions | Orders group into a table session until the bill is paid; pay-later is the default | |
| D-028 | Plans | Trial (14 days, full features, no card), Single Outlet, Custom/Multi-Outlet. After trial: 7-day read-only grace, then suspended | Limits stored in plan records with per-subscription overrides |
| D-029 | Email | Email verification and password reset are in v1 | |
| D-030 | Platform | Responsive web only. No PWA | |
| D-031 | Locale | NPR currency, 13% VAT, 10% service charge (editable per outlet), English-only UI | |
| D-032 | Order model | `order_type` field exists (dine_in, takeaway; delivery reserved for v2) | |
| D-033 | Workflow | Implement → update (TASK.md + affected docs) → write tests → Swagger → run tests → ask user to proceed | |
| D-034 | Backend layers (was PD-001) | MVC plus a thin `services/` layer for business logic | Controllers stay small; multi-model transactions and stock/payment rules live in services |
| D-035 | Logger (was PD-003) | pino | Fast structured JSON logs with request id |
| D-036 | Cookie and CSRF strategy (was PD-004) | Same parent domain + SameSite=Lax cookies + custom header check; Next.js rewrites proxy in local dev | Production frontend and API share a parent domain |
| D-037 | Test database (was PD-016) | Separate Postgres database in docker-compose | Faster than Testcontainers; configured by `TEST_DATABASE_URL` |
| D-038 | Migrations workflow (was PD-017) | Prisma Migrate with raw SQL blocks for partial unique indexes and CHECK constraints | Prisma cannot express them in `schema.prisma` |
| D-039 | Package layout | Monorepo folders `backend/` and `frontend/`, each an independent npm project with its own `package.json`, `node_modules` and scripts. No npm workspaces and no root `package.json` | One git repository, commands run per folder |
| D-040 | Git handling | The agent does not run git commands (no init, branches or commits); the user manages the single repository | Overrides `CODING_STANDARDS.md` section 7 for this project |
| D-041 | Backend toolchain | Express 5.3, TypeScript 5.9 (latest 7.x is outside the ESLint TypeScript plugin range), Zod 4.6, CommonJS output, `tsc-alias` for `@/*` path aliases, `tsx` for dev, ESLint 10 flat config, Prettier 3 | TypeScript 7 and typescript-eslint conflict; API docs task must confirm the OpenAPI registry package supports Zod 4 |
| D-042 | Prisma version | Prisma 6.19.3 (client and CLI) | Prisma 7 is ESM-only and requires a driver adapter plus `prisma.config.ts`; that conflicts with the CommonJS backend. Prisma 8 is still a release candidate. Revisit after v1 |
| D-043 | Currency and plan prices | `plans.currency` and `organizations.currency` default to `NPR`; plan prices stay `0` as placeholders until pricing is decided | Base SQL shipped with `USD` defaults and a 29 price |
| D-044 | Outlet tax defaults | `tax_percent` defaults to `13.00` and `service_charge_percent` to `10.00`, editable per outlet | Matches the locale decision |
| D-045 | Waiter cancellation | Waiter role gets `order.cancel` in the seed | Permission matrix allows cancel before `preparing`; timing rules stay in the service layer |
| D-046 | Bill cancellation state | `bills` gets `status` (open, paid, cancelled) plus `cancelled_at`, `cancelled_by`, `cancel_reason` in migration 002 | The design requires cancelled bills to keep their number and show "Cancelled" |
| D-047 | Refresh cookie scope | Refresh cookie path is `/api/v1/auth` (not just `/refresh`) so `POST /auth/logout` receives it and revokes only the current family | Keeps per-device logout without extra claims or body tokens |
| D-048 | Invitation lifecycle | Invitations expire after **7 days**. Re-inviting an email that already has a pending invitation revokes the old one and issues a fresh token/email | There is no separate resend endpoint, so re-invite is the resend path |
| D-049 | Invitation outlet scope | `X-Outlet-Id` is required. The invitation's outlet defaults to the header outlet; Manager may target only outlets they are assigned to, Owner any outlet in the organization. Listing shows only invitations the caller can manage; organization-wide (Owner) invitations are visible only to organization-wide staff | Follows the (O) marker in `API.md` and the Manager boundary in `SECURITY.md` |
| D-050 | Invitation email and existing accounts | Reject with 409 when the email already belongs to staff in the same organization; links use `FRONTEND_URL/accept-invite?token=...` | The allowance for accounts in other organizations was revised by D-051 |
| D-051 | Invitation account ownership | An account belongs to exactly one organization. Reject an invitation at creation and at acceptance with 409 when the email already has any account | Matches the single `users.organization_id` schema; avoids dead invitations |
| D-052 | Accept-invite payload | `POST /auth/accept-invite` takes `{ token, full_name, password }`; password follows the register rule (minimum 8 characters) | The invitation already carries email, role and outlet |
| D-053 | Accept-invite session | A successful acceptance sets the normal access and refresh cookies, so the new staff member is signed in immediately | Reuses the existing token pair and cookie helpers |
| D-054 | Staff role change | `PATCH /staff/:id/role` changes the role on all assignments. Promoting to Owner replaces them with one organization-wide (`outlet_id = NULL`) assignment; demoting an Owner replaces it with one assignment at `X-Outlet-Id`; moving to Waiter/Kitchen keeps one assignment (collapsing a multi-outlet Manager to the header outlet). Managers can change only staff whose assignments are all in outlets they manage, never Owners, and never grant a role above their own. Demoting the last active Owner is blocked | A role lives on each assignment; these rules keep Owner organization-wide and Waiter/Kitchen single-outlet |
| D-055 | Staff list | `GET /staff` returns every staff member in the organization for an organization-wide caller, and anyone assigned to a managed outlet for an outlet-scoped Manager. Rows carry the user, active flag and all role/outlet assignments; `page`/`limit` plus optional `status` and `role` filters. Inactive staff are included by default | Matches invitation scoping and lets the UI find deactivated accounts |
| D-056 | Staff deactivation | `PATCH /staff/:id/deactivate` sets `is_active = false` and revokes every refresh token. Nobody can deactivate themselves, a Manager can never deactivate an Owner, the last active Owner cannot be deactivated, and an already inactive account returns 409 | Prevents lockout and privilege escalation; `SECURITY.md` requires revocation on deactivation |
| D-057 | Staff outlet assignments | `PUT /staff/:id/assignments` takes `{ outlet_ids: string[] }` and replaces all assignments. Owner is rejected (organization-wide). Waiter and Kitchen must receive exactly one outlet; Manager may receive many. Managers can only assign outlets they manage. Outlets must exist in the same organization and not be deleted | Matches PRD: Manager multi-outlet, Waiter/Kitchen single-outlet; scoped to `X-Outlet-Id` |
| D-058 | Audit log helper | `src/services/audit/audit.service.ts` provides `writeAuditLog` and typed helpers for every sensitive action from `SECURITY.md` §10. Uses `Prisma.DbNull`/`Prisma.JsonNull` for append-only JSON `meta`. Accepts optional org/outlet/user IDs. 15 unit tests with valid UUIDs. 95.45% coverage. | Single place to write append-only audit rows; controllers/services call helpers |
| D-059 | Plan limits | `getLimits(organization)` merges plan base values with subscription overrides. `null` limits mean unlimited. Helpers `canCreateOutlet`, `canAddStaff`, `canAddMenuItem` check current usage vs effective limits, ignoring soft-deleted resources. | Matches TRD §5 "Plan limits are enforced in services using `getLimits(organization)`" |
| D-060 | Subscription guard | Middleware `subscriptionGuardMiddleware` in `src/middlewares/subscriptionGuard.ts` runs after auth, before outletContext. Checks org subscription status: trialing/active = full access; grace = read-only (mutations 403 `SUBSCRIPTION_READ_ONLY`); suspended/cancelled = all blocked (403 `SUBSCRIPTION_SUSPENDED`); no subscription = mutations blocked (403 `FORBIDDEN`). Exempts `/health`, `/auth/*`, `/docs*`. | Enforces SUB-02 "Read-only grace: data stays visible, new orders and edits are blocked" |
| D-061 | Subscription details endpoint | `GET /api/v1/plans/subscription` returns plan, status, trial/grace dates, override limits, and actual usage vs limits for outlets, staff, and menu items. Protected by `billing.manage` permission + subscription guard. Usage counts actual outlets (non-deleted), active staff with assignments, and active menu items. | Matches SUB-01 "Owner sees plan, status, trial end, usage versus limits" |
| D-062 | Trial expiry job | Daily BullMQ job (`trial-expiry-check`) runs at 01:00 UTC. Processes: 1) Sends 3-day and 1-day reminder emails before trial ends, 2) Moves expired trials to grace (sets `grace_ends_at` = 7 days), sends notification, 3) Moves expired grace to suspended, sends notification. Uses `emailService` with templates (`trialExpiryReminder`, `trialExpired`, `trialSuspended`). | Implements SUB-02 "Trial expiry job: trialing → grace → suspended, with reminder emails" |

---

## 2. Pending decisions

The agent must ask about these **before** the task listed in "Needed by". Recommendations are proposals, not approvals.

| ID | Topic | Options | Recommendation | Needed by |
|---|---|---|---|---|
| PD-002 | Password hashing | argon2, bcrypt | **argon2** (argon2id) | A-004 |
| PD-005 | Permission caching | None (query DB each time), Redis cache per user+outlet | **None first**, add Redis cache only if slow | A-009 |
| PD-006 | QR image library | `qrcode`, `qr-image` | **qrcode** | TB-003 |
| PD-007 | Invoice output | PDF (pdfkit / react-pdf), printable HTML page | **Printable HTML first**, PDF later | PAY-007 |
| PD-008 | Order cancellation rules | A) Cancel only before `preparing`. B) Staff can cancel any time before `served`, with reason; stock restored only if not yet preparing | **B**, Manager or Owner needed after `preparing` | R-008 |
| PD-009 | Order status source | A) Order status derived from item statuses. B) Order status set independently | **A** (derived) | R-007 |
| PD-010 | Item runs out after order placed | A) Kitchen cancels the item, waiter and guest notified. B) Kitchen substitutes | **A** | R-007 |
| PD-011 | eSewa credentials scope | Per outlet, per organization | **Per outlet** (more flexible; org default can come later) | PAY-003 |
| PD-012 | Encryption for stored secrets | AES-256-GCM with key from env, cloud KMS | **AES-256-GCM, key in env** | PAY-003 |
| PD-013 | SaaS payment proof | Owner submits eSewa/bank reference, Super Admin approves; Super Admin records directly | **Owner submits reference, Super Admin approves** | PAY-008 |
| PD-014 | Frontend forms | react-hook-form + Zod resolver, plain controlled forms | **react-hook-form + Zod** | F-005 |
| PD-015 | Charts | Recharts, Chart.js | **Recharts** | F-016 |
| PD-018 | Multi-outlet menu edits by Manager | Manager edits org master menu, or only outlet overrides | **Owner edits master, Manager edits overrides of assigned outlets** | M-005 |
| PD-019 | Idempotency for public order creation | Client-sent idempotency key, none | **Idempotency key header** | R-004 |
| PD-020 | Order number format | Per outlet per day counter, global counter | **Per outlet per day** | R-004 |
| PD-021 | Invoice title and IRD compliance | A) Plain "Bill" in v1 with PAN/VAT number and sequential number, no IRD claim. B) Label it "Tax invoice" and pursue IRD certification | **A** for v1; revisit before launch | PAY-007 |

---

## 3. Change log

| Date | ID | Change |
|---|---|---|
| 2026-11-05 | D-001 to D-033 | Initial approvals from planning conversation |
| 2026-11-10 | D-034 to D-038 | Setup decisions approved: services layer, pino, cookie strategy, separate test database, Prisma migrations with raw SQL |
| 2026-11-10 | D-039, D-040 | Independent npm projects per folder (no workspaces, no root package); user-managed git, agent runs no git commands |
| 2026-11-10 | D-041 | Backend toolchain pinned: Express 5.3, TypeScript 5.9, Zod 4.6, CommonJS, tsc-alias, tsx, ESLint 10, Prettier 3 |
| 2026-11-10 | D-042 | Prisma 6.19.3 chosen over 7.x (ESM and driver-adapter requirements) and 8 (release candidate) |
| 2026-11-10 | D-043 to D-046 | Schema and seed alignment approved: NPR currency with placeholder prices, 13%/10% outlet defaults, waiter cancel permission, bill cancellation state |
| 2026-11-10 | PD-021 | Added missing invoice title and IRD compliance decision referenced by `DESIGN.md` |
| 2026-11-14 | D-063 | Custom plan request endpoint (`POST /api/v1/plans/subscription/custom-plan-request`) creates a `CustomPlanLead` with `contact_name`, `contact_email`, optional `outlet_count` (1-100), optional `message`. Organization auto-filled from authenticated user. Auth + outlet header required. Validation: email format, name 1-100 chars, outlet_count 1-100, message 2000 chars max. | Implements SUB-03 "Custom plan contact form creates a lead" |
| 2026-11-14 | D-064 | Plan limit check exports and middleware. Added `src/services/plans/index.ts` exporting `getLimits`, `canCreateOutlet`, `canAddStaff`, `canAddMenuItem`. Added `src/middlewares/planLimit.ts` with `planLimitMiddleware('outlet'|'staff'|'menuItem')` factory that checks limits before resource creation, returns 403 `PLAN_LIMIT_REACHED` with current/limit details. Ready for O-003, staff creation, M-002. | Enables S-006 "Plan-limit check helper used by outlets, staff and menu creation" |
| 2026-11-19 | D-065 | Outlet listing endpoints (`GET /api/v1/outlets` and `GET /api/v1/outlets/:id`). Owner sees all organization outlets; Manager/Waiter/Kitchen see only assigned outlets. Supports pagination, `is_active` filter, and search. Cross-tenant access returns 403. | Implements O-001 "List and get outlets the user can access" |
| 2026-11-19 | D-066 | Outlet update endpoint (`PATCH /api/v1/outlets/:id`) updates outlet profile and settings (name, address, phone, timezone, tax_percent, service_charge_percent, is_active). Owner can update all fields; Manager with `tables.manage` permission can update assigned outlets. Requires `X-Outlet-Id` header. Cross-tenant access returns 403. | Implements O-002 "Update outlet profile and settings" |
| 2026-11-19 | D-067 | Outlet creation endpoint (`POST /api/v1/outlets`) creates a new outlet. Owner only, plan-gated by `max_outlets` limit via `planLimitMiddleware`. Returns 403 `PLAN_LIMIT_REACHED` when limit exceeded. Validation for name, address, phone, timezone, tax_percent, service_charge_percent. Requires `X-Outlet-Id` header. Cross-tenant access returns 403. | Implements O-003 "Create outlet (Owner, plan-gated by max_outlets)" |
| 2026-11-19 | D-068 | Outlet deactivation endpoint (`PATCH /api/v1/outlets/:id/deactivate`) sets `is_active=false` to block new orders while preserving history. Owner only; Manager/Waiter/Kitchen rejected with 403. Cross-tenant access returns 403. Requires `X-Outlet-Id` header. | Implements O-004 "Deactivate outlet (blocks new orders, keeps history)" |
| 2026-11-19 | D-069 | Set active outlet endpoint (`PATCH /api/v1/outlets/me/active-outlet`) saves the last active outlet for the current user. Owner can set any outlet in their organization. Manager can only set outlets they are assigned to. Updates user's `last_outlet_id`. Returns 403 for unassigned/cross-tenant outlets, 404 for non-existent outlets. | Implements O-005 "Save last active outlet" |
| 2026-11-19 | D-070 | Tables CRUD endpoints under `/api/v1/outlets/:outletId/tables`: GET (list with pagination/filtering), GET by ID, POST (create), PATCH (update), DELETE (deactivate), POST regenerate-qr. Owner/Manager with `tables.manage` can create/update/deactivate/regenerate QR. Waiter/Kitchen can list/get. QR token auto-generated on create, regenerable. All endpoints require `X-Outlet-Id` header. Cross-tenant access returns 404/403 per tenant isolation rules. | Implements TB-001 "Table CRUD per outlet" |
| 2026-11-19 | D-071 | Public QR token resolution endpoint (`GET /api/v1/public/tables/:qrToken`) resolves a QR token to table, outlet, and effective menu. Returns table details, outlet info, and effective menu with categories and items (including outlet price overrides). Handles inactive/deleted outlets, cross-tenant access, and invalid tokens. No authentication required. Used by guests scanning QR codes at tables. | Implements TB-002 "QR token generation and regeneration" / R-002 "Public: resolve QR token → outlet, table, effective menu" |
| 2026-11-19 | D-072 | QR image endpoint (`GET /api/v1/outlets/:outletId/tables/:id/qr`) returns a PNG image of the QR code for the table using the `qrcode` library (per PD-006). Requires authentication and outlet context. Owner, Manager, and Waiter can access. Returns 404 for non-existent tables, 403 for cross-tenant access, 400 for invalid UUID. Image cached with `Cache-Control: public, max-age=31536000, immutable`. | Implements TB-003 "QR image endpoint" |
| 2026-11-19 | D-073 | Menu Category CRUD endpoints under `/api/v1/menu/categories`: GET (list with pagination/filtering), GET by ID, POST (create), PATCH (update), DELETE (soft delete). Requires `menu.edit` permission (Owner/Manager). Uses new `requireOrgPermission` middleware for org-level permission checks (allows Owner org-wide and Manager outlet-level). Soft delete only allowed if no active menu items. 34 integration tests cover CRUD, filters, permissions, tenant isolation. | Implements M-001 "Category CRUD (org level)" |
| 2026-11-19 | D-074 | Menu Item CRUD endpoints under `/api/v1/menu/items`: GET (list with pagination/filtering by category, active status, vegetarian, search), GET by ID, POST (create), PATCH (update), DELETE (soft delete). Requires `menu.edit` permission (Owner/Manager). Plan-gated by `max_menu_items` limit via `planLimitMiddleware`. Includes options and outlet overrides in detail response. 40 integration tests cover CRUD, filters, permissions, plan limit, tenant isolation. | Implements M-002 "Menu item CRUD (org level, soft delete) with plan limit check" |
| 2026-11-20 | D-075 | Menu Item Options (variants/addons) CRUD endpoints under `/api/v1/menu/items/:menuItemId/options`: GET (list with pagination, kind/is_active filters), GET by ID, POST (create), PATCH (update), DELETE (soft delete). Requires `menu.edit` permission (Owner/Manager). Options have kind (variant/addon), name, price_delta, is_active. 37 integration tests cover CRUD, filters, permissions, tenant isolation. | Implements M-003 "Variants and add-ons (`menu_item_options`)" |
| 2026-11-20 | D-076 | Menu image upload endpoint (`POST /api/v1/menu/items/upload/image`) uploads images to Cloudinary using `multer` with memory storage. Accepts JPEG, PNG, WebP up to 5MB. Returns secure URL, publicId, dimensions, format, bytes. Requires `menu.edit` permission (Owner/Manager). Validation rejects invalid types (GIF, etc.), files >5MB, missing files. 9 integration tests cover valid uploads, validation (type, size, missing file), permissions, tenant isolation. | Implements M-004 "Image upload to Cloudinary (type and size limits)" |
| 2026-11-20 | D-077 | Per-outlet override endpoints: `GET /api/v1/menu/items/:id/outlet-overrides` (list with outlet info) and `PUT /api/v1/menu/items/:id/outlet-overrides` (bulk upsert). Supports price_override, is_available, auto_unavailable per outlet. Owner has org-wide access; Manager limited to assigned outlets. Uses `requireOrgPermission` middleware. 16 integration tests cover CRUD, filters, permissions, tenant isolation. | Implements M-005 "Per-outlet override (price, availability)" |
| 2026-11-20 | D-078 | Manual availability toggle endpoint (`PATCH /api/v1/menu/items/:id/availability`) toggles `is_available` for a menu item at a specific outlet. Creates or updates `MenuItemOutletOverride.is_available`. Requires `item.mark_unavailable` permission (Owner, Manager, Kitchen). Owner has org-wide access; Manager/Kitchen limited to assigned outlets. Uses `requireOrgPermission` middleware and `getAccessibleOutletIds` for outlet access validation. 13 integration tests cover permissions, tenant isolation, validation, edge cases. | Implements M-006 "Manual availability toggle (Manager, Owner, Kitchen)" |
| 2026-11-20 | D-079 | Effective menu query endpoint (`GET /api/v1/menu/effective`) returns the effective menu for the outlet in X-Outlet-Id header. Includes active categories and items with outlet price overrides and availability (respects is_available and auto_unavailable). Uses `outletContextMiddleware` for outlet validation. Accessible by Owner (org-wide), Manager/Waiter/Kitchen (assigned outlets). 28 integration tests cover authentication, role-based access, content filtering, price overrides, availability logic, response structure. | Implements M-007 "Effective menu query for an outlet (item + override + auto_unavailable)" |
