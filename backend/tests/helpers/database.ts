import { prisma } from '@/lib/prisma';
import { seedReferenceData } from '../../prisma/seedData';

export async function resetDatabase(): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    select tablename
    from pg_tables
    where schemaname = 'public' and tablename <> '_prisma_migrations'
  `;

  if (tables.length === 0) {
    throw new Error('The test database has no tables. Run the migrations first.');
  }

  const tableList = tables.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);

  await prisma.$transaction(
    async (tx) => {
      await seedReferenceData(tx);
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
}
