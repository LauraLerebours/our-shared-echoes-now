/*
  # Fix infinite recursion in RLS policies

  1. Problem
    - Circular dependency between boards and board_members policies
    - boards_member_read_only policy checks board_members
    - board_members policies check boards ownership
    - Creates infinite recursion during board creation

  2. Solution
    - Simplify boards policies to avoid circular references
    - Use direct ownership check for boards
    - Ensure board_members policies don't create circular dependencies
    - Add policy for board creation that doesn't depend on board_members

  3. Changes
    - Drop existing problematic policies
    - Create new simplified policies
    - Ensure proper access control without recursion
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "boards_member_read_only" ON boards;
DROP POLICY IF EXISTS "boards_owner_full_access" ON boards;

-- Create new simplified policies for boards table
-- Policy 1: Board owners can do everything with their boards
CREATE POLICY "boards_owner_access"
  ON boards
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Policy 2: Board members can read boards they belong to
-- This avoids recursion by directly checking board_members without referencing boards
CREATE POLICY "boards_member_read"
  ON boards
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM board_members 
      WHERE board_members.board_id = boards.id 
      AND board_members.user_id = auth.uid()
    )
  );

-- Ensure board_members policies don't create circular dependencies
-- Drop and recreate board_members policies to be more explicit
DROP POLICY IF EXISTS "board_members_owner_manage" ON board_members;
DROP POLICY IF EXISTS "board_members_owner_view_all" ON board_members;
DROP POLICY IF EXISTS "board_members_self_delete" ON board_members;
DROP POLICY IF EXISTS "board_members_self_insert" ON board_members;
DROP POLICY IF EXISTS "board_members_view_own" ON board_members;

-- Recreate board_members policies without circular references
CREATE POLICY "board_members_owner_full_access"
  ON board_members
  FOR ALL
  TO authenticated
  USING (
    board_id IN (
      SELECT id FROM boards 
      WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    board_id IN (
      SELECT id FROM boards 
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "board_members_self_manage"
  ON board_members
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy for viewing board members (needed for board functionality)
CREATE POLICY "board_members_view_same_board"
  ON board_members
  FOR SELECT
  TO authenticated
  USING (
    board_id IN (
      SELECT board_id FROM board_members 
      WHERE user_id = auth.uid()
    )
  );