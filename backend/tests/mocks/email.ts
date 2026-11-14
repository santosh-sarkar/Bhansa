import { jest } from '@jest/globals';

export const sendEmail = jest.fn(async () => 'mock-email-id');

export const getRedisConnection = jest.fn(() => ({
  host: 'localhost',
  port: 6379,
  password: '',
  maxRetriesPerRequest: 3,
}));

export const emailQueue = {
  add: jest.fn(async () => ({ id: 'mock-job-id' })),
  close: jest.fn(async () => {}),
  on: jest.fn(),
};

export const emailWorker = {
  close: jest.fn(async () => {}),
  on: jest.fn(),
  waitUntilReady: jest.fn(async () => {}),
};

export const EMAIL_QUEUE_NAME = 'email';
