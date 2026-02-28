-- Type for supported languages
CREATE TYPE public.user_language AS ENUM ('uz-Latn', 'uz-Cyrl', 'ru');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  is_farmer BOOLEAN DEFAULT FALSE,
  is_driver BOOLEAN DEFAULT FALSE,
  is_retailer BOOLEAN DEFAULT FALSE,
  preferred_language user_language DEFAULT 'uz-Latn'
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Basic Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone." 
  ON public.profiles FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert their own profile." 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile." 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Modifications to harvests table
ALTER TABLE public.harvests
ADD COLUMN farmer_provides_transport BOOLEAN DEFAULT FALSE;
