-- Add unique constraint to daily_insights to support upsert
ALTER TABLE daily_insights 
ADD CONSTRAINT daily_insights_user_date_window_unique UNIQUE (user_id, date, window_type);
