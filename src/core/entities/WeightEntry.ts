import { z } from 'zod';

export const WeightEntrySchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  date: z.string(), // YYYY-MM-DD
  weight_kg: z.number().nullable(),
  created_at: z.string().optional(),
});

export type WeightEntry = z.infer<typeof WeightEntrySchema>;
