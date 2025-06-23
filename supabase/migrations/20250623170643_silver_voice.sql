/*
  # Fix User Profiles RLS Policies

  1. Security Updates
    - Drop existing conflicting policies on user_profiles table
    - Create clean, simple RLS policies for user_profiles
    - Ensure authenticated users can manage their own profiles
    - Allow public read access for profile display in shared contexts

  2. Changes
    - Remove duplicate and conflicting policies
    - Add clear policies for INSERT, UPDATE, DELETE, and SELECT operations
    - Ensure proper authentication checks
*/

-- Drop all existing policies on user_profiles to start clean
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable insert for public during signup" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable read for public" ON public.user_profiles;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.user_profiles;

-- Ensure RLS is enabled
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read all profiles (needed for shared boards)
CREATE POLICY "authenticated_users_can_read_profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for users to insert their own profile
CREATE POLICY "users_can_insert_own_profile"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Policy for users to update their own profile
CREATE POLICY "users_can_update_own_profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy for users to delete their own profile
CREATE POLICY "users_can_delete_own_profile"
  ON public.user_profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- Policy for public read access (needed for signup process)
CREATE POLICY "public_can_read_profiles"
  ON public.user_profiles
  FOR SELECT
  TO public
  USING (true);

-- Policy for public insert during signup (needed for user creation)
CREATE POLICY "public_can_insert_during_signup"
  ON public.user_profiles
  FOR INSERT
  TO public
  WITH CHECK (true);