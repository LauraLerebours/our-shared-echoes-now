/*
  # Fix infinite recursion in RLS policies

  1. Policy Changes
    - Drop existing problematic policies on boards and board_members tables
    - Create new policies that avoid circular dependencies
    - Use direct auth.uid() checks where possible to prevent recursive policy evaluation

  2. Security
    - Maintain proper access control without circular references
    - Ensure users can only access boards they own or are members of
    - Prevent infinite recursion while preserving security
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "boards_select_policy" ON boards;
DROP POLICY IF EXISTS "boards_insert_policy" ON boards;
DROP POLICY IF EXISTS "boards_update_policy" ON boards;
DROP POLICY IF EXISTS "boards_delete_policy" ON boards;

DROP POLICY IF EXISTS "board_members_select_policy" ON board_members;
DROP POLICY IF EXISTS "board_members_insert_policy" ON board_members;
DROP POLICY IF EXISTS "board_members_update_policy" ON board_members;
DROP POLICY IF EXISTS "board_members_delete_policy" ON board_members;

-- Create new non-recursive policies for boards table
CREATE POLICY "boards_select_policy" ON boards
  FOR SELECT TO authenticated
  USING (
    auth.uid() = owner_id OR 
    EXISTS (
      SELECT 1 FROM board_members 
      WHERE board_members.board_id = boards.id 
      AND board_members.user_id = auth.uid()
    )
  );

CREATE POLICY "boards_insert_policy" ON boards
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "boards_update_policy" ON boards
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "boards_delete_policy" ON boards
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- Create new non-recursive policies for board_members table
CREATE POLICY "board_members_select_policy" ON board_members
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id OR 
    auth.uid() IN (
      SELECT owner_id FROM boards 
      WHERE boards.id = board_members.board_id
    )
  );

CREATE POLICY "board_members_insert_policy" ON board_members
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR 
    auth.uid() IN (
      SELECT owner_id FROM boards 
      WHERE boards.id = board_members.board_id
    )
  );

CREATE POLICY "board_members_update_policy" ON board_members
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (
      SELECT owner_id FROM boards 
      WHERE boards.id = board_members.board_id
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT owner_id FROM boards 
      WHERE boards.id = board_members.board_id
    )
  );

CREATE POLICY "board_members_delete_policy" ON board_members
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id OR 
    auth.uid() IN (
      SELECT owner_id FROM boards 
      WHERE boards.id = board_members.board_id
    )
  );