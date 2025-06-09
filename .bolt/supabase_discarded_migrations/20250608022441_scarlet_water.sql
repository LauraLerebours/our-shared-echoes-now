/*
  # Fix infinite recursion in board_members RLS policies

  1. Problem
    - The current RLS policies on board_members table create infinite recursion
    - The "Board owners can manage members" policy references board_members from within board_members policy
    - This causes circular dependency when Supabase tries to evaluate the policy

  2. Solution
    - Drop the problematic policies on board_members table
    - Create simpler, non-recursive policies that avoid circular references
    - Use direct ownership checks through boards table instead of self-referencing board_members

  3. New Policies
    - Allow users to view their own memberships
    - Allow users to insert themselves as members
    - Allow board owners to manage members (using boards.owner_id instead of recursive check)
*/

-- Drop existing problematic policies on board_members
DROP POLICY IF EXISTS "Board owners can manage members" ON board_members;
DROP POLICY IF EXISTS "Users can insert themselves as board members" ON board_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON board_members;

-- Create new non-recursive policies for board_members

-- Policy 1: Users can view their own memberships
CREATE POLICY "Users can view own memberships"
  ON board_members
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy 2: Users can insert themselves as board members
CREATE POLICY "Users can join boards"
  ON board_members
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Board owners can manage all members (using boards.owner_id to avoid recursion)
CREATE POLICY "Board owners manage members"
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
CREATE POLICY "Users can leave boards"
  ON board_members
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);