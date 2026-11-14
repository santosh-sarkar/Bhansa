# Bansa

Multi-outlet restaurant SaaS for the Nepali market: QR ordering, kitchen display, inventory and billing.

## Repository layout

```
backend/    Express API (own package.json, node_modules and scripts)
frontend/   Next.js app (own package.json, node_modules and scripts)
docs/       Product, technical and design documents
```

`backend/` and `frontend/` are independent npm projects. There is no root package and no npm workspace, so install and run every command inside the folder you are working on. One git repository holds both.

Environment files: root `.env` for Docker, `backend/.env`, `frontend/.env.local`. Only the `.env.example` files are committed.

## Prerequisites

- Node.js LTS
- PostgreSQL (local install or a Neon connection string)
- Redis (only needed from the queue and rate-limit steps onward)

## Setup

Database: use your local PostgreSQL or a Neon connection string in `backend/.env` (`DATABASE_URL`, `TEST_DATABASE_URL`). Docker is optional and only needed for Redis:

```bash
docker compose up -d redis
```

Backend:

```bash
cd backend
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Tests

Run the test command in each folder:

```bash
cd backend
npm test

cd ../frontend
npm test
```

Backend also exposes `npm run test:unit`, `npm run test:integration`, `npm run test:watch` and `npm run test:coverage`.

## Documentation

- `AGENT.md` — operating rules for the coding agent
- `docs/PRD.md` — product requirements
- `docs/TRD.md` — technical requirements
- `docs/ARCHITECTURE.md` — system design
- `docs/DATABASE.md` — schema guide (`docs/restaurant_saas_schema.sql` is the base SQL)
- `docs/API.md` — endpoint contract
- `docs/SECURITY.md` — security rules
- `docs/TESTING.md` — testing rules
- `docs/DESIGN.md` — frontend design system
- `docs/CODING_STANDARDS.md` — code and folder standards
- `docs/DECISIONS.md` — decision log
- `docs/TASK.md` — task breakdown and progress
