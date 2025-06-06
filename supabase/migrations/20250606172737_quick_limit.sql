/*
  # Fix board_members INSERT policy for board creation

  1. Security Changes
    - Drop the existing restrictive INSERT policy for board_members
    - Add a new policy that allows users to insert themselves as members
    - This enables the board creation trigger to work properly

  The issue was that the existing INSERT policy required the user to already be a board owner
  to add members, but when creating a new board, the user needs to be added as the first member.
*/

-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Board owners can insert members" ON board_members;

-- Create a new policy that allows users to insert themselves as members
-- This is needed for the board creation trigger to work
CREATE POLICY "Users can insert themselves as board members"
  ON board_members
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Also allow board owners to insert other members (for inviting users)
CREATE POLICY "Board owners can insert other members"
  ON board_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM board_members existing_members
      WHERE existing_members.board_id = board_members.board_id
        AND existing_members.user_id = auth.uid()
        AND existing_members.role = 'owner'
    )
  );