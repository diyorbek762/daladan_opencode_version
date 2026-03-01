-- ============================================================
-- Daladan — Fix ALL Cross-User Data Integration
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================================

-- ==========================================
-- 1. HARVESTS TABLE — Enable cross-user reads
-- ==========================================

-- First, check if RLS is enabled. If so, add open SELECT policy.
ALTER TABLE public.harvests ENABLE ROW LEVEL SECURITY;

-- Drop existing conflicting policies (ignore errors if they don't exist)
DROP POLICY IF EXISTS "Anyone can view harvests" ON public.harvests;
DROP POLICY IF EXISTS "Users can insert their own harvests" ON public.harvests;
DROP POLICY IF EXISTS "Users can update their own harvests" ON public.harvests;
DROP POLICY IF EXISTS "Harvests are viewable by everyone." ON public.harvests;
DROP POLICY IF EXISTS "Users can insert their own harvest." ON public.harvests;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.harvests;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.harvests;

-- Create fresh, correct policies
CREATE POLICY "Anyone can view harvests"
  ON public.harvests FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert harvests"
  ON public.harvests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own harvests"
  ON public.harvests FOR UPDATE USING (auth.uid() = user_id);

-- ==========================================
-- 2. NEEDS TABLE — Ensure cross-user reads
-- ==========================================

ALTER TABLE public.needs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view open needs" ON public.needs;
DROP POLICY IF EXISTS "Users can insert their own needs" ON public.needs;
DROP POLICY IF EXISTS "Users can update their own needs" ON public.needs;

CREATE POLICY "Anyone can view open needs"
  ON public.needs FOR SELECT USING (true);

CREATE POLICY "Users can insert their own needs"
  ON public.needs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own needs"
  ON public.needs FOR UPDATE USING (auth.uid() = user_id);

-- ==========================================
-- 3. MESSAGES TABLE — Fix so users can read/write
-- ==========================================

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can read their own sent and received messages" ON public.messages;

CREATE POLICY "Users can insert their own messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can read their own messages"
  ON public.messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- ==========================================
-- 4. PROFILES TABLE — Ensure cross-user reads
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ==========================================
-- 5. PRODUCT NEED MATCHES — Open reads
-- ==========================================

ALTER TABLE public.product_need_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view matches involving their products or needs" ON public.product_need_matches;
DROP POLICY IF EXISTS "System can insert matches" ON public.product_need_matches;

CREATE POLICY "Anyone can view matches"
  ON public.product_need_matches FOR SELECT USING (true);

CREATE POLICY "Anyone can insert matches"
  ON public.product_need_matches FOR INSERT WITH CHECK (true);

-- ==========================================
-- 6. Ensure Supabase Realtime is enabled
-- ==========================================

-- These may error if already added — that's fine
DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.harvests';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'harvests already in publication';
END$$;

DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.needs';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'needs already in publication';
END$$;

DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'messages already in publication';
END$$;

-- ==========================================
-- 7. Ensure harvests has all required columns
-- ==========================================

ALTER TABLE public.harvests ADD COLUMN IF NOT EXISTS price_per_kg NUMERIC(10,2);
ALTER TABLE public.harvests ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.harvests ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'Tashkent';
ALTER TABLE public.harvests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available';
ALTER TABLE public.harvests ADD COLUMN IF NOT EXISTS farmer_provides_transport BOOLEAN DEFAULT FALSE;

-- ==========================================
-- DONE! All tables now have proper cross-user
-- read access and Realtime is enabled.
-- ==========================================
