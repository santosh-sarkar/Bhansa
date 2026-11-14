import { PrismaClient } from '@prisma/client';

import { PERMISSIONS, PLANS, ROLES, seedReferenceData } from './seedData';

const prisma = new PrismaClient();

async function seed(): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await seedReferenceData(tx);
    },
    { timeout: 30_000, maxWait: 10_000 },
  );

  console.log(
    `Seeded ${ROLES.length} roles, ${PERMISSIONS.length} permissions and ${PLANS.length} plans.`,
  );
}

async function main(): Promise<void> {
  try {
    await seed();
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
