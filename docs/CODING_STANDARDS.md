# CODING_STANDARDS.md

Goal: clean, modular, human-readable code. A new developer should find any file in seconds.

> Items marked **(PD-xxx)** depend on a pending decision in `DECISIONS.md`. Ask before building on them.

---

## 1. Repo layout

```
bansa/
├─ AGENT.md
├─ docs/                  # all .md docs + SQL schema reference
├─ backend/
├─ frontend/
├─ docker-compose.yml     # postgres, redis, (test db)
└─ README.md
```

---

## 2. Backend structure (MVC)

Each top-level folder has **one subfolder per module**. Module names: `auth`, `organization`, `outlet`, `staff`, `table`, `menu`, `order`, `session`, `inventory`, `payment`, `subscription`, `analytics`, `notification`, `admin`, `public`.

```
backend/
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts
├─ src/
│  ├─ app.ts                  # express app setup (middlewares + routes)
│  ├─ server.ts               # http + socket.io bootstrap
│  ├─ config/                 # env.ts, brand.ts, constants.ts
│  ├─ lib/                    # prisma.ts, redis.ts, cloudinary.ts, resend.ts, logger.ts
│  ├─ models/                 # M: database access per module
│  │  ├─ menu/
│  │  │  ├─ menuItem.model.ts
│  │  │  └─ menuCategory.model.ts
│  │  └─ ...
│  ├─ controllers/            # C: read request, call service/model, send response
│  │  ├─ menu/
│  │  │  └─ menuItem.controller.ts
│  │  └─ ...
│  ├─ routes/                 # R: URL → middlewares → controller
│  │  ├─ menu/
│  │  │  └─ menuItem.routes.ts
│  │  └─ index.ts             # mounts all routers under /api/v1
│  ├─ services/               # business logic, multi-model transactions (PD-001)
│  │  └─ order/
│  │     └─ confirmOrder.service.ts
│  ├─ validations/            # Zod schemas (also feed Swagger)
│  │  └─ menu/
│  │     └─ menuItem.schema.ts
│  ├─ middlewares/            # auth, outletContext, permission, validate, rateLimit, errorHandler
│  ├─ sockets/                # socket server, rooms, event emitters
│  ├─ jobs/                   # BullMQ queues, workers, schedulers
│  ├─ docs/                   # swagger registry + openapi setup
│  ├─ utils/                  # small pure helpers (money, dates, tokens)
│  ├─ errors/                 # AppError and error codes
│  └─ types/                  # shared TS types
└─ tests/
   ├─ unit/                   # mirrors src/ (services, utils)
   ├─ integration/            # mirrors routes/ (Supertest)
   └─ helpers/                # factories, test db, auth helpers
```

### Layer responsibilities

| Layer | Does | Does NOT |
|---|---|---|
| **routes** | Map URL + method → middlewares → controller | Contain logic |
| **controllers** | Parse validated input, call service/model, return the standard response | Run Prisma queries, hold business rules |
| **services** | Business rules, transactions across models, emit events | Touch `req` / `res` |
| **models** | Prisma queries for one entity, always scoped by tenant | Business decisions |
| **validations** | Zod schemas for body, params, query, plus OpenAPI metadata | Logic |
| **middlewares** | Cross-cutting checks (auth, tenant, permission, validation) | Business logic |

If PD-001 is answered "pure MVC", the services layer is removed and controllers call models directly.

### File naming

- `<entity>.<layer>.ts` → `menuItem.controller.ts`, `menuItem.model.ts`, `menuItem.routes.ts`, `menuItem.schema.ts`
- Services: `<verb><Thing>.service.ts` → `confirmOrder.service.ts`
- Tests: `<file>.test.ts` next to the mirrored path under `tests/`
- Folders and files: `camelCase` for files, `kebab-case` for URLs.
- Classes/types: `PascalCase`. Constants: `UPPER_SNAKE_CASE`. Variables/functions: `camelCase`.

### Size limits (guidelines)

- File: aim under ~150 lines. Over 250 means split it.
- Function: aim under ~30 lines, one job.
- Controller method: under ~15 lines.

---

## 3. Frontend structure (Next.js App Router, feature-based MVC mapping)

| MVC | Frontend meaning | Location |
|---|---|---|
| **Model** | Types, Zod schemas, API calls | `features/<name>/models/`, `features/<name>/services/` |
| **View** | Components and pages (presentational) | `features/<name>/views/`, `app/` routes |
| **Controller** | Hooks that connect UI, state and API | `features/<name>/controllers/` |

```
frontend/
├─ src/
│  ├─ app/                         # routes only; pages stay thin and compose feature views
│  │  ├─ (public)/                 # landing, pricing, guest QR menu (SSR, SEO)
│  │  │  ├─ page.tsx
│  │  │  ├─ pricing/page.tsx
│  │  │  └─ m/[qrToken]/page.tsx   # guest menu
│  │  ├─ (auth)/                   # login, register, verify, reset
│  │  ├─ (dashboard)/              # staff app (role-aware)
│  │  │  ├─ layout.tsx
│  │  │  ├─ menu/page.tsx
│  │  │  └─ ...
│  │  ├─ (admin)/                  # super admin
│  │  ├─ layout.tsx
│  │  └─ not-found.tsx
│  ├─ features/
│  │  ├─ menu/
│  │  │  ├─ models/                # menu.types.ts, menu.schema.ts
│  │  │  ├─ services/              # menu.api.ts (fetch calls)
│  │  │  ├─ controllers/           # useMenuItems.ts, useCreateMenuItem.ts
│  │  │  └─ views/                 # MenuItemCard.tsx, MenuItemForm.tsx, MenuList.tsx
│  │  └─ ... (auth, outlet, staff, table, order, kitchen, inventory, payment, analytics, subscription, admin)
│  ├─ components/
│  │  ├─ ui/                       # shadcn/ui primitives
│  │  └─ shared/                   # reusable app-wide components (PageHeader, EmptyState)
│  ├─ lib/                         # apiClient.ts, socket.ts, utils.ts
│  ├─ store/                       # Zustand stores (auth, outlet, ui)
│  ├─ config/                      # brand.ts, routes.ts
│  ├─ providers/                   # QueryProvider, AuthProvider, SocketProvider
│  └─ types/
└─ tests/                          # mirrors src/features
```

### Frontend rules

- `app/` pages contain almost no logic. They fetch on the server where useful (SEO pages) and render feature views.
- Server Components by default; add `"use client"` only where state, effects or browser APIs are needed.
- Server state (API data) → **TanStack Query**. Client/UI state → **Zustand**. No other state libraries.
- All API calls go through `lib/apiClient.ts`. No raw `fetch` in components.
- Forms use Zod schemas (shared shape with backend where possible) (PD-014).
- Components: one per file, props typed, under ~150 lines. Split big ones.
- Show loading, empty and error states for every data view.
- Use shadcn/ui and Tailwind. No inline style objects unless unavoidable.
- Permissions in UI only hide or show; the backend is the real guard.

---

## 4. Comments

- Short, single line, only when the code is not obvious.
- No multi-line comment blocks. No JSDoc essays. No commented-out code. No TODOs without a task ID (`// TODO(A-012): ...`).
- Explain **why**, not what.

```ts
// Lock rows so two orders cannot take the last stock
```

---

## 5. TypeScript and style

- `strict: true`. No `any` without user approval.
- Prefer `type` for shapes, `interface` only when extending.
- Use named exports (default exports only where Next.js requires them).
- Early returns instead of deep nesting.
- No magic numbers or strings. Put them in `config/constants.ts`.
- Money: store as `NUMERIC(10,2)` in DB; in code use a decimal-safe approach (Prisma `Decimal`) and never float math. Helpers live in `utils/money.ts`.
- Dates: store UTC, show in the outlet timezone.
- ESLint + Prettier are required. Code must pass lint before a task is done.

---

## 6. API and error conventions

- Standard success and error envelopes are defined in `API.md`. Every controller uses the shared response helper.
- Throw `AppError(code, message, status)` from services/models; the global error handler formats it. Controllers do not hand-build error responses.
- Never leak stack traces, SQL errors or secrets to clients.

---

## 7. Git and workflow

- One task = one branch = one pull request (or one commit group): `feat/A-001-register-org`.
- Commit messages: `feat(auth): register organization with default outlet (A-001)`.
- No unrelated changes inside a task.

---

## 8. Definition of done (per task)

- [ ] Follows this document, no oversized files
- [ ] Input validated with Zod
- [ ] Tenant and permission checks in place where relevant
- [ ] `TASK.md` and affected docs updated
- [ ] Tests written and passing (real run shown)
- [ ] Swagger updated for new or changed endpoints
- [ ] Lint passes
- [ ] End-of-task report given, user asked whether to proceed
