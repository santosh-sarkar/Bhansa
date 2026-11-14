# TESTING.md

Approach (D-015): write tests for every task and **run the script**. Backend: Jest + Supertest (switched from Vitest at T-010 due to environment AppLocker blocking native .node modules). Frontend: Vitest + React Testing Library. No Playwright. Test database: separate Neon database `Bhansa_test` (PD-016 resolved).

---

## 1. Rules

1. Every task ships with tests (workflow step 3) and a real test run (step 5).
2. Never claim tests pass without running them. Paste the summary in the end-of-task report.
3. Never delete, skip or weaken a test to get green. If a test seems wrong, ask the user.
4. Tests are deterministic: no real network calls, no real Cloudinary, Resend or eSewa. Mock them at the boundary.
5. Each test file is small and named after what it tests.
6. Tests use factories, not copy-pasted setup.

---

## 2. Layout

```
backend/tests/
├─ unit/          # services, utils (pure logic, mocked models)
├─ integration/   # routes via Supertest against the test database
└─ helpers/       # factories, test DB reset, auth and cookie helpers, tenant helper

frontend/tests/   # mirrors src/features: controllers (hooks) and key views
```

File names: `<thing>.test.ts` (or `.test.tsx`).

## 3. Scripts

`backend/` and `frontend/` are independent npm projects, each with its own `package.json`. There is no root package: run the test command in each folder.

```
backend/   npm test                # run all with coverage
           npm run test:unit      # unit tests only
           npm run test:integration  # integration tests only
           npm run test:watch     # watch mode
           npm run test:coverage  # explicit coverage run
frontend/  npm test
```

CI runs lint, type-check and the test command of both folders on every pull request.

---

## 4. Test database

- Separate PostgreSQL database for tests (`TEST_DATABASE_URL`), hosted on Neon (not Docker Compose; PD-016 resolved to Neon).
- Migrations applied via `globalSetup` before the run; seed data for roles, permissions and plans loaded once.
- Each test file starts from a clean state: `beforeAll` truncates all public tables and re-seeds reference data.
- Redis: use a separate Redis database index or a mock for rate-limit and queue tests.

---

## 5. What every backend task must test

| Area | Required tests |
|---|---|
| **Happy path** | Correct status code, response envelope, DB state |
| **Validation** | Missing, wrong type, too long, unknown fields → `VALIDATION_ERROR` |
| **Authentication** | No cookie or expired token → 401 |
| **Authorization** | Each role without the permission → 403; roles with it → success |
| **Tenant isolation** | User in outlet A cannot read, update or delete outlet B's resource (404 or 403); wrong `X-Outlet-Id` rejected |
| **Plan and subscription** | Limits enforced; grace is read-only; suspended blocked (where relevant) |
| **Business rules** | Each rule from `PRD.md` section 7 that the task touches |
| **Audit** | Sensitive actions create an audit row |
| **Swagger** | The route appears in the OpenAPI document |

Use the tenant-isolation helper from A-011 so each module gets the same checks cheaply. `tests/helpers/tenant.ts` provides `createIsolatedTenants()` (two organizations with outlets and one verified user per role), `createSession(user, outletId)` (a real access cookie), `tenantApi(app, session)` (sends the cookie and `X-Outlet-Id`; `.at(outletId)` switches the header without changing the user) and `expectTenantDenied(response)` (accepts 403 or 404 as long as the failure envelope is used).

---

## 6. Critical test suites

These get extra depth because they carry the most risk.

**Auth**
- Register creates organization, default outlet, owner, trial in one transaction (rollback on failure).
- Unverified email cannot log in.
- Refresh rotation: old token stops working; **reusing an old token revokes the whole family**.
- Logout and logout-all revoke tokens; reset password revokes tokens.
- Login rate limit and lockout.

**Permissions**
- Table-driven test over the PRD permission matrix: every role × every permission code.
- Manager cannot modify an Owner or grant a higher role.
- Waiter and Kitchen cannot hold two outlet assignments; Manager can.
- Only Owner and Manager can call outlet-switching endpoints.

**Ordering**
- Guest order always starts as `pending_confirmation` and is not visible on the kitchen board.
- Server ignores client-sent prices and totals.
- Allowed and forbidden state transitions (table-driven).
- Guest token cannot read or add orders in another session.
- Public rate limits trigger 429.
- Idempotency key prevents duplicate orders (PD-019).

**Inventory**
- Confirm deducts stock per recipe and writes movements with `balance_after`.
- Insufficient stock rolls back the whole confirmation.
- Cancel restores stock per PD-008.
- Item becomes auto-unavailable at zero and available after restock.
- **Concurrency:** two simultaneous confirmations for the last ingredient; exactly one succeeds, stock never negative (I-011).
- Kitchen can adjust and log wastage but cannot change recipes or thresholds.

**Payments (eSewa)**
- Signature generation matches a known test vector (build the vector from eSewa's documented sample when implementing PAY-004; do not invent one).
- Verification rejects: bad signature, tampered amount, wrong `transaction_uuid`, wrong product code, missing fields.
- Success redirect without a successful status check does **not** mark the payment paid.
- Status-check timeout leaves the payment `pending`; reconcile job later completes it.
- Duplicate callbacks are idempotent: one payment, one session close.
- Secrets are never present in API responses or logs.
- eSewa HTTP calls are mocked.

**Subscription**
- Trial expiry job moves trialing → grace → suspended at the right times (use fake timers).
- Plan limits (outlets, staff, menu items) enforced on the server.
- Downgrade blocked while outlets exceed the limit.

**Multi-outlet**
- Owner sees only own organization's outlets; consolidated analytics sum correctly across outlets.
- Menu override changes price for one outlet only.
- Deactivated outlet rejects new orders but still appears in reports.

---

## 7. Frontend testing

- Test controllers (hooks) with mocked API and Query client.
- Test key views: forms (validation messages, submit), guest cart, kitchen board rendering and live update handling, permission-based sidebar.
- Mock Socket.IO client in tests.
- Each view test covers loading, empty, error and success states.
- No snapshot spam; assert on behavior and visible text.

---

## 8. Coverage

Coverage is a guide, not a goal. Proposed targets (confirm with the user at T-010): 80% lines on services and models; critical suites above must be complete regardless of the number.

## 9. Manual checks before the demo

- Run the full guest-to-payment flow with eSewa **sandbox**.
- Test on a real phone for the guest menu and the kitchen tablet layout.
- Check cookies and CORS on the deployed domains.
- Run the load test (D-004).

## 10. End-of-task test report

```
Command: npm run test:integration -- order
Result: 24 passed, 0 failed, 0 skipped
New tests: <list files>
Notes: <anything flaky or skipped, with reason>
```
