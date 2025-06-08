/*
  # Fix infinite recursion in boards RLS policy

  1. Policy Changes
    - Drop the existing problematic insert policy for boards
    - Create a new simplified insert policy that prevents recursion
    - The new policy will allow authenticated users to insert boards where they set themselves as owner

  2. Security
    - Maintains security by ensuring users can only create boards where they are the owner
    - Removes the circular dependency that was causing infinite recursion
*/

-- Drop the existing problematic insert policy
DROP POLICY IF EXISTS "boards_insert_policy" ON boards;

-- Create a new simplified insert policy that prevents recursion
CREATE POLICY "boards_insert_policy_v2" 
  ON boards 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = owner_id);