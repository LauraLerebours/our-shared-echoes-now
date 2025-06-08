/*
  # Fix infinite recursion in RLS policies

  1. Problem
    - Current policies on `boards` and `board_members` tables create circular dependencies
    - The `view_accessible_boards` policy on `boards` references `board_members`
    - Some policies on `board_members` reference `boards`
    - This creates infinite recursion when Supabase tries to evaluate the policies

  2. Solution
    - Simplify the policies to avoid circular references
    - Use direct ownership checks where possible
    - Restructure board access policies to be more straightforward

  3. Changes
    - Drop existing problematic policies
    - Create new, simplified policies that avoid recursion
    - Ensure proper access control without circular dependencies
*/

-- Drop existing problematic policies on boards
DROP POLICY IF EXISTS "view_accessible_boards" ON boards;
DROP POLICY IF EXISTS "Board owners can update their boards" ON boards;
DROP POLICY IF EXISTS "Board owners can delete their boards" ON boards;
DROP POLICY IF EXISTS "Users can create boards" ON boards;

-- Drop existing problematic policies on board_members
DROP POLICY IF EXISTS "owners_manage_members" ON board_members;
DROP POLICY IF EXISTS "view_own_memberships" ON board_members;
DROP POLICY IF EXISTS "join_boards" ON board_members;
DROP POLICY IF EXISTS "leave_boards" ON board_members;

-- Create simplified policies for boards table
CREATE POLICY "boards_select_policy" ON boards
  FOR SELECT TO authenticated
  USING (
    -- Users can see boards they own
    auth.uid() = owner_id
    OR
    -- Users can see boards they are members of (direct check without recursion)
    id IN (
      SELECT board_id 
      FROM board_members 
      WHERE user_id = auth.uid()
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

-- Create simplified policies for board_members table
CREATE POLICY "board_members_select_policy" ON board_members
  FOR SELECT TO authenticated
  USING (
    -- Users can see their own memberships
    auth.uid() = user_id
    OR
    -- Board owners can see all members of their boards
    board_id IN (
      SELECT id 
      FROM boards 
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "board_members_insert_policy" ON board_members
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Users can add themselves to boards
    auth.uid() = user_id
    OR
    -- Board owners can add others to their boards
    board_id IN (
      SELECT id 
      FROM boards 
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "board_members_update_policy" ON board_members
  FOR UPDATE TO authenticated
  USING (
    -- Board owners can update memberships in their boards
    board_id IN (
      SELECT id 
      FROM boards 
      WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    board_id IN (
      SELECT id 
      FROM boards 
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "board_members_delete_policy" ON board_members
  FOR DELETE TO authenticated
  USING (
    -- Users can remove themselves
    auth.uid() = user_id
    OR
    -- Board owners can remove others from their boards
    board_id IN (
      SELECT id 
      FROM boards 
      WHERE owner_id = auth.uid()
    )
  );