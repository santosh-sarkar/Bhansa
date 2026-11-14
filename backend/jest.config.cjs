module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/lib/redis$': '<rootDir>/tests/mocks/redis.ts',
    '^@/lib/email$': '<rootDir>/tests/mocks/email.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  globalSetup: '<rootDir>/tests/globalSetup.cjs',
  collectCoverageFrom: ['src/services/**/*.ts', 'src/models/**/*.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'html'],
  coverageThreshold: {
    global: {
      lines: 80,
    },
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: 'tests/tsconfig.json',
      },
    ],
  },
  testTimeout: 30000,
  forceExit: true,
  detectOpenHandles: true,
  maxWorkers: 1,
};
