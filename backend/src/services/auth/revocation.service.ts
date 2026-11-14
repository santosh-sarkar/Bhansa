import { prisma } from '@/lib/prisma';

export async function revokeFamily(familyId: string): Promise<number> {
  const result = await prisma.refreshToken.updateMany({
    where: { family_id: familyId, revoked_at: null },
    data: { revoked_at: new Date() },
  });

  return result.count;
}

export async function revokeAllUserFamilies(userId: string): Promise<number> {
  const result = await prisma.refreshToken.updateMany({
    where: { user_id: userId, revoked_at: null },
    data: { revoked_at: new Date() },
  });

  return result.count;
}
