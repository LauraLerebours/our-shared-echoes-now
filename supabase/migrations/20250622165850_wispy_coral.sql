/*
  # Fix Google OAuth User Profile Creation

  1. Problem
    - Google OAuth users are not having their profiles created properly
    - The trigger function is not correctly extracting names from Google metadata
    - Users are seeing "no user found" errors after Google sign-up

  2. Solution
    - Update the handle_new_user function to better handle Google OAuth metadata
    - Add a trigger for metadata updates (important for OAuth flows)
    - Improve error handling to prevent trigger failures
    - Add a function to manually create missing profiles

  3. Changes
    - Better name extraction from Google metadata
    - More robust error handling
    - Support for both new users and metadata updates
*/

-- Create or replace the function to handle new users with better Google OAuth support
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  display_name text;
BEGIN
  -- Extract name from user metadata with proper fallback logic
  -- For Google OAuth: raw_user_meta_data.full_name or raw_user_meta_data.name
  -- For email signup: raw_user_meta_data.name
  -- Fallback: email username or 'User'
  
  -- First try to get name from Google OAuth metadata
  display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),
    'User'
  );

  -- Ensure we have a valid name (trim whitespace and check for empty)
  display_name := trim(display_name);
  IF display_name IS NULL OR display_name = '' THEN
    display_name := 'User';
  END IF;

  -- Create user profile with upsert to handle any edge cases
  INSERT INTO public.user_profiles (id, name, created_at, updated_at)
  VALUES (NEW.id, display_name, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    name = CASE 
      WHEN user_profiles.name = 'User' OR user_profiles.name IS NULL 
      THEN EXCLUDED.name 
      ELSE user_profiles.name 
    END,
    updated_at = now();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE WARNING 'Failed to create user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Create trigger for user metadata updates (important for OAuth)
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW
  WHEN (OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data)
  EXECUTE FUNCTION handle_new_user();

-- Add helpful comments for documentation
COMMENT ON FUNCTION handle_new_user() IS 'Automatically creates user profiles for new users, supporting both email and OAuth (Google) authentication. Extracts names from Google OAuth metadata when available.';

-- Create a function to manually create missing user profiles
CREATE OR REPLACE FUNCTION create_missing_user_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  -- Create profiles for any auth users that don't have profiles
  INSERT INTO public.user_profiles (id, name, created_at, updated_at)
  SELECT 
    au.id,
    COALESCE(
      au.raw_user_meta_data->>'full_name',
      au.raw_user_meta_data->>'name',
      split_part(au.email, '@', 1),
      'User'
    ) as name,
    au.created_at,
    NOW()
  FROM auth.users au
  LEFT JOIN user_profiles up ON au.id = up.id
  WHERE up.id IS NULL
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- Run the function to create any missing profiles
SELECT create_missing_user_profiles();

-- Ensure RLS is properly configured for user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Update RLS policies to ensure they work with Google OAuth users
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
CREATE POLICY "Users can read own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can read other profiles" ON public.user_profiles;
CREATE POLICY "Users can read other profiles" ON public.user_profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);