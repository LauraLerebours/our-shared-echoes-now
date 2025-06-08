/*
  # Fix infinite recursion in boards RLS policies

  1. Problem
    - The current RLS policies on the boards table are causing infinite recursion
    - This happens when policies reference related tables that have triggers or other policies creating circular dependencies

  2. Solution
    - Drop existing problematic policies
    - Create simpler, non-recursive policies
    - Ensure policies don't create circular dependencies with triggers

  3. Changes
    - Remove complex policies that check board_members table
    - Create simpler policies that avoid recursion
    - Maintain security while preventing infinite loops
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "boards_select_policy_v3" ON boards;
DROP POLICY IF EXISTS "boards_insert_policy_v2" ON boards;
DROP POLICY IF EXISTS "boards_update_policy" ON boards;
DROP POLICY IF EXISTS "boards_delete_policy" ON boards;

-- Create new, simpler policies that avoid recursion

-- Allow users to select boards they own
CREATE POLICY "boards_select_owner_policy"
  ON boards
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Allow users to select boards where they are members (without recursion)
CREATE POLICY "boards_select_member_policy"
  ON boards
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM board_members bm 
      WHERE bm.board_id = boards.id 
      AND bm.user_id = auth.uid()
    )
  );

-- Allow users to insert boards they will own
CREATE POLICY "boards_insert_policy"
  ON boards
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Allow users to update boards they own
CREATE POLICY "boards_update_policy"
  ON boards
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Allow users to delete boards they own
CREATE POLICY "boards_delete_policy"
  ON boards
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);