-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- meal_logs
CREATE TABLE IF NOT EXISTS meal_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  timestamp timestamptz NOT NULL,
  meal_type text NOT NULL,
  protein text,
  carbs text,
  spice text,
  alcohol text,
  feeling text,
  symptom_tags text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_logs_user_select" ON meal_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "meal_logs_user_insert" ON meal_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meal_logs_user_update" ON meal_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "meal_logs_user_delete" ON meal_logs FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_meal_logs_user_timestamp ON meal_logs(user_id, timestamp DESC);

-- weight_entries
CREATE TABLE IF NOT EXISTS weight_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  date date NOT NULL,
  weight_kg decimal,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE weight_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weight_entries_user_select" ON weight_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "weight_entries_user_insert" ON weight_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "weight_entries_user_update" ON weight_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "weight_entries_user_delete" ON weight_entries FOR DELETE USING (auth.uid() = user_id);

-- oura_metrics
CREATE TABLE IF NOT EXISTS oura_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  date date NOT NULL,
  readiness_score int,
  hrv_balance decimal,
  sleep_score int,
  sleep_total_minutes int,
  sleep_deep_minutes int,
  sleep_rem_minutes int,
  sleep_light_minutes int,
  sleep_awake_minutes int,
  sleep_efficiency decimal,
  sleep_latency int,
  activity_score int,
  steps int,
  active_calories int,
  stress_high_minutes int,
  stress_low_minutes int,
  recovery_minutes int,
  resting_heart_rate decimal,
  body_temperature_deviation decimal,
  vo2_max decimal,
  resilience_level text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE oura_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oura_metrics_user_select" ON oura_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "oura_metrics_user_insert" ON oura_metrics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "oura_metrics_user_update" ON oura_metrics FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "oura_metrics_user_delete" ON oura_metrics FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_oura_metrics_user_date ON oura_metrics(user_id, date DESC);

-- lab_results
CREATE TABLE IF NOT EXISTS lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  value text,
  unit text,
  status text,
  date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lab_results_user_select" ON lab_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "lab_results_user_insert" ON lab_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lab_results_user_update" ON lab_results FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "lab_results_user_delete" ON lab_results FOR DELETE USING (auth.uid() = user_id);

-- supplements
CREATE TABLE IF NOT EXISTS supplements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  dosage decimal,
  unit text,
  frequency text,
  time_of_day text,
  notes text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE supplements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplements_user_select" ON supplements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "supplements_user_insert" ON supplements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "supplements_user_update" ON supplements FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "supplements_user_delete" ON supplements FOR DELETE USING (auth.uid() = user_id);

-- supplement_logs
CREATE TABLE IF NOT EXISTS supplement_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  supplement_id uuid REFERENCES supplements NOT NULL,
  taken_at timestamptz NOT NULL,
  date date NOT NULL
);

ALTER TABLE supplement_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplement_logs_user_select" ON supplement_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "supplement_logs_user_insert" ON supplement_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "supplement_logs_user_update" ON supplement_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "supplement_logs_user_delete" ON supplement_logs FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_supplement_logs_user_date ON supplement_logs(user_id, date DESC);

-- daily_insights
CREATE TABLE IF NOT EXISTS daily_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  date date NOT NULL,
  window_type text NOT NULL,
  generated_at timestamptz DEFAULT now(),
  flare_risk_level text,
  flare_risk_reason text,
  contributing_factors text[],
  what_happened text,
  avoid jsonb,
  add_to_diet jsonb,
  patterns jsonb,
  prediction jsonb,
  prediction_confidence int,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE daily_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_insights_user_select" ON daily_insights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "daily_insights_user_insert" ON daily_insights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "daily_insights_user_update" ON daily_insights FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "daily_insights_user_delete" ON daily_insights FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_daily_insights_user_date_window ON daily_insights(user_id, date DESC, window_type);

-- daily_feedback
CREATE TABLE IF NOT EXISTS daily_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  date date NOT NULL,
  predicted_flare_level text,
  actual_flare_level text,
  predicted_symptoms text[],
  actual_symptoms text[],
  feeling_score text,
  accuracy_score int,
  notes text,
  submitted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE daily_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_feedback_user_select" ON daily_feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "daily_feedback_user_insert" ON daily_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "daily_feedback_user_update" ON daily_feedback FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "daily_feedback_user_delete" ON daily_feedback FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_daily_feedback_user_date ON daily_feedback(user_id, date DESC);
