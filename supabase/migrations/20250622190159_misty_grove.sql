-- Create or replace the function to handle new users with better Google OAuth support
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  display_name text;
  profile_exists boolean;
BEGIN
  -- Check if profile already exists to avoid duplicate processing
  SELECT EXISTS(
    SELECT 1 FROM public.user_profiles WHERE id = NEW.id
  ) INTO profile_exists;
  
  -- If profile already exists, just return
  IF profile_exists THEN
    RETURN NEW;
  END IF;

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
  BEGIN
    INSERT INTO public.user_profiles (id, name, created_at, updated_at)
    VALUES (NEW.id, display_name, now(), now())
    ON CONFLICT (id) DO UPDATE SET
      name = CASE 
        WHEN user_profiles.name = 'User' OR user_profiles.name IS NULL 
        THEN EXCLUDED.name 
        ELSE user_profiles.name 
      END,
      updated_at = now();
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error but don't fail the user creation
      RAISE WARNING 'Failed to create user profile in INSERT: %', SQLERRM;
  END;

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
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in create_missing_user_profiles: %', SQLERRM;
END;
$$;

-- Run the function to create any missing profiles
SELECT create_missing_user_profiles();

-- Ensure RLS is properly configured for user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Update RLS policies to ensure they work with Google OAuth users
-- First drop existing policies if they exist
DO $$
BEGIN
  -- Drop policies if they exist
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own profile' AND tablename = 'user_profiles') THEN
    DROP POLICY "Users can insert own profile" ON public.user_profiles;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own profile' AND tablename = 'user_profiles') THEN
    DROP POLICY "Users can read own profile" ON public.user_profiles;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read other profiles' AND tablename = 'user_profiles') THEN
    DROP POLICY "Users can read other profiles" ON public.user_profiles;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile' AND tablename = 'user_profiles') THEN
    DROP POLICY "Users can update own profile" ON public.user_profiles;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own profile' AND tablename = 'user_profiles') THEN
    DROP POLICY "Users can delete own profile" ON public.user_profiles;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow users to insert their own profile' AND tablename = 'user_profiles') THEN
    DROP POLICY "Allow users to insert their own profile" ON public.user_profiles;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users to read all user profiles' AND tablename = 'user_profiles') THEN
    DROP POLICY "Allow authenticated users to read all user profiles" ON public.user_profiles;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow users to update their own profile' AND tablename = 'user_profiles') THEN
    DROP POLICY "Allow users to update their own profile" ON public.user_profiles;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow users to delete their own profile' AND tablename = 'user_profiles') THEN
    DROP POLICY "Allow users to delete their own profile" ON public.user_profiles;
  END IF;
END
$$;

-- Create new policies with public access for reading
CREATE POLICY "Users can insert own profile"
  ON public.user_profiles
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can read own profile"
  ON public.user_profiles
  FOR SELECT
  TO public
  USING (auth.uid() = id);

CREATE POLICY "Users can read other profiles"
  ON public.user_profiles
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  TO public
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile"
  ON public.user_profiles
  FOR DELETE
  TO public
  USING (auth.uid() = id);