/*
  # Fix infinite recursion in boards RLS policies

  1. Problem
    - The current RLS policies on the boards table are causing infinite recursion
    - This happens when INSERT operations trigger policies that reference the same table
    
  2. Solution
    - Drop existing problematic policies
    - Create simpler, non-recursive policies
    - Ensure INSERT policies don't cause loops with SELECT policies
    
  3. Security
    - Maintain proper access control
    - Owners can manage their boards
    - Members can view boards they belong to
*/

-- Drop existing policies that might cause recursion
DROP POLICY IF EXISTS "boards_select_member_policy" ON boards;
DROP POLICY IF EXISTS "boards_select_owner_policy" ON boards;
DROP POLICY IF EXISTS "boards_insert_policy" ON boards;
DROP POLICY IF EXISTS "boards_update_policy" ON boards;
DROP POLICY IF EXISTS "boards_delete_policy" ON boards;

-- Create new, simpler policies that avoid recursion

-- Allow owners to see their own boards
CREATE POLICY "boards_owner_select_policy"
  ON boards
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Allow board members to see boards (using a simpler approach)
CREATE POLICY "boards_member_select_policy"
  ON boards
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT board_id 
      FROM board_members 
      WHERE user_id = auth.uid()
    )
  );

-- Allow authenticated users to insert boards they own
CREATE POLICY "boards_owner_insert_policy"
  ON boards
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Allow owners to update their boards
CREATE POLICY "boards_owner_update_policy"
  ON boards
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Allow owners to delete their boards
CREATE POLICY "boards_owner_delete_policy"
  ON boards
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);