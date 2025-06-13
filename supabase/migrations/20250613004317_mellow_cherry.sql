/*
  # Restrict memory deletion to owners only

  1. Security Changes
    - Drop existing delete policies on memories table
    - Add new policy that only allows memory creators to delete their own memories
    - Ensure proper access control for memory deletion

  2. Changes Made
    - Remove any existing delete policies that might be too permissive
    - Add "memories_delete_own" policy for authenticated users to delete only their own memories
*/

-- Drop any existing delete policies on memories
DROP POLICY IF EXISTS "memories_access" ON memories;
DROP POLICY IF EXISTS "memories_creator_access" ON memories;

-- Recreate the access policies for other operations (select, insert, update)
CREATE POLICY "memories_read_access" ON memories
  FOR SELECT TO authenticated
  USING (
    access_code IN (
      SELECT boards.access_code FROM boards 
      WHERE (auth.uid() = boards.owner_id OR auth.uid() = ANY(boards.member_ids))
    )
  );

CREATE POLICY "memories_insert_access" ON memories
  FOR INSERT TO authenticated
  WITH CHECK (
    access_code IN (
      SELECT boards.access_code FROM boards 
      WHERE (auth.uid() = boards.owner_id OR auth.uid() = ANY(boards.member_ids))
    )
    AND auth.uid() = created_by
  );

CREATE POLICY "memories_update_access" ON memories
  FOR UPDATE TO authenticated
  USING (
    access_code IN (
      SELECT boards.access_code FROM boards 
      WHERE (auth.uid() = boards.owner_id OR auth.uid() = ANY(boards.member_ids))
    )
  )
  WITH CHECK (
    access_code IN (
      SELECT boards.access_code FROM boards 
      WHERE (auth.uid() = boards.owner_id OR auth.uid() = ANY(boards.member_ids))
    )
  );

-- Add new delete policy - only memory creators can delete their own memories
CREATE POLICY "memories_delete_own" ON memories
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by);