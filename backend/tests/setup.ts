import { jest } from '@jest/globals';

import { afterAll, beforeAll } from '@jest/globals';

import { resetDatabase } from './helpers/database';

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  const { prisma } = await import('@/lib/prisma');
  await prisma.$disconnect();
});
