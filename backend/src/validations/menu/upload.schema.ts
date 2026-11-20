import { z } from 'zod';

export const uploadMenuImageSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: 'File size must be less than 5MB',
    })
    .refine((file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type), {
      message: 'File must be JPEG, PNG, or WebP',
    }),
});

export type UploadMenuImageInput = z.infer<typeof uploadMenuImageSchema>;
