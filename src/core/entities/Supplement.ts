import { z } from 'zod';

export const SupplementSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  name: z.string(),
  dosage: z.number().nullable(),
  unit: z.string().nullable(),
  frequency: z.string().nullable(),
  time_of_day: z.string().nullable(),
  notes: z.string().nullable(),
  active: z.boolean(),
  category: z.enum(['supplement', 'medication']),
  created_at: z.string().optional(),
});

export type Supplement = z.infer<typeof SupplementSchema>;

export const SupplementLogSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  supplement_id: z.string().uuid(),
  taken_at: z.string(),
  date: z.string(), // YYYY-MM-DD
});

export type SupplementLog = z.infer<typeof SupplementLogSchema>;
