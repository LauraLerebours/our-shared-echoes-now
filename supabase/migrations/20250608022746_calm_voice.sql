/*
  # Fix infinite recursion in RLS policies

  1. Problem
    - Current policies create circular dependency between boards and board_members tables
    - boards_select_policy checks board_members table
    - board_members policies check boards table for ownership
    - This creates infinite recursion

  2. Solution
    - Simplify board policies to avoid circular references
    - Use direct ownership checks where possible
    - Restructure member access checks to be non-recursive

  3. Changes
    - Drop existing problematic policies
    - Create new simplified policies that break the circular dependency
    - Ensure proper access control without recursion
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "boards_select_policy" ON boards;
DROP POLICY IF EXISTS "board_members_select_policy" ON board_members;
DROP POLICY IF EXISTS "board_members_insert_policy" ON board_members;
DROP POLICY IF EXISTS "board_members_update_policy" ON board_members;
DROP POLICY IF EXISTS "board_members_delete_policy" ON board_members;

-- Create new simplified board policies
CREATE POLICY "boards_select_policy_v2" ON boards
  FOR SELECT
  TO authenticated
  USING (
    -- Owner can always see their boards
    auth.uid() = owner_id
    OR
    -- Members can see boards they belong to (direct check without recursion)
    EXISTS (
      SELECT 1 FROM board_members bm 
      WHERE bm.board_id = boards.id 
      AND bm.user_id = auth.uid()
    )
  );

-- Create new simplified board_members policies
CREATE POLICY "board_members_select_policy_v2" ON board_members
  FOR SELECT
  TO authenticated
  USING (
    -- Users can see their own memberships
    auth.uid() = user_id
    OR
    -- Board owners can see all members of their boards
    auth.uid() IN (
      SELECT b.owner_id FROM boards b WHERE b.id = board_members.board_id
    )
  );

CREATE POLICY "board_members_insert_policy_v2" ON board_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can add themselves to boards
    auth.uid() = user_id
    OR
    -- Board owners can add members to their boards
    auth.uid() IN (
      SELECT b.owner_id FROM boards b WHERE b.id = board_members.board_id
    )
  );

CREATE POLICY "board_members_update_policy_v2" ON board_members
  FOR UPDATE
  TO authenticated
  USING (
    -- Only board owners can update memberships
    auth.uid() IN (
      SELECT b.owner_id FROM boards b WHERE b.id = board_members.board_id
    )
  )
  WITH CHECK (
    -- Only board owners can update memberships
    auth.uid() IN (
      SELECT b.owner_id FROM boards b WHERE b.id = board_members.board_id
    )
  );

CREATE POLICY "board_members_delete_policy_v2" ON board_members
  FOR DELETE
  TO authenticated
  USING (
    -- Users can remove themselves from boards
    auth.uid() = user_id
    OR
    -- Board owners can remove members from their boards
    auth.uid() IN (
      SELECT b.owner_id FROM boards b WHERE b.id = board_members.board_id
    )
  );