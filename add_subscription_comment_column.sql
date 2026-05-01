-- Add comment column to subscriptions table if it doesn't exist
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS comment TEXT;
