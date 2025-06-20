/*
  # Fix User Profiles RLS Policies

  This migration fixes the Row Level Security policies for the user_profiles table
  to resolve authentication and profile creation issues.

  ## Changes Made

  1. **Policy Cleanup**
     - Drop existing conflicting policies that are causing RLS violations
     - Remove the TTL policy that may be interfering with profile access

  2. **New Policies**
     - Allow authenticated users to read all user profiles (needed for displaying creator names)
     - Allow users to insert their own profile during signup
     - Allow users to update their own profile
     - Allow users to read their own profile

  3. **Security**
     - Maintains proper access control while fixing the signup/profile creation flow
     - Ensures users can only modify their own profiles
     - Allows reading other profiles for display purposes (creator names, etc.)
*/

-- Drop existing policies that may be causing conflicts
DROP POLICY IF EXISTS "Policy to implement Time To Live (TTL)" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can read other profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

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