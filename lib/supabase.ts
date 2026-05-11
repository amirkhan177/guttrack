import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function createSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export type MealLog = {
  id: string;
  user_id: string;
  timestamp: string;
  meal_type: string;
  protein: string | null;
  carbs: string | null;
  spice: string | null;
  alcohol: string | null;
  feeling: string | null;
  symptom_tags: string[];
  food_description: string | null;
  created_at: string;
};

export type WeightEntry = {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number | null;
  created_at: string;
};

export type OuraMetrics = {
  id: string;
  user_id: string;
  date: string;
  readiness_score: number | null;
  hrv_balance: number | null;
  sleep_score: number | null;
  sleep_total_minutes: number | null;
  sleep_deep_minutes: number | null;
  sleep_rem_minutes: number | null;
  sleep_light_minutes: number | null;
  sleep_awake_minutes: number | null;
  sleep_efficiency: number | null;
  sleep_latency: number | null;
  activity_score: number | null;
  steps: number | null;
  active_calories: number | null;
  stress_high_minutes: number | null;
  stress_low_minutes: number | null;
  recovery_minutes: number | null;
  resting_heart_rate: number | null;
  body_temperature_deviation: number | null;
  vo2_max: number | null;
  resilience_level: string | null;
  created_at: string;
};

export type LabResult = {
  id: string;
  user_id: string;
  name: string;
  value: string | null;
  unit: string | null;
  status: string | null;
  date: string | null;
  created_at: string;
};

export type Supplement = {
  id: string;
  user_id: string;
  name: string;
  dosage: number | null;
  unit: string | null;
  frequency: string | null;
  time_of_day: string | null;
  notes: string | null;
  active: boolean;
  category: "supplement" | "medication";
  created_at: string;
};

export type WorkoutLog = {
  id: string;
  user_id: string;
  oura_id: string | null;
  date: string;
  activity: string | null;
  calories: number | null;
  distance: number | null;
  duration_seconds: number | null;
  start_datetime: string | null;
  end_datetime: string | null;
  average_heart_rate: number | null;
  max_heart_rate: number | null;
  source: string | null;
  created_at: string;
};

export type SupplementLog = {
  id: string;
  user_id: string;
  supplement_id: string;
  taken_at: string;
  date: string;
};

export type DailyInsight = {
  id: string;
  user_id: string;
  date: string;
  window_type: string;
  generated_at: string;
  flare_risk_level: string | null;
  flare_risk_reason: string | null;
  contributing_factors: string[] | null;
  what_happened: string | null;
  avoid: Record<string, unknown> | null;
  add_to_diet: Record<string, unknown> | null;
  patterns: Record<string, unknown> | null;
  prediction: Record<string, unknown> | null;
  prediction_confidence: number | null;
  created_at: string;
};

export type DailyFeedback = {
  id: string;
  user_id: string;
  date: string;
  predicted_flare_level: string | null;
  actual_flare_level: string | null;
  predicted_symptoms: string[] | null;
  actual_symptoms: string[] | null;
  feeling_score: string | null;
  accuracy_score: number | null;
  notes: string | null;
  submitted_at: string;
};
