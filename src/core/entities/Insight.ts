import { z } from 'zod';

export const FlareRiskLevelSchema = z.enum(['None', 'Low', 'Moderate', 'High', 'Critical']);

export const DailyInsightSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  date: z.string(), // YYYY-MM-DD
  window_type: z.string(),
  generated_at: z.string(),
  flare_risk_level: FlareRiskLevelSchema.nullable(),
  flare_risk_reason: z.string().nullable(),
  contributing_factors: z.array(z.string()).nullable(),
  what_happened: z.string().nullable(),
  avoid: z.array(z.object({
    label: z.string(),
    reason: z.string(),
    duration: z.string().optional(),
  })).nullable(),
  add_to_diet: z.array(z.object({
    label: z.string(),
    reason: z.string(),
    timing: z.string().optional(),
  })).nullable(),
  patterns: z.array(z.string()).nullable(),
  prediction: z.record(z.string(), z.any()).nullable(),
  prediction_confidence: z.number().nullable(),
  created_at: z.string().optional(),
});

export type DailyInsight = z.infer<typeof DailyInsightSchema>;
