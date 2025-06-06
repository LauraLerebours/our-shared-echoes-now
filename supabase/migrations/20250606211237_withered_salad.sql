/*
  # Reset User Profiles System

  This migration completely resets the user profiles system by:
  1. Dropping all existing user profile data
  2. Dropping the user_profiles table
  3. Dropping all related functions and triggers
  4. Recreating everything from scratch

  ## Changes Made
  1. Complete cleanup of existing user profile system
  2. Fresh user_profiles table with proper structure
  3. RLS policies for secure access
  4. Automatic profile creation on user signup
  5. Timestamp management functions
*/

-- Drop existing triggers first
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;

-- Drop existing functions
DROP FUNCTION IF EXISTS create_user_profile();
DROP FUNCTION IF EXISTS update_user_profile_updated_at();

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can read other profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Drop the entire user_profiles table (this will delete all data)
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Create fresh user_profiles table
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can read other profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to create user profile automatically on signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at on profile changes
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profile_updated_at();

-- Trigger to create profile automatically on user signup
CREATE TRIGGER create_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile();