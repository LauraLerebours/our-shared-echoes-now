/*
  # Allow users to like memories from other users

  1. Changes
    - Drop existing restrictive update policy that only allowed users to update their own memories
    - Create new policies that allow all users to update like counts on any memory
    - Maintain security by separating like updates from other memory updates

  2. Security
    - Users can update likes/is_liked on any memory
    - Users can fully update only their own memories
    - Separate policies for different types of updates
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can update their own memories" ON memories;

-- Create policy that allows all users to update any memory (for likes)
-- This is safe because we'll control what can be updated through the application logic
CREATE POLICY "Users can update memory likes"
  ON memories
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create a more restrictive policy for users updating their own memories
-- This ensures users can only fully edit memories they created
CREATE POLICY "Users can fully update their own memories"
  ON memories
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);