import { z } from 'zod';

export const OuraMetricsSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  date: z.string(), // YYYY-MM-DD
  readiness_score: z.number().nullable(),
  hrv_balance: z.number().nullable(),
  sleep_score: z.number().nullable(),
  sleep_total_minutes: z.number().nullable(),
  sleep_deep_minutes: z.number().nullable(),
  sleep_rem_minutes: z.number().nullable(),
  sleep_light_minutes: z.number().nullable(),
  sleep_awake_minutes: z.number().nullable(),
  sleep_efficiency: z.number().nullable(),
  sleep_latency: z.number().nullable(),
  activity_score: z.number().nullable(),
  steps: z.number().nullable(),
  active_calories: z.number().nullable(),
  stress_high_minutes: z.number().nullable(),
  stress_low_minutes: z.number().nullable(),
  recovery_minutes: z.number().nullable(),
  resting_heart_rate: z.number().nullable(),
  body_temperature_deviation: z.number().nullable(),
  vo2_max: z.number().nullable(),
  resilience_level: z.string().nullable(),
  created_at: z.string().optional(),
});

export type OuraMetrics = z.infer<typeof OuraMetricsSchema>;
