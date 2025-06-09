
-- Fix infinite recursion in RLS policies by eliminating circular dependencies

-- Drop ALL existing policies on both tables to ensure clean state
DROP POLICY IF EXISTS "boards_owner_access" ON boards;
DROP POLICY IF EXISTS "boards_member_read" ON boards;
DROP POLICY IF EXISTS "boards_owner_full_access" ON boards;
DROP POLICY IF EXISTS "boards_member_read_only" ON boards;

DROP POLICY IF EXISTS "board_members_owner_full_access" ON board_members;
DROP POLICY IF EXISTS "board_members_self_manage" ON board_members;
DROP POLICY IF EXISTS "board_members_view_same_board" ON board_members;
DROP POLICY IF EXISTS "board_members_self_access" ON board_members;
DROP POLICY IF EXISTS "board_members_owner_manage" ON board_members;

-- Create simple, non-recursive policies for boards table
-- Policy 1: Board owners can do everything with their boards
CREATE POLICY "boards_owner_access"
  ON boards
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Policy 2: Board members can read boards (simple subquery, no recursion)
CREATE POLICY "boards_member_read"
  ON boards
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT bm.board_id 
      FROM board_members bm 
      WHERE bm.user_id = auth.uid()
    )
  );

-- Create simple, non-recursive policies for board_members table
-- Policy 1: Users can manage their own memberships
CREATE POLICY "board_members_user_access"
  ON board_members
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy 2: Board owners can manage members (direct ownership check)
CREATE POLICY "board_members_owner_access"
  ON board_members
  FOR ALL
  TO authenticated
  USING (
    board_id IN (
      SELECT b.id FROM boards b WHERE b.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    board_id IN (
      SELECT b.id FROM boards b WHERE b.owner_id = auth.uid()
    )
  );

-- Ensure RLS is enabled
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;
