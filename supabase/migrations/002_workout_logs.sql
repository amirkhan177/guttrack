-- workout_logs
CREATE TABLE IF NOT EXISTS workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  oura_id text,
  date date NOT NULL,
  activity text,
  calories decimal,
  distance decimal,
  duration_seconds int,
  start_datetime timestamptz,
  end_datetime timestamptz,
  average_heart_rate decimal,
  max_heart_rate decimal,
  source text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, oura_id)
);

ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workout_logs_user_select" ON workout_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "workout_logs_user_insert" ON workout_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "workout_logs_user_update" ON workout_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "workout_logs_user_delete" ON workout_logs FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_workout_logs_user_date ON workout_logs(user_id, date DESC);
