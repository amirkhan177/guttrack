import { z } from 'zod';

export const MealSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  timestamp: z.string(), // ISO string
  meal_type: z.enum(['Breakfast', 'Lunch', 'Dinner', 'Snack']),
  protein: z.string().nullable(),
  carbs: z.string().nullable(),
  spice: z.string().nullable(),
  alcohol: z.string().nullable(),
  feeling: z.string().nullable(),
  symptom_tags: z.array(z.string()).default([]),
  food_description: z.string().nullable(),
  created_at: z.string().optional(),
});

export type Meal = z.infer<typeof MealSchema>;

export const FoodAnalysisSchema = z.object({
  protein: z.string(),
  carbs: z.string(),
  spice: z.string(),
  gut_notes: z.string(),
  fiber_level: z.enum(['high', 'moderate', 'low']),
  key_nutrients: z.array(z.string()),
  gut_cautions: z.array(z.string()),
  ibs_trigger_risk: z.enum(['low', 'moderate', 'high']),
  kidney_notes: z.string(),
});

export type FoodAnalysis = z.infer<typeof FoodAnalysisSchema>;
