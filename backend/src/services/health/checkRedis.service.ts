import { redis } from '@/lib/redis';

export async function isRedisUp(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}
