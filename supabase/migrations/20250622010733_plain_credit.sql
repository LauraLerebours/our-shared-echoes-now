-- Create or replace the function to create user profiles with better Google OAuth support
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
END;
$$;

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

-- Add helpful comments for documentation
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates user profiles for new users, supporting both email and OAuth (Google) authentication. Extracts names from Google OAuth metadata when available.';

-- Ensure RLS is properly configured for user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Update RLS policies to ensure they work with OAuth users
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