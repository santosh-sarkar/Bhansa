import { z } from 'zod';

export const errorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export const successResponse = <T extends z.ZodType>(
  description: string,
  data: T
) => ({
  description,
  content: {
    'application/json': {
      schema: z.object({ success: z.literal(true), data }),
    },
  },
});

export const errorResponse = (description: string) => ({
  description,
  content: {
    'application/json': { schema: errorSchema },
  },
});

export const paginationSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const paginatedResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: z.array(dataSchema),
    pagination: paginationSchema,
  });