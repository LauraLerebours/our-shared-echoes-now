/*
  # Fix Google OAuth User Profile Creation

  1. Problem
    - Google OAuth users are not having their profiles created properly
    - The trigger function is not correctly extracting name from Google metadata
    - User profiles are not being created or updated correctly

  2. Solution
    - Update the handle_new_user function to better handle Google OAuth metadata
    - Ensure proper name extraction from various metadata formats
    - Add fallback logic for name extraction
    - Fix the trigger to run on both INSERT and UPDATE of auth.users

  3. Changes
    - Improve metadata extraction logic
    - Add better error handling
    - Ensure trigger runs for both new users and metadata updates
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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Create trigger for user metadata updates (important for OAuth)
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW
  WHEN (OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data)
  EXECUTE FUNCTION handle_new_user();

-- Add helpful comments for documentation
COMMENT ON FUNCTION handle_new_user() IS 'Automatically creates user profiles for new users, supporting both email and OAuth (Google) authentication. Extracts names from Google OAuth metadata when available.';

-- Update existing users who might not have profiles or have incomplete profiles
DO $$
DECLARE
  user_record RECORD;
  extracted_name text;
BEGIN
  -- Process users without profiles or with default 'User' names
  FOR user_record IN 
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    LEFT JOIN public.user_profiles up ON u.id = up.id
    WHERE up.id IS NULL 
       OR up.name IS NULL 
       OR up.name = 'User'
       OR trim(up.name) = ''
  LOOP
    -- Extract name using the same logic as the trigger
    extracted_name := COALESCE(
      user_record.raw_user_meta_data->>'full_name',
      user_record.raw_user_meta_data->>'name',
      split_part(user_record.email, '@', 1)
    );
    
    -- Ensure we have a valid name
    extracted_name := trim(extracted_name);
    IF extracted_name IS NULL OR extracted_name = '' THEN
      extracted_name := 'User';
    END IF;
    
    -- Insert or update the profile
    INSERT INTO public.user_profiles (id, name, created_at, updated_at)
    VALUES (user_record.id, extracted_name, now(), now())
    ON CONFLICT (id) DO UPDATE SET
      name = CASE 
        WHEN user_profiles.name = 'User' OR user_profiles.name IS NULL OR trim(user_profiles.name) = ''
        THEN EXCLUDED.name 
        ELSE user_profiles.name 
      END,
      updated_at = now();
  END LOOP;
END;
$$;

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