/*
  # Fix boards table RLS policy for creation

  1. Security Changes
    - Drop existing conflicting INSERT policies on boards table
    - Create a new INSERT policy that allows authenticated users to create boards
    - Ensure the policy allows setting owner_id to the authenticated user's ID

  This resolves the RLS violation when creating new boards by ensuring authenticated users
  can insert boards where they set themselves as the owner.
*/

-- Drop existing INSERT policies that might be conflicting
DROP POLICY IF EXISTS "Anyone can create boards" ON boards;
DROP POLICY IF EXISTS "Users can create boards" ON boards;

-- Create a new INSERT policy that allows authenticated users to create boards
-- where they set themselves as the owner
CREATE POLICY "Authenticated users can create boards"
  ON boards
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);