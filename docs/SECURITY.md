# SECURITY.md

Security is part of every task, not a final step. If a task touches auth, tenancy, permissions, payments or uploads, re-read this file first. Pending choices are marked **(PD-xxx)**.

---

## 1. Threat focus for Bansa

| Threat | Why it matters here |
|---|---|
| Cross-tenant data access | One restaurant reading another's orders, menu, stock |
| Privilege escalation | Waiter acting as manager; manager changing owner |
| Prank or fake guest orders | QR codes are public |
| Payment tampering | Fake eSewa success redirect, amount changes |
| Token theft or replay | Cookie and refresh-token abuse |
| Secret leakage | Stored eSewa credentials, env secrets |
| Abuse of public endpoints | Spam orders, scraping, brute force |

---

## 2. Authentication

- Passwords hashed with **argon2id** (PD-002). Never store or log plain passwords.
- Password policy: minimum 8 characters; reject very common passwords. No composition rules that force weak patterns.
- Login: generic error ("invalid email or password"), constant-time comparison, rate limited per IP and per email, temporary lockout after repeated failures.
- Email must be verified before dashboard access.
- Access token: JWT, 15 minutes, httpOnly, Secure, SameSite cookie. Never in localStorage.
- Refresh token: random 256-bit value, stored **hashed**, 7 days, httpOnly Secure cookie scoped to the auth routes (`/api/v1/auth`) so logout can revoke the current family.
- **Rotation + reuse detection:** every refresh issues a new token; reuse of an old one revokes the whole family and forces login.
- **Revocation:** logout, logout-all, password change, password reset and user deactivation revoke refresh tokens.
- Password reset and verification tokens: random, hashed in DB, single use, short expiry (e.g. 1 hour reset, 24 hours verify), previous tokens invalidated on new request.
- Reset and verify endpoints never reveal whether an email exists.
- Cookies and CSRF: PD-004. Mutating requests require the agreed CSRF defense.

## 3. Authorization

- Check **permission codes** at the outlet: `can(user, outlet, permission)`. Never check role names in controllers.
- `X-Outlet-Id` is untrusted. The middleware verifies the assignment on every request.
- Owner can access outlets only inside their own organization.
- Manager can manage staff but never create, edit or remove Owners, and cannot grant a role higher than their own.
- Waiter and Kitchen have exactly one outlet assignment (service-level rule, tested).
- Super Admin routes require `is_super_admin` and live under `/api/v1/admin`; they are not reachable with normal tokens.
- Discounts and price overrides need explicit permission and write an audit log.
- Deny by default: a route without a permission declaration is rejected in tests.

## 4. Multi-tenant isolation

- Every model function takes the tenant id and filters by it. No unscoped `findMany`/`update`/`delete` on tenant data.
- Never accept `organization_id` or `outlet_id` from the request body for authorization; derive from the authenticated context.
- Fetch-by-id queries always include the tenant filter (`where: { id, outletId }`), preventing IDOR.
- Socket rooms are joined only after verifying the outlet assignment. Events never carry another outlet's data.
- Mandatory automated tests: user A cannot read, write or delete outlet B's resources for every module (see `TESTING.md`).
- Optional second layer: PostgreSQL Row-Level Security (ask the user first).

## 5. Public (guest) endpoints

- QR tokens: at least 32 random bytes, URL-safe, unique, regenerable. They identify a table, not a person.
- Guest `guest_token`: random, httpOnly cookie, bound to a table session.
- Guests cannot set prices, totals, statuses or outlet ids. The server computes everything.
- **Waiter confirmation is always required** before an order reaches the kitchen or touches stock.
- Rate limits: per IP, per QR token and per session (order count and frequency). Reject oversized carts and quantities.
- Public responses expose only what a guest needs (no staff data, no internal ids beyond what is needed).
- Sessions cannot be hijacked across tables: a guest token only works for its own session.

## 6. Payments (eSewa)

- Verify the HMAC-SHA256 signature of the response using the fields the response lists as signed; compare in constant time.
- Match `transaction_uuid`, `total_amount` and `product_code` to the pending payment. Reject mismatches.
- A success redirect alone never marks a payment paid. **Call the status check API first.**
- Idempotent processing: unique `transaction_uuid` and idempotency keys; repeated callbacks do nothing twice.
- Status check timeout means "unknown", not "failed". Keep `pending` and let the reconcile job retry.
- Merchant credentials are stored **encrypted** (AES-256-GCM, key from env; PD-012). Decrypt only in the payment service, never return secrets in API responses, never log them.
- Use sandbox credentials in test mode; separate switch per outlet.
- Amounts are computed server-side from the bill, never from the client.
- Cash payments need `payment.record` and write an audit log.

## 7. Input validation and output

- Zod validates params, query and body on every route; unknown fields are stripped or rejected.
- Use Prisma parameterized queries. Raw SQL only with parameters (`$queryRaw` tagged templates).
- Escape or sanitize user-provided text shown in emails and pages. React escapes by default; do not use `dangerouslySetInnerHTML` without approval.
- Uploads: allow only image types (jpeg, png, webp), verify MIME and size (e.g. max 5 MB), randomize file names, store only on Cloudinary, strip metadata where supported.
- Error responses never include stack traces, SQL or secrets.

## 8. Transport and HTTP hardening

- HTTPS everywhere in production; HSTS.
- `helmet` defaults with a CSP agreed for Next.js and Cloudinary.
- CORS: allowlist of the frontend origin(s) with credentials. No wildcard.
- Body size limits (e.g. 100 KB JSON).
- Rate limiting backed by Redis: global, auth routes (strict), public routes (strict), upload routes.
- Cookie flags: `httpOnly`, `Secure`, `SameSite=Lax` (or as decided in PD-004), correct `Domain`/`Path`.

## 9. Secrets and configuration

- No secrets in git. `.env.example` has names only.
- Env vars validated by Zod at startup.
- Different secrets per environment. Rotate JWT and encryption keys by documented procedure (agent asks before implementing rotation).
- Seed Super Admin password comes from env and must be changed on first login.

## 10. Logging and audit

- Structured logs with request id. Never log passwords, tokens, cookies, secret keys, full eSewa signatures.
- Audit log (`audit_logs`) for: staff invites and removals, role changes, price and menu changes, discounts, payment overrides, plan and subscription changes, Super Admin actions, login failures worth tracking.
- Audit rows are append-only.

## 11. Dependencies and CI

- Run `npm audit` in CI and review high/critical findings.
- Pin dependency versions; use lockfiles.
- Prefer well-maintained packages; ask before adding a new one (see `AGENT.md`).
- Be careful with very new package versions; prefer releases that have been out for a couple of weeks.

## 12. Privacy

- Collect minimum personal data (guests: optional name and phone only if needed).
- Do not log or expose staff or guest PII unnecessarily.
- Provide a way to deactivate users; deletion and retention policy to be agreed with the user before launch.

## 13. Security review checklist (per task)

- [ ] Tenant filter present on every query
- [ ] Permission code declared and tested
- [ ] Input validated by Zod
- [ ] No secrets or tokens in logs or responses
- [ ] Rate limit applied where the endpoint is public or sensitive
- [ ] Negative tests (wrong tenant, wrong role, bad input) written
- [ ] Audit log written for sensitive actions
