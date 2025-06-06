/*
  # Fix Board INSERT RLS Policy

  1. Policy Updates
    - Drop the existing INSERT policy that may be causing issues
    - Create a new INSERT policy that properly allows authenticated users to create boards
    - Ensure the policy correctly handles the owner_id assignment

  2. Security
    - Maintain RLS protection while allowing proper board creation
    - Ensure users can only create boards where they are the owner
*/

-- Drop the existing INSERT policy that might be causing issues
DROP POLICY IF EXISTS "Authenticated users can create boards" ON boards;

-- Create a new INSERT policy that allows authenticated users to create boards
-- The policy ensures that the owner_id must match the authenticated user's ID
CREATE POLICY "Users can create boards as owners"
  ON boards
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Also ensure we have a proper SELECT policy for board owners
DROP POLICY IF EXISTS "Users can view boards they are members of" ON boards;

CREATE POLICY "Users can view their boards and member boards"
  ON boards
  FOR SELECT
  TO authenticated
  USING (
    -- User is the owner
    owner_id = auth.uid() 
    OR 
    -- User is a member of the board
    id IN (
      SELECT board_id 
      FROM board_members 
      WHERE user_id = auth.uid()
    )
  );