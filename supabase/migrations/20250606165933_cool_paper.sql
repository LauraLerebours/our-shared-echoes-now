/*
  # Fix infinite recursion in board RLS policies

  1. Policy Changes
    - Simplify board_members policies to avoid circular references
    - Update boards policies to be more direct
    - Ensure no circular dependencies between boards and board_members tables

  2. Security
    - Maintain proper access control
    - Users can only see their own memberships
    - Board owners can manage their boards
    - Members can view boards they belong to
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Board members can view boards" ON boards;
DROP POLICY IF EXISTS "Board owners can manage members" ON board_members;
DROP POLICY IF EXISTS "Users can view their board memberships" ON board_members;

-- Create simplified board_members policies without circular references
CREATE POLICY "Users can view their own memberships"
  ON board_members
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Board owners can insert members"
  ON board_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM board_members existing_members
      WHERE existing_members.board_id = board_members.board_id
      AND existing_members.user_id = auth.uid()
      AND existing_members.role = 'owner'
    )
  );

CREATE POLICY "Board owners can update members"
  ON board_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM board_members existing_members
      WHERE existing_members.board_id = board_members.board_id
      AND existing_members.user_id = auth.uid()
      AND existing_members.role = 'owner'
    )
  );

CREATE POLICY "Board owners can delete members"
  ON board_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM board_members existing_members
      WHERE existing_members.board_id = board_members.board_id
      AND existing_members.user_id = auth.uid()
      AND existing_members.role = 'owner'
    )
  );

-- Create new boards policies that don't cause recursion
CREATE POLICY "Users can view boards they are members of"
  ON boards
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT board_id FROM board_members
      WHERE user_id = auth.uid()
    )
  );

-- Keep existing policies for board owners
CREATE POLICY "Board owners can update their boards"
  ON boards
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT board_id FROM board_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  )
  WITH CHECK (
    id IN (
      SELECT board_id FROM board_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "Board owners can delete their boards"
  ON boards
  FOR DELETE
  TO authenticated
  USING (
    id IN (
      SELECT board_id FROM board_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );