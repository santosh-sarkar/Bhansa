import { z } from 'zod';

export const listTablesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    is_active: z.coerce.boolean().optional(),
    status: z.enum(['free', 'occupied', 'needs_bill']).optional(),
    search: z.string().max(100).optional(),
  }),
});

export const tableIdSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid table ID' }),
  }),
});

export const createTableSchema = z.object({
  body: z.object({
    label: z.string().min(1).max(50),
    seats: z.number().int().positive().max(20).optional(),
  }),
});

export const updateTableSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid table ID' }),
  }),
  body: z.object({
    label: z.string().min(1).max(50).optional(),
    seats: z.number().int().positive().max(20).optional(),
    is_active: z.boolean().optional(),
  }),
});

export type ListTablesInput = z.infer<typeof listTablesSchema.shape.query>;
export type TableIdInput = z.infer<typeof tableIdSchema.shape.params>;
export type CreateTableInput = z.infer<typeof createTableSchema.shape.body>;
export type UpdateTableInput = z.infer<typeof updateTableSchema.shape.body>;
