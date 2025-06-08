/*
  # Fix infinite recursion in board_members RLS policies

  1. Problem
    - The existing RLS policies on board_members table are causing infinite recursion
    - This happens when policies reference the same table they're protecting

  2. Solution
    - Drop all existing problematic policies
    - Create new policies that avoid self-referencing board_members table
    - Use boards.owner_id instead of checking board_members roles to determine ownership

  3. Changes
    - Remove recursive policy checks
    - Simplify policy logic to prevent circular dependencies
    - Maintain same security model but with non-recursive implementation
*/

-- Drop ALL existing policies on board_members to start fresh
DROP POLICY IF EXISTS "Board owners can manage members" ON board_members;
DROP POLICY IF EXISTS "Board owners manage members" ON board_members;
DROP POLICY IF EXISTS "Users can insert themselves as board members" ON board_members;
DROP POLICY IF EXISTS "Users can join boards" ON board_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON board_members;
DROP POLICY IF EXISTS "Users can view own memberships" ON board_members;
DROP POLICY IF EXISTS "Users can leave boards" ON board_members;

-- Create new non-recursive policies for board_members

-- Policy 1: Users can view their own memberships (simple user_id check)
CREATE POLICY "view_own_memberships"
  ON board_members
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy 2: Users can insert themselves as board members
CREATE POLICY "join_boards"
  ON board_members
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Board owners can manage all members (using boards.owner_id to avoid recursion)
CREATE POLICY "owners_manage_members"
  ON board_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boards 
      WHERE boards.id = board_members.board_id 
      AND boards.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boards 
      WHERE boards.id = board_members.board_id 
      AND boards.owner_id = auth.uid()
    )
  );

-- Policy 4: Users can delete their own memberships (leave boards)
CREATE POLICY "leave_boards"
  ON board_members
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Also fix the boards policy that might be causing issues
DROP POLICY IF EXISTS "Users can view their boards and member boards" ON boards;

-- Create a simpler boards policy that doesn't cause recursion
CREATE POLICY "view_accessible_boards"
  ON boards
  FOR SELECT
  TO authenticated
  USING (
    -- User owns the board
    auth.uid() = owner_id
    OR
    -- User is a member (but avoid recursion by using a simple EXISTS)
    EXISTS (
      SELECT 1 FROM board_members bm
      WHERE bm.board_id = boards.id 
      AND bm.user_id = auth.uid()
    )
  );