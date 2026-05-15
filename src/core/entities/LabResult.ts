import { z } from 'zod';

export const LabResultSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  name: z.string(),
  value: z.string().nullable(),
  unit: z.string().nullable(),
  status: z.string().nullable(),
  date: z.string().nullable(),
  created_at: z.string().optional(),
});

export type LabResult = z.infer<typeof LabResultSchema>;
