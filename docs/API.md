# API.md — API Contract and Swagger Rules

Base path: `/api/v1`. Swagger UI: `/api/docs`. Raw spec: `/api/docs.json`.
This is the **planned** endpoint list. The agent must not add, rename or remove endpoints without asking the user, and must update this file when an endpoint is built or changed.

---

## 1. Swagger rules

1. Swagger is **generated from Zod schemas** (D-006). No hand-written comment blocks.
2. Each route registers itself in the OpenAPI registry next to its Zod schema (`validations/<module>/*.schema.ts` → registered in `src/docs/`).
3. A new or changed endpoint is not done until its Swagger entry exists: summary, tags, auth requirement, params, query, body, success and error responses.
4. Tags = module names. Security schemes: cookie auth for staff; guest cookie for public routes.
5. The `X-Outlet-Id` header is documented as a required header on outlet-scoped routes.
6. Examples are included for request bodies of non-trivial endpoints.
7. Tests check that every registered route appears in the OpenAPI document.
8. The frontend API client types may be derived from the same schemas; ask the user before introducing code generation.

## 2. Conventions

- Envelopes and status codes: see `TRD.md` section 3.
- Auth column: **Public**, **Guest**, **Auth** (logged in), or a permission code. All outlet-scoped routes need `X-Outlet-Id` (marked **O**).
- Pagination: `page`, `limit`. Filtering and sorting via query params defined in each schema.
- Idempotency: `Idempotency-Key` header on order creation and payment initiation (PD-019).
- **Audit log:** Sensitive actions write append-only rows via the internal `audit` helper (`src/services/audit/audit.service.ts`). No public endpoint; helpers called from services/controllers.
- **Plan limits:** Internal helper `getLimits(organization)` in `src/services/plans/plan.service.ts` merges plan base values with subscription overrides. `null` limits mean unlimited. Used by `canCreateOutlet`, `canAddStaff`, `canAddMenuItem` to enforce limits, ignoring soft-deleted resources. Only the latest active subscription (trialing/active/grace) is considered.
- **Subscription guard:** Middleware `subscriptionGuardMiddleware` in `src/middlewares/subscriptionGuard.ts` runs after auth, before outletContext. Checks org subscription status: trialing/active = full access; grace = read-only (mutations 403 `SUBSCRIPTION_READ_ONLY`); suspended/cancelled = all blocked (403 `SUBSCRIPTION_SUSPENDED`); no subscription = mutations blocked (403 `FORBIDDEN`). Exempts `/health`, `/auth/*`, `/docs*`.
- **Subscription details:** `GET /api/v1/plans/subscription` returns plan, status, trial/grace dates, override limits, and actual usage vs limits for outlets, staff, and menu items. Protected by `billing.manage` permission + subscription guard. Usage counts actual outlets (non-deleted), active staff with assignments, and active menu items.
- **Trial expiry job:** Daily BullMQ job (`trial-expiry-check`) runs at 01:00 UTC. Processes: 1) Sends 3-day and 1-day reminder emails before trial ends, 2) Moves expired trials to grace (sets `grace_ends_at` = 7 days), sends notification, 3) Moves expired grace to suspended, sends notification. Uses `emailService` with templates (`trialExpiryReminder`, `trialExpired`, `trialSuspended`).
- **Custom plan request:** `POST /api/v1/plans/subscription/custom-plan-request` creates a lead (`CustomPlanLead`) with `contact_name`, `contact_email`, optional `outlet_count` (1-100), and optional `message`. Organization ID is auto-filled from authenticated user. Protected by auth + outlet header. Validation rejects invalid emails, empty names, out-of-range outlet_count, and overlong fields.
- **Plan limit middleware:** `planLimitMiddleware('outlet'|'staff'|'menuItem')` in `src/middlewares/planLimit.ts` checks plan limits before resource creation. Returns 403 `PLAN_LIMIT_REACHED` with current usage and limit details. Attaches `req.planLimitInfo` for controller use. Used by outlet creation, staff creation, and menu item creation endpoints.
- **Outlet update:** `PATCH /api/v1/outlets/:id` updates outlet profile and settings (name, address, phone, timezone, tax_percent, service_charge_percent, is_active). Owner can update all fields; Manager with `tables.manage` permission can update assigned outlets. Requires `X-Outlet-Id` header.
- **Outlet creation:** `POST /api/v1/outlets` creates a new outlet. Owner only, plan-gated by `max_outlets` limit via `planLimitMiddleware`. Returns 403 `PLAN_LIMIT_REACHED` when limit exceeded. Validation for name, address, phone, timezone, tax_percent, service_charge_percent. Requires `X-Outlet-Id` header.
- **Outlet deactivation:** `PATCH /api/v1/outlets/:id/deactivate` sets `is_active=false` to block new orders while preserving history. Owner only; Manager/Waiter/Kitchen rejected with 403. Cross-tenant access returns 403. Requires `X-Outlet-Id` header.
- **Set active outlet:** `PATCH /api/v1/outlets/me/active-outlet` saves the last active outlet for the current user. Owner can set any outlet in their organization. Manager can only set outlets they are assigned to. Updates user's `last_outlet_id`. Requires `outlet_id` in body. Returns 403 for unassigned/cross-tenant outlets, 404 for non-existent outlets.

---

## 3. Endpoint catalogue

### Health
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | Public | API, DB and Redis status |

### Auth
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | Public | Create organization, default outlet, owner, trial |
| POST | `/auth/verify-email` | Public | Verify email token |
| POST | `/auth/resend-verification` | Public | Resend verification email |
| POST | `/auth/login` | Public | Login, set cookies |
| POST | `/auth/refresh` | Cookie | Rotate refresh token |
| POST | `/auth/logout` | Auth | Revoke current token family |
| POST | `/auth/logout-all` | Auth | Revoke all token families |
| POST | `/auth/forgot-password` | Public | Send reset email |
| POST | `/auth/reset-password` | Public | Set new password with token |
| GET | `/auth/me` | Auth | Current user, assignments, permissions |
| POST | `/auth/accept-invite` | Public | Accept staff invitation |

Accept-invite takes `{ token, full_name, password }` (password minimum 8 characters). It creates the account in the inviting organization, assigns the invited role and outlet, marks the invitation accepted, and sets the normal access and refresh cookies. Unknown, revoked, expired or already-used tokens return 400; an already accepted invitation or any existing account email returns 409.

### Outlets
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/outlets` | Auth | Outlets the user can access |
| POST | `/outlets` | Owner, plan-gated | Add outlet |
| GET | `/outlets/:id` | Auth (assigned) | Outlet details |
| PATCH | `/outlets/:id` | `tables.manage` or owner | Update profile and settings |
| PATCH | `/outlets/:id/deactivate` | Owner | Deactivate outlet |
| PATCH | `/me/active-outlet` | Owner, Manager | Save last active outlet |

### Staff (O)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/staff` | `staff.manage` | List staff |
| POST | `/staff/invitations` | `staff.manage` | Invite by email, role, outlet |
| GET | `/staff/invitations` | `staff.manage` | List invitations |
| DELETE | `/staff/invitations/:id` | `staff.manage` | Revoke invitation |
| PATCH | `/staff/:id/role` | `staff.manage` | Change role |
| PUT | `/staff/:id/assignments` | `staff.manage` | Set outlet assignments (Manager may have many; others one) |
| PATCH | `/staff/:id/deactivate` | `staff.manage` | Deactivate and revoke tokens |

Invitation bodies are `{ email, role, outlet_id? }`; `outlet_id` defaults to `X-Outlet-Id` and must be omitted for Owner invitations. Invitations expire after 7 days, and re-inviting an email replaces its pending invitation. Any existing account email is rejected with 409. Managers only see and target outlets they are assigned to. `GET /staff/invitations` accepts `status`, `page` and `limit`.

`GET /staff` returns every staff member in the organization for an Owner, or anyone assigned to a managed outlet for a Manager, with all role/outlet assignments. It accepts `status`, `role`, `page` and `limit`. `PATCH /staff/:id/role` takes `{ role }`: Owner is organization-wide, demoting an Owner places them at `X-Outlet-Id`, and Waiter/Kitchen keep one assignment. Managers cannot change Owners, staff outside their outlets, or grant a role above their own; the last active Owner cannot be demoted. `PATCH /staff/:id/deactivate` sets the account inactive and revokes its refresh tokens; self-deactivation and Manager-to-Owner deactivation are rejected. `PUT /staff/:id/assignments` takes `{ outlet_ids }` and replaces assignments; Owner is rejected (organization-wide), Waiter/Kitchen must receive exactly one, Manager may receive many; Managers can only assign outlets they manage.

### Tables (O)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/tables` | Auth | List tables with status |
| POST | `/tables` | `tables.manage` | Create |
| PATCH | `/tables/:id` | `tables.manage` | Update |
| DELETE | `/tables/:id` | `tables.manage` | Deactivate |
| POST | `/tables/:id/regenerate-qr` | `tables.manage` | New QR token |
| GET | `/tables/:id/qr` | `tables.manage` | QR image (format per PD-006) |

### Menu
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/menu/categories` | Auth | List categories |
| POST | `/menu/categories` | `menu.edit` | Create |
| PATCH | `/menu/categories/:id` | `menu.edit` | Update |
| DELETE | `/menu/categories/:id` | `menu.edit` | Delete (blocked if items exist) |
| GET | `/menu/items` | Auth, **O** | Effective menu for the outlet (item + override + availability) |
| POST | `/menu/items` | `menu.edit` | Create item |
| GET | `/menu/items/:id` | Auth | Item details |
| PATCH | `/menu/items/:id` | `menu.edit` | Update item |
| DELETE | `/menu/items/:id` | `menu.edit` | Soft delete |
| PUT | `/menu/items/:id/options` | `menu.edit` | Replace variants and add-ons |
| PUT | `/menu/items/:id/outlet-override` | `menu.edit` (**O**, PD-018) | Price and availability for this outlet |
| PATCH | `/menu/items/:id/availability` | `item.mark_unavailable` (**O**) | Manual toggle |
| POST | `/uploads/menu-image` | `menu.edit` | Upload image to Cloudinary |

### Public (guest)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/public/tables/:qrToken` | Public | Resolve outlet and table, return effective menu |
| POST | `/public/sessions` | Public | Start or join table session, set guest cookie |
| GET | `/public/sessions/current` | Guest | Session details and orders |
| POST | `/public/orders` | Guest | Place order (becomes `pending_confirmation`) |
| GET | `/public/orders/:id` | Guest | Order status (own session only) |
| POST | `/public/sessions/current/bill-request` | Guest | Request the bill |
| POST | `/public/payments/esewa/initiate` | Guest | Start eSewa payment for the session bill |
| POST | `/public/payments/esewa/verify` | Guest | Verify eSewa callback data |

### Orders and sessions (O)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/orders` | Auth | List/filter (status, table, date) |
| GET | `/orders/:id` | Auth | Order details |
| POST | `/orders` | `order.create` | Place order for a table (auto-confirmed) |
| PATCH | `/orders/:id/confirm` | `order.update_status` | Confirm pending guest order |
| PATCH | `/orders/:id/reject` | `order.update_status` | Reject with reason |
| PATCH | `/orders/:id/status` | `order.update_status` | Move through allowed transitions |
| PATCH | `/orders/:id/cancel` | `order.cancel` | Cancel with reason (PD-008) |
| PATCH | `/order-items/:id/status` | `order.update_status` | Item-level status |
| GET | `/kitchen/orders` | `order.update_status` | Live kitchen board data |
| GET | `/sessions` | Auth | Open sessions per table |
| POST | `/sessions/:id/bill` | `payment.record` | Generate or refresh bill |
| POST | `/sessions/:id/close` | `payment.record` | Close after payment |

### Payments (O)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/payments/cash` | `payment.record` | Record cash payment |
| POST | `/payments/esewa/initiate` | `payment.record` | Staff-initiated eSewa payment |
| POST | `/payments/esewa/verify` | `payment.record` | Verify and finalize |
| GET | `/payments` | `payment.record` | Payment list |
| GET | `/settings/payments/esewa` | Owner | Settings (secret never returned) |
| PUT | `/settings/payments/esewa` | Owner | Save product code and secret (encrypted) |

### Inventory (O)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/inventory/ingredients` | `inventory.view` | List ingredients |
| POST | `/inventory/ingredients` | `inventory.manage` | Create |
| PATCH | `/inventory/ingredients/:id` | `inventory.manage` | Update |
| PUT | `/menu/items/:id/recipe` | `inventory.manage` | Set recipe |
| GET | `/inventory/stock` | `inventory.view` | Stock per ingredient at this outlet |
| PATCH | `/inventory/stock/:ingredientId/threshold` | `inventory.manage` | Set low threshold |
| POST | `/inventory/restock` | `inventory.restock` | Add stock |
| POST | `/inventory/adjust` | `inventory.adjust` | Correct count |
| POST | `/inventory/wastage` | `inventory.wastage` | Log wastage |
| GET | `/inventory/movements` | `inventory.view` | Movement history |

### Analytics (O unless stated)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/analytics/summary` | `analytics.view` | Revenue, orders, average order value |
| GET | `/analytics/revenue` | `analytics.view` | Revenue by day |
| GET | `/analytics/top-items` | `analytics.view` | Best sellers |
| GET | `/analytics/peak-hours` | `analytics.view` | Orders by hour |
| GET | `/analytics/inventory` | `analytics.view` | Stock, wastage, usage |
| GET | `/analytics/consolidated` | Owner (no outlet header) | All outlets with breakdown |

### Subscription
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/subscription` | `billing.manage` | Plan, status, usage vs limits |
| POST | `/subscription/custom-plan-request` | Auth | Contact-us lead |
| POST | `/subscription/payments` | `billing.manage` | Submit renewal reference (PD-013) |
| GET | `/subscription/payments` | `billing.manage` | History |

### Notifications (O)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/notifications` | Auth | List |
| PATCH | `/notifications/:id/read` | Auth | Mark read |
| PATCH | `/notifications/read-all` | Auth | Mark all read |

### Super Admin (`/admin`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/admin/organizations` | Super Admin | List and filter |
| PATCH | `/admin/organizations/:id/status` | Super Admin | Suspend or reactivate |
| GET | `/admin/plans` | Super Admin | List plans |
| POST | `/admin/plans` | Super Admin | Create plan |
| PATCH | `/admin/plans/:id` | Super Admin | Update plan |
| PATCH | `/admin/subscriptions/:id` | Super Admin | Overrides, extend trial, change plan |
| GET | `/admin/subscription-payments` | Super Admin | Pending renewal references |
| PATCH | `/admin/subscription-payments/:id` | Super Admin | Approve or reject |
| GET | `/admin/leads` | Super Admin | Custom plan leads |
| PATCH | `/admin/leads/:id` | Super Admin | Mark handled |
| GET | `/admin/stats` | Super Admin | Platform stats |

---

## 4. Socket events

Defined in `TRD.md` section 6. Event payload types live in `backend/src/sockets/events.ts` and are mirrored in the frontend `types/`. Document payloads here when each event is implemented.

## 5. Standard error codes

`VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `PLAN_LIMIT_REACHED`, `SUBSCRIPTION_READ_ONLY`, `SUBSCRIPTION_SUSPENDED`, `ITEM_UNAVAILABLE`, `INSUFFICIENT_STOCK`, `INVALID_STATE_TRANSITION`, `PAYMENT_VERIFICATION_FAILED`, `PAYMENT_PENDING`, `INTERNAL_ERROR`.
New codes require a line added here.

Validation failures return `400` with `VALIDATION_ERROR`. `details` is an array of `{ "path": "...", "message": "..." }`; `path` begins with `body`, `query` or `params`, followed by the field path (for example `body.items.0.name`).
