/*
  # Fix Board Creation RLS Policies

  1. Security Updates
    - Update board creation policy to properly allow authenticated users to create boards
    - Ensure the policy works with the existing trigger system
    - Fix the WITH CHECK condition to match the actual board creation flow

  2. Changes
    - Drop existing problematic INSERT policy
    - Create new INSERT policy that allows authenticated users to create boards as owners
    - Ensure compatibility with the add_board_creator_trigger
*/

-- Drop the existing INSERT policy that might be causing issues
DROP POLICY IF EXISTS "Users can create boards as owners" ON boards;

-- Create a new INSERT policy that allows authenticated users to create boards
-- This policy allows any authenticated user to create a board where they are the owner
CREATE POLICY "Allow authenticated users to create boards"
  ON boards
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Ensure the policy for viewing boards is correct
DROP POLICY IF EXISTS "Users can view their boards and member boards" ON boards;

CREATE POLICY "Users can view their boards and member boards"
  ON boards
  FOR SELECT
  TO authenticated
  USING (
    (owner_id = auth.uid()) OR 
    (id IN (
      SELECT board_members.board_id
      FROM board_members
      WHERE board_members.user_id = auth.uid()
    ))
  );