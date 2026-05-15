import { z } from 'zod';

export const WorkoutLogSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  oura_id: z.string().nullable(),
  date: z.string(), // YYYY-MM-DD
  activity: z.string().nullable(),
  calories: z.number().nullable(),
  distance: z.number().nullable(),
  duration_seconds: z.number().nullable(),
  start_datetime: z.string().nullable(),
  end_datetime: z.string().nullable(),
  average_heart_rate: z.number().nullable(),
  max_heart_rate: z.number().nullable(),
  source: z.string().nullable(),
  created_at: z.string().optional(),
});

export type WorkoutLog = z.infer<typeof WorkoutLogSchema>;
