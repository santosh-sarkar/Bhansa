import { createHash, randomBytes, randomUUID } from 'node:crypto';

export function generateSecureToken(): string {
  return randomBytes(32).toString('hex');
}

export function generateFamilyId(): string {
  return randomUUID();
}

/**
 * Opaque tokens (refresh tokens, verification links) are stored as a SHA-256
 * digest. They are high-entropy random values, so a fast hash is enough and
 * keeps lookups constant-time for the database layer.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
