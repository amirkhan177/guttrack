-- Add food_description column to meal_logs
ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS food_description text;
