/*
  # Google OAuth Support Migration

  1. Enhanced User Profile Management
    - Update handle_new_user function to support Google OAuth users
    - Extract name from Google user metadata automatically
    - Ensure proper profile creation for OAuth users

  2. Security
    - Maintain existing RLS policies
    - Ensure OAuth users have same permissions as email users

  3. User Experience
    - Automatic profile creation with Google name
    - No email verification required for Google users
*/

-- Update the handle_new_user function to support Google OAuth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_name text;
BEGIN
  -- Extract name from user metadata
  -- For Google OAuth, this will be in user_metadata.full_name or user_metadata.name
  -- For email signup, this will be in user_metadata.name
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.email_confirmed_at IS NOT NULL AND NEW.email_confirmed_at > NEW.created_at, -- Google users are auto-confirmed
    split_part(NEW.email, '@', 1) -- Fallback to email username
  );

  -- Ensure we have a valid name
  IF user_name IS NULL OR trim(user_name) = '' THEN
    user_name := 'User';
  END IF;

  -- Create user profile
  INSERT INTO user_profiles (id, name)
  VALUES (NEW.id, user_name)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Ensure the trigger exists and is properly configured
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update existing users who might not have profiles
-- This is safe to run multiple times
INSERT INTO user_profiles (id, name)
SELECT 
  id,
  COALESCE(
    raw_user_meta_data->>'full_name',
    raw_user_meta_data->>'name',
    split_part(email, '@', 1),
    'User'
  ) as name
FROM auth.users
WHERE id NOT IN (SELECT id FROM user_profiles)
ON CONFLICT (id) DO NOTHING;

-- Add helpful comments
COMMENT ON FUNCTION handle_new_user() IS 'Automatically creates user profiles for new users, supporting both email and OAuth (Google) authentication';
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 'Triggers user profile creation when a new user signs up via any method';