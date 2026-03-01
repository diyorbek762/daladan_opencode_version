-- ============================================================
-- Daladan Real-Time Cross-Role Synchronization Schema
-- ============================================================

-- 1. Needs table — persists retailer product needs
CREATE TABLE IF NOT EXISTS public.needs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT DEFAULT 'vegetables',
  quantity INTEGER NOT NULL,
  price_per_kg NUMERIC(10,2),
  deadline DATE,
  urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('high', 'medium', 'low')),
  delivery_notes TEXT,
  region TEXT DEFAULT 'Tashkent',
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'matched', 'fulfilled', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Product-Need Matches table
CREATE TABLE IF NOT EXISTS public.product_need_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  harvest_id UUID REFERENCES public.harvests(id) ON DELETE CASCADE NOT NULL,
  need_id UUID REFERENCES public.needs(id) ON DELETE CASCADE NOT NULL,
  match_score NUMERIC(5,2) DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(harvest_id, need_id)
);

-- 3. Enable RLS
ALTER TABLE public.needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_need_matches ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for needs
CREATE POLICY "Anyone can view open needs"
  ON public.needs FOR SELECT USING (true);

CREATE POLICY "Users can insert their own needs"
  ON public.needs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own needs"
  ON public.needs FOR UPDATE USING (auth.uid() = user_id);

-- 5. RLS Policies for product_need_matches
CREATE POLICY "Users can view matches involving their products or needs"
  ON public.product_need_matches FOR SELECT USING (true);

CREATE POLICY "System can insert matches"
  ON public.product_need_matches FOR INSERT WITH CHECK (true);

-- 6. Enable Supabase Realtime on these tables
-- Run these in the SQL Editor:
ALTER PUBLICATION supabase_realtime ADD TABLE public.harvests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.needs;
