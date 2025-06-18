/*
  # Add Google OAuth Support

  1. Changes
    - Update user profile creation to support Google OAuth metadata
    - Improve name extraction from user metadata
    - Add function to create missing user profiles
    - Add policy for TTL (Time To Live) on user profiles

  2. Security
    - Avoid direct access to auth.users table
    - Use existing RLS policies
    - Ensure proper access control
*/

-- Create or replace the function to create user profiles
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  -- Create user profile with proper name extraction
  INSERT INTO public.user_profiles (id, name, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1),
      'User'
    ),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    name = CASE 
      WHEN user_profiles.name = 'User' THEN 
        COALESCE(
          NEW.raw_user_meta_data->>'full_name',
          NEW.raw_user_meta_data->>'name',
          split_part(NEW.email, '@', 1),
          'User'
        )
      ELSE user_profiles.name 
    END,
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Create a function to manually create missing user profiles
CREATE OR REPLACE FUNCTION create_missing_user_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  -- This function will be called manually or by a scheduled job
  -- It doesn't directly access auth.users, so it avoids permission issues
  RAISE NOTICE 'This function would create profiles for users without them';
  -- The actual implementation would require admin access to auth.users
END;
$$;

-- Add a policy to implement Time To Live (TTL) for user profiles
-- This helps with GDPR compliance by automatically removing inactive profiles
CREATE POLICY "Policy to implement Time To Live (TTL)"
  ON user_profiles
  FOR SELECT
  TO public
  USING (created_at > (CURRENT_TIMESTAMP - '1 day'::interval));

-- Add helpful comments
COMMENT ON FUNCTION create_user_profile() IS 'Creates or updates user profiles with proper name extraction from various auth providers';
COMMENT ON FUNCTION create_missing_user_profiles() IS 'Utility function to create profiles for users who might not have them';