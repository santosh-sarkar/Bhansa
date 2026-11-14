# AGENT.md — Operating Rules for the Coding Agent

Project: **Bansa** — multi-outlet restaurant SaaS for the Nepali market.
Read this file fully before doing anything. These rules override your own habits.

---

## 1. Read order (every new session)

1. `AGENT.md` (this file)
2. `docs/DECISIONS.md` — approved decisions and pending ones
3. `docs/TASK.md` — find the current task
4. Docs relevant to that task: `PRD.md`, `TRD.md`, `ARCHITECTURE.md`, `DATABASE.md`, `SECURITY.md`, `API.md`, `TESTING.md`, `CODING_STANDARDS.md`

If two docs disagree, **stop and ask**. Never pick one silently.

---

## 2. Golden rule: never guess, never hallucinate

- If something is unclear, missing, or not in the docs: **STOP and ask the user.**
- Never invent: endpoints, DB columns, env vars, roles, permissions, library APIs, eSewa parameters, or business rules.
- If you are not sure how a library works, read its official docs. If still unsure, ask.
- For **eSewa**, only use what is in the official docs (https://developer.esewa.com.np). If anything differs from `TRD.md`, tell the user before coding.
- Say "I don't know" instead of producing a plausible answer.
- Do not add features, packages, or files that no task asks for.

---

## 3. Task workflow (mandatory, in this exact order)

For every task in `docs/TASK.md`:

1. **Implement** the feature (small, modular, follows `CODING_STANDARDS.md`).
2. **Update** — set the task status in `TASK.md` and update any affected docs (`DATABASE.md`, `API.md`, `DECISIONS.md`).
3. **Write tests** (see `TESTING.md`).
4. **Swagger** — update the OpenAPI docs (generated from the Zod schemas) for any new or changed endpoint.
5. **Run tests** — run the full relevant test script. Report the real result. Never claim tests pass without running them.
6. **Ask the user** whether to proceed to the next task. **Wait for an answer.** Never start the next task on your own.

A task is not done until all six steps are finished.

### End-of-task report format

```
Task: <ID> <title>
Files changed: <list>
Docs updated: <list>
Tests: <passed/failed counts, command used>
Swagger: <updated / not needed>
Open questions: <list or none>
Proceed to <next task ID: title>? (yes / no / change)
```

---

## 4. When to stop and ask

Ask the user **before** continuing when:

- Anything is ambiguous, or you need to assume something.
- A task needs a **critical decision** (library, tool, approach, data model change). Give **2–3 options**, say what each is good for, and give your **recommendation** for this project. See the template below.
- A decision in `DECISIONS.md` is marked **PENDING** and the current task needs it.
- A change would touch the database schema, auth, permissions, payments, or multi-tenant isolation in a way the docs do not describe.
- Tests fail and the fix is not obvious or changes behavior.
- You want to deviate from any doc.

### Decision question template

```
Decision needed: <topic>
Why it matters: <one line>
Option A: <name> — good for <x>, downside <y>
Option B: <name> — good for <x>, downside <y>
Recommendation: <option> because <reason for Bansa>
Which one do you want?
```

After the user answers, record it in `docs/DECISIONS.md` (new ID, date, decision, reason).

---

## 5. Code rules (summary — full detail in `CODING_STANDARDS.md`)

- **Modular and human readable.** One responsibility per file. No giant files.
- Backend follows **MVC**: `models/`, `controllers/`, `routes/`, each with a subfolder per module. Supporting folders (`validations/`, `middlewares/`, `services/`) are defined in `CODING_STANDARDS.md`.
- Frontend follows the **feature-based MVC mapping** in `CODING_STANDARDS.md`.
- Comments: **short, single line, only where needed.** No multi-line comment blocks. No commented-out code.
- Use clear names. Small functions. Early returns over deep nesting.
- TypeScript strict mode. No `any` unless the user approves.
- All request input is validated with **Zod**. Swagger is generated from the same Zod schemas.
- Never hardcode the product name. Use `config/brand`.
- Never hardcode secrets. Use env vars validated by Zod.

---

## 6. Non-negotiables (project-specific)

1. **Tenant isolation:** every operational query is scoped by `outlet_id` (or `organization_id` for org-level data). `X-Outlet-Id` is untrusted; always verify the user's assignment.
2. **Permissions:** check by permission code (e.g. `menu.edit`), never by role name.
3. **Money:** use `NUMERIC` in DB and a safe decimal approach in code. Never trust prices from the client; compute on the server.
4. **Stock deduction** happens inside one DB transaction with row locks.
5. **Guest orders** always start as `pending_confirmation`. A waiter must confirm them. This is always on in v1.
6. **eSewa:** the redirect is not proof of payment. Verify the signature and call the status check API before marking a payment as succeeded.
7. **Secrets** (eSewa credentials) are stored encrypted. Never log them.
8. **Outlet switching** is only for Owner and Manager. Waiter and Kitchen belong to exactly one outlet.
9. **No PWA** in v1. Responsive web only.
10. Do not build v2 items (see `PRD.md` section 10).

---

## 7. Testing rules (summary)

- Write tests for every task. Run them. Show real output.
- Tenant isolation and permission checks need explicit tests.
- Do not delete or weaken a test to make it pass. Ask instead.
- See `TESTING.md`.

---

## 8. Communication style

- Be short and clear. Plain language.
- Show what you did and what you need.
- Ask **one clear question at a time** when blocked. Batch only related questions.
- Never say "done" without the end-of-task report.
