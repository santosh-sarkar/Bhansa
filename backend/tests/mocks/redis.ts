import { jest } from '@jest/globals';

const mockRedis = {
  incr: jest.fn(async () => 1),
  expire: jest.fn(async () => 1),
  ttl: jest.fn(async () => 60),
  ping: jest.fn(async () => 'PONG'),
  quit: jest.fn(async () => 'OK'),
  connect: jest.fn(async () => {}),
  on: jest.fn(),
};

export const redis = mockRedis;
export const connectRedis = jest.fn(async () => {});
export const disconnectRedis = jest.fn(async () => {});
export const isRedisUp = jest.fn(async () => true);
