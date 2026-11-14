import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;
const isTest = process.env.NODE_ENV === 'test';

let redisClient: Redis | null = null;

if (!isTest) {
  if (!redisUrl) {
    throw new Error('REDIS_URL is required');
  }
  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) {
        return null;
      }
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  });

  redisClient.on('error', (err) => {
    console.error('[redis] connection error:', err.message);
  });
}

const mockRedis = {
  incr: () => 1,
  expire: () => 1,
  ttl: () => 60,
  ping: () => 'PONG',
  quit: () => 'OK',
  connect: () => Promise.resolve(),
  on: () => {},
};

export const redis = isTest ? mockRedis : redisClient!;

export async function connectRedis(): Promise<void> {
  if (!isTest && redisClient) {
    await redisClient.connect();
  }
}

export async function disconnectRedis(): Promise<void> {
  if (!isTest && redisClient) {
    await redisClient.quit();
  }
}

export async function isRedisUp(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}
