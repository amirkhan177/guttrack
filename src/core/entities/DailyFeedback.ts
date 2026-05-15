import { z } from 'zod';

export const DailyFeedbackSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  date: z.string(), // YYYY-MM-DD
  predicted_flare_level: z.string().nullable(),
  actual_flare_level: z.string().nullable(),
  predicted_symptoms: z.array(z.string()).nullable(),
  actual_symptoms: z.array(z.string()).nullable(),
  feeling_score: z.string().nullable(),
  accuracy_score: z.number().nullable(),
  notes: z.string().nullable(),
  submitted_at: z.string().optional(),
});

export type DailyFeedback = z.infer<typeof DailyFeedbackSchema>;
