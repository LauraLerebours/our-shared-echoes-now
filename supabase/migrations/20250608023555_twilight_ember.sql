/*
  # Fix infinite recursion in boards RLS policies

  1. Problem
    - The current RLS policies on the boards table create infinite recursion
    - The SELECT policy checks board_members table for access
    - But the INSERT trigger adds to board_members, which then tries to check boards again
    
  2. Solution
    - Simplify the INSERT policy to only check owner_id directly
    - Keep the SELECT policies separate for members vs owners
    - Ensure no circular dependencies during board creation

  3. Changes
    - Drop existing problematic policies
    - Create new simplified policies that avoid recursion
    - Maintain security while preventing circular references
*/

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "boards_member_select_policy" ON boards;
DROP POLICY IF EXISTS "boards_owner_delete_policy" ON boards;
DROP POLICY IF EXISTS "boards_owner_insert_policy" ON boards;
DROP POLICY IF EXISTS "boards_owner_select_policy" ON boards;
DROP POLICY IF EXISTS "boards_owner_update_policy" ON boards;

-- Create new policies that avoid recursion

-- Allow owners to insert their own boards (simple check, no recursion)
CREATE POLICY "boards_insert_policy"
  ON boards
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Allow owners to select their own boards (direct ownership check)
CREATE POLICY "boards_owner_select_policy"
  ON boards
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Allow board members to select boards they're members of
-- This is safe because it doesn't involve INSERT operations
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

-- Allow owners to update their own boards
CREATE POLICY "boards_update_policy"
  ON boards
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Allow owners to delete their own boards
CREATE POLICY "boards_delete_policy"
  ON boards
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);