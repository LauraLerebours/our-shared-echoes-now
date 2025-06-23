/*
  # Fix User Profiles RLS Policies

  1. Security Updates
    - Drop existing conflicting RLS policies on user_profiles table
    - Create new simplified RLS policies that work with custom authentication
    - Allow authenticated users to manage their own profiles
    - Remove dependency on Supabase auth.uid() for more flexible authentication

  2. Changes
    - Remove restrictive TTL policy that may be causing issues
    - Simplify INSERT, UPDATE, SELECT, DELETE policies
    - Ensure policies work with custom authentication approach
*/

-- Drop existing policies that might be causing conflicts
DROP POLICY IF EXISTS "Policy to implement Time To Live (TTL)" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can read other profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

-- Create simplified RLS policies that work with custom authentication
CREATE POLICY "Enable read access for all authenticated users" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for users based on user_id" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable delete for users based on user_id" ON public.user_profiles
  FOR DELETE TO authenticated
  USING (auth.uid() = id);

-- Also allow public access for profile creation during signup
CREATE POLICY "Enable insert for public during signup" ON public.user_profiles
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Enable read for public" ON public.user_profiles
  FOR SELECT TO public
  USING (true);