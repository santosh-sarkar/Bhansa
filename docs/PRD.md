# PRD.md — Product Requirements Document

**Product:** Bansa
**Type:** Multi-outlet restaurant management SaaS (QR ordering, kitchen display, inventory, billing)
**Market:** Nepal (NPR, eSewa)
**Version:** v1

---

## 1. Overview

Bansa lets a restaurant business run its dining operation from one platform. Guests scan a table QR code, browse the menu, and order without an account. Waiters confirm orders, the kitchen sees them live, inventory updates automatically, and the bill is paid by cash or eSewa. Owners manage one or many outlets and see analytics.

## 2. Goals

1. Fast, simple QR ordering for dine-in guests.
2. Real-time flow from guest to waiter to kitchen.
3. Accurate inventory with manual and automatic tracking.
4. Multi-tenant SaaS with plans, trial, and multi-outlet support from v1.
5. Production-quality engineering suitable for a portfolio (security, tests, docs, deployment).

## 3. Non-goals (v1)

Delivery riders, Cashier role, supplier and purchase orders, reservations, customer accounts and loyalty, PWA/offline mode, multi-language UI, inter-outlet stock transfers, automatic recurring subscription billing.

---

## 4. Users and roles

| Role | Scope | Summary |
|---|---|---|
| **Super Admin** | Platform | Manages organizations, plans, subscriptions, leads, platform stats |
| **Owner** | Organization (all outlets) | Full control, billing, staff, analytics, outlet management |
| **Manager** | One or more assigned outlets | Daily operations; menu, tables, inventory, staff (not owners), reports |
| **Waiter** | Exactly one outlet | Tables, confirm guest orders, place orders, serve, bill, payment |
| **Kitchen** | Exactly one outlet | Live order board, item status, stock updates, wastage |
| **Guest Customer** | A table session | No login. Scans QR, orders, tracks, requests bill, pays |

**Outlet switching:** only Owner and Manager can switch outlets. Waiter and Kitchen are tied to one outlet.

### Permission matrix

| Action (permission code) | Owner | Manager | Waiter | Kitchen |
|---|:-:|:-:|:-:|:-:|
| Billing and subscription (`billing.manage`) | ✅ | ❌ | ❌ | ❌ |
| Manage staff (`staff.manage`) | ✅ | ✅ (not owners) | ❌ | ❌ |
| Edit menu (`menu.edit`) | ✅ | ✅ (see PD-018) | ❌ | ❌ |
| Manage tables and QR (`tables.manage`) | ✅ | ✅ | ❌ | ❌ |
| Place or edit orders (`order.create`) | ✅ | ✅ | ✅ | ❌ |
| Update order status (`order.update_status`) | ✅ | ✅ | ✅ (served, confirm) | ✅ (preparing, ready) |
| Cancel orders (`order.cancel`) | ✅ | ✅ | ✅ (rules in PD-008) | ❌ |
| Generate bills and record payments (`payment.record`) | ✅ | ✅ | ✅ | ❌ |
| View analytics (`analytics.view`) | ✅ | ✅ | ❌ | ❌ |
| Manage ingredients and recipes (`inventory.manage`) | ✅ | ✅ | ❌ | ❌ |
| Restock (`inventory.restock`) | ✅ | ✅ | ❌ | ❌ |
| Adjust stock (`inventory.adjust`) | ✅ | ✅ | ❌ | ✅ |
| Log wastage (`inventory.wastage`) | ✅ | ✅ | ❌ | ✅ |
| View inventory and alerts (`inventory.view`) | ✅ | ✅ | ❌ | ✅ |
| Mark item or ingredient unavailable (`item.mark_unavailable`) | ✅ | ✅ | ❌ | ✅ |

The seed data in `restaurant_saas_schema.sql` implements this matrix. Permission checks are always by code, not role name.

---

## 5. Plans and trial

| Plan | Outlets | Notes |
|---|---|---|
| **Trial** | 1 | 14 days, full features, no card. After expiry: 7-day read-only grace, then suspended |
| **Single Outlet** | 1 | Fixed monthly price |
| **Custom / Multi-Outlet** | N (set per organization) | Contact-us flow creates a lead; Super Admin configures limits |

- Limits (`max_outlets`, `max_staff`, `max_menu_items`, feature flags) live in plan records and can be overridden per subscription.
- Limits are enforced in the **backend**; the UI only hides controls.
- Read-only grace: data stays visible, new orders and edits are blocked, upgrade prompt shown.
- Super Admin can extend a trial manually.
- Downgrade is blocked while active outlets exceed the new plan limit.
- Renewals are manual: reminder emails before expiry, owner pays and submits a reference, Super Admin approves (PD-013).

---

## 6. Functional requirements

IDs are used by `TASK.md` and tests.

### 6.1 Auth and tenancy (AUTH)
- AUTH-01 Owner registers; system creates organization, default outlet "Main Branch", trial subscription, in one transaction.
- AUTH-02 Email verification required before login to the dashboard; resend supported.
- AUTH-03 Login with email and password; JWT access token plus rotating refresh token in httpOnly cookies.
- AUTH-04 Refresh-token reuse is detected and revokes the token family.
- AUTH-05 Logout (current device) and logout-all (revoke everything).
- AUTH-06 Forgot and reset password by email.
- AUTH-07 Owner/Manager invite staff by email with a role and outlet; invitation expires.
- AUTH-08 Every outlet-scoped request carries `X-Outlet-Id`; backend verifies the user's assignment.

### 6.2 Outlets and tables (OUT, TBL)
- OUT-01 Edit outlet profile and settings (address, phone, timezone, VAT %, service charge %).
- OUT-02 Owner can add outlets within plan limits; can deactivate (history kept, new orders blocked).
- OUT-03 Owner/Manager see an outlet switcher when they have more than one outlet; last outlet is remembered.
- TBL-01 CRUD tables per outlet.
- TBL-02 Each table has an unguessable QR token; can be regenerated.
- TBL-03 Download or print the QR code for a table.

### 6.3 Menu (MENU)
- MENU-01 Categories and items at org level (name, description, image, price, veg flag, prep time).
- MENU-02 Variants and add-ons with price changes.
- MENU-03 Per-outlet override for price and availability.
- MENU-04 Manual availability toggle by Manager, Owner, Kitchen.
- MENU-05 Items become auto-unavailable when a required ingredient hits zero, and return when restocked.
- MENU-06 Menu item count respects the plan limit.

### 6.4 Guest ordering (GST)
- GST-01 Scanning a QR opens that outlet's menu with the table preselected (server-rendered, mobile first).
- GST-02 Guest starts or joins the table's open session without logging in.
- GST-03 Guest builds a cart and places an order; **the server computes all prices**.
- GST-04 Guest orders start as **pending confirmation** and are invisible to the kitchen until a waiter confirms.
- GST-05 Guest sees live status: pending confirmation, placed, preparing, ready, served.
- GST-06 Guest can add more orders to the same session.
- GST-07 Guest can request the bill and pay by eSewa, or ask the waiter for cash.
- GST-08 Public endpoints are rate limited per IP, QR token and session.

### 6.5 Staff order handling (ORD)
- ORD-01 Waiter sees pending orders per table and can **confirm** or **reject** (with reason). **Always on in v1.**
- ORD-02 Waiter or Manager can place an order for a table; it is auto-confirmed.
- ORD-03 Kitchen board shows confirmed orders live: placed → preparing → ready.
- ORD-04 Waiter marks items or orders served.
- ORD-05 Cancellation follows PD-008 rules; every cancel records who and why.
- ORD-06 Table status follows the session: free, occupied, needs bill.
- ORD-07 Order status lifecycle and order numbering follow `ARCHITECTURE.md`.

### 6.6 Inventory (INV)
- INV-01 Ingredients (name, unit, cost) at org level; stock quantities and low thresholds per outlet.
- INV-02 Recipes link menu items to ingredients and quantities.
- INV-03 Restock by Owner or Manager (quantity, cost, supplier, date).
- INV-04 Stock adjustment and wastage by Owner, Manager, Kitchen.
- INV-05 Auto deduction when an order is **confirmed**, in one transaction with row locks.
- INV-06 Auto restore when an order is cancelled (per PD-008).
- INV-07 Every change creates a stock movement record (who, what, how much, why, when).
- INV-08 Low-stock alerts to Owner and Manager (in-app, real-time, email).
- INV-09 Stock never goes negative (also enforced by a DB constraint).

### 6.7 Billing and payments (PAY)
- PAY-01 Bill per table session: subtotal, VAT, service charge, discount (needs permission), total.
- PAY-02 Cash payment recorded by staff; closes the session and frees the table.
- PAY-03 eSewa payment using the restaurant's own merchant credentials (stored encrypted).
- PAY-04 eSewa result is trusted only after signature verification and status check; processing is idempotent.
- PAY-05 Pending eSewa payments are reconciled by a background job.
- PAY-06 Printable invoice (PD-007).

### 6.8 Analytics (ANA)
- ANA-01 Per outlet: revenue by day, order count, average order value, top items, peak hours, payment method split.
- ANA-02 Inventory report: current stock, low stock, wastage, usage.
- ANA-03 Owner consolidated dashboard across all outlets with per-outlet breakdown and outlet filter.

### 6.9 Subscription (SUB)
- SUB-01 Owner sees plan, status, trial end, usage versus limits.
- SUB-02 Trial expiry job: trialing → grace → suspended, with reminder emails.
- SUB-03 Custom plan contact form creates a lead.
- SUB-04 Owner submits a renewal payment reference; Super Admin approves (PD-013).

### 6.10 Super Admin (ADM)
- ADM-01 List and filter organizations; suspend or reactivate.
- ADM-02 CRUD plans and limits.
- ADM-03 Override limits and extend trial per subscription.
- ADM-04 View and handle custom-plan leads.
- ADM-05 Platform stats (organizations, orders, revenue).

### 6.11 Notifications (NOT)
- NOT-01 In-app notifications and real-time events for: pending order, new confirmed order, bill requested, low stock, item unavailable.

---

## 7. Key business rules

1. A table has at most one open session at a time.
2. Prices and totals are always computed on the server. Snapshot item name, price and options into order items.
3. A guest order is not visible to the kitchen and does not touch stock until a waiter confirms it.
4. Stock deduction and restore happen only through the inventory service, in a transaction.
5. A suspended organization cannot use the app. A grace-period organization is read-only.
6. Deactivated outlets keep their history in reports.
7. One live subscription per organization.
8. Waiter and Kitchen accounts have exactly one outlet assignment.

---

## 8. Main flows

**Guest dine-in:** scan QR → menu → cart → place order → *pending confirmation* → waiter confirms → kitchen preparing → ready → waiter serves → guest requests bill → pays (eSewa or cash) → session closed → table free.

**Owner onboarding:** register → verify email → checklist (tables, menu, staff, ingredients) → print QR codes.

**Upgrade to multi-outlet:** Owner submits contact form → Super Admin sets Custom plan limits → switcher and "Add outlet" appear → new outlet gets own tables, staff, stock; menu inherited with overrides.

---

## 9. Non-functional requirements

- Kitchen board receives a confirmed order in under 1 second on a normal connection.
- Public guest menu: server-rendered, fast first load on mobile data.
- Responsive web (mobile, tablet, desktop). No PWA.
- English UI. NPR, VAT 13%, service charge 10% by default, editable per outlet.
- Security requirements in `SECURITY.md`. Testing requirements in `TESTING.md`.

## 10. v2 backlog (do not build)

Delivery Rider role and delivery orders, Cashier role, supplier management and purchase orders, table reservations, customer accounts and loyalty, reviews, inter-outlet stock transfers, automatic subscription billing, PWA, additional languages.

## 11. Portfolio deliverables

Live deployed demo with seeded demo restaurant and "try as Owner / Waiter / Kitchen / Guest" buttons, README with screenshots, architecture diagram, Swagger UI, test suite.
