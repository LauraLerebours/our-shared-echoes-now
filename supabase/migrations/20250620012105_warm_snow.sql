/*
  # Fix User Profiles RLS Policies

  1. Changes
     - Drops conflicting RLS policies on user_profiles table
     - Creates clean, simple policies that allow:
       - All authenticated users to read all profiles
       - Users to create their own profile
       - Users to update their own profile
       - Users to delete their own profile
     - Fixes the "new row violates row-level security policy" error

  2. Security
     - Maintains proper security by ensuring users can only modify their own profiles
     - Allows read access to all profiles (needed for displaying user names)
*/

-- Drop existing policies that may be causing conflicts
DROP POLICY IF EXISTS "Policy to implement Time To Live (TTL)" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can read other profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to read all user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Allow users to delete their own profile" ON user_profiles;

-- Create new, cleaner policies
CREATE POLICY "Allow authenticated users to read all user profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow users to insert their own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow users to update their own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow users to delete their own profile"
  ON user_profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);