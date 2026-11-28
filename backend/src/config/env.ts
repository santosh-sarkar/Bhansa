import { z } from 'zod';

// Load a local .env when present; real environment values win.
try {
  process.loadEnvFile();
} catch {
  // No .env file: values come from the real environment.
}

const emptyToUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

// Empty values in .env.example count as "not set yet".
const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  APP_URL: z.url(),
  FRONTEND_URL: z.url(),

  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgres connection string'),
  TEST_DATABASE_URL: optionalString,
  REDIS_URL: z.string().regex(/^rediss?:\/\//, 'must be a redis connection string'),

  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().min(1).default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  COOKIE_DOMAIN: z.string().min(1).default('localhost'),

  // Required from the payments task onward.
  ENCRYPTION_KEY: optionalString,

  // Required from the menu image upload task onward.
  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,

  // Required from the email task onward.
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: z.string().min(1).default('noreply@localhost'),
  EMAIL_RECIPIENT: optionalString,

  // Required from the eSewa task onward.
  ESEWA_FORM_URL: optionalString,
  ESEWA_STATUS_URL: optionalString,

  // Seed only.
  SUPER_ADMIN_EMAIL: optionalString,
  SUPER_ADMIN_PASSWORD: optionalString,
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const issues = result.error.issues.map(
    (issue) => `  ${issue.path.join('.') || 'env'}: ${issue.message}`,
  );
  throw new Error(`Invalid environment variables:\n${issues.join('\n')}`);
}

export const env = result.data;
export type Env = typeof env;
