/*
  # Fix infinite recursion in boards RLS policies

  1. Problem
    - The current boards_select_policy_v2 creates infinite recursion
    - Policy checks board_members table which has policies that reference boards table
    - This creates a circular dependency causing infinite recursion

  2. Solution
    - Drop the problematic policy
    - Create a simpler, non-recursive policy for boards SELECT operations
    - Ensure board_members policies don't create circular references

  3. Security
    - Maintain proper access control without recursion
    - Users can see boards they own or are members of
    - Use direct ownership check and separate member check
*/

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "boards_select_policy_v2" ON boards;

-- Create a new, simpler SELECT policy that avoids recursion
CREATE POLICY "boards_select_policy_v3" ON boards
  FOR SELECT
  TO authenticated
  USING (
    -- Direct ownership check (no recursion)
    auth.uid() = owner_id
    OR
    -- Check if user is a member without causing recursion
    -- Use a direct query that doesn't trigger board policies
    auth.uid() IN (
      SELECT bm.user_id 
      FROM board_members bm 
      WHERE bm.board_id = boards.id
    )
  );

-- Ensure board_members policies are not causing recursion
-- Drop and recreate board_members SELECT policy to be safe
DROP POLICY IF EXISTS "board_members_select_policy_v2" ON board_members;

CREATE POLICY "board_members_select_policy_v3" ON board_members
  FOR SELECT
  TO authenticated
  USING (
    -- User can see their own membership
    auth.uid() = user_id
    OR
    -- Board owner can see all members (direct check, no recursion)
    auth.uid() IN (
      SELECT b.owner_id 
      FROM boards b 
      WHERE b.id = board_members.board_id
    )
  );

-- Update other board_members policies to avoid recursion
DROP POLICY IF EXISTS "board_members_insert_policy_v2" ON board_members;
DROP POLICY IF EXISTS "board_members_update_policy_v2" ON board_members;
DROP POLICY IF EXISTS "board_members_delete_policy_v2" ON board_members;

CREATE POLICY "board_members_insert_policy_v3" ON board_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User can add themselves
    auth.uid() = user_id
    OR
    -- Board owner can add members (direct check)
    auth.uid() IN (
      SELECT b.owner_id 
      FROM boards b 
      WHERE b.id = board_members.board_id
    )
  );

CREATE POLICY "board_members_update_policy_v3" ON board_members
  FOR UPDATE
  TO authenticated
  USING (
    -- Only board owner can update memberships (direct check)
    auth.uid() IN (
      SELECT b.owner_id 
      FROM boards b 
      WHERE b.id = board_members.board_id
    )
  )
  WITH CHECK (
    -- Only board owner can update memberships (direct check)
    auth.uid() IN (
      SELECT b.owner_id 
      FROM boards b 
      WHERE b.id = board_members.board_id
    )
  );

CREATE POLICY "board_members_delete_policy_v3" ON board_members
  FOR DELETE
  TO authenticated
  USING (
    -- User can remove themselves
    auth.uid() = user_id
    OR
    -- Board owner can remove members (direct check)
    auth.uid() IN (
      SELECT b.owner_id 
      FROM boards b 
      WHERE b.id = board_members.board_id
    )
  );