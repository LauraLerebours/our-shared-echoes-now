/*
  # Add INSERT policy for user profiles

  1. Security Changes
    - Add policy to allow authenticated users to insert their own user profile
    - This enables the application to create user profiles when they don't exist
    - Policy ensures users can only create profiles for themselves (auth.uid() = id)

  2. Policy Details
    - Target: user_profiles table
    - Operation: INSERT
    - Role: authenticated users
    - Condition: User can only insert profile with their own user ID
*/

-- Add policy to allow authenticated users to insert their own profile
CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);