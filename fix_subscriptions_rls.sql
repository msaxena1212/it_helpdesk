-- Fix permissions for the subscriptions table
-- Run this in the Supabase SQL Editor

-- Step 1: Grant table-level privileges to authenticated and anon roles
GRANT ALL ON subscriptions TO authenticated;
GRANT SELECT ON subscriptions TO anon;

-- Step 2: Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Authenticated users can view subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Authenticated users can create subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Authenticated users can update subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Authenticated users can delete subscriptions" ON subscriptions;

-- Step 4: Create RLS policies
CREATE POLICY "Authenticated users can view subscriptions"
  ON subscriptions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create subscriptions"
  ON subscriptions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update subscriptions"
  ON subscriptions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete subscriptions"
  ON subscriptions FOR DELETE TO authenticated USING (true);
