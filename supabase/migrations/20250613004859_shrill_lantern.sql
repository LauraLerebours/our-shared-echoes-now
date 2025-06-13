/*
  # Fix memory deletion policy to only allow owners

  1. Security
    - Drop existing delete policies
    - Create strict delete policy that only allows memory creators to delete their own memories
    - Ensure created_by field is properly populated and checked
*/

-- Drop all existing policies on memories to start fresh
DROP POLICY IF EXISTS "memories_delete_own" ON memories;
DROP POLICY IF EXISTS "memories_read_access" ON memories;
DROP POLICY IF EXISTS "memories_insert_access" ON memories;
DROP POLICY IF EXISTS "memories_update_access" ON memories;

-- Recreate read policy
CREATE POLICY "memories_read_access" ON memories
  FOR SELECT TO authenticated
  USING (
    access_code IN (
      SELECT boards.access_code FROM boards 
      WHERE (auth.uid() = boards.owner_id OR auth.uid() = ANY(boards.member_ids))
    )
  );

-- Recreate insert policy with strict created_by requirement
CREATE POLICY "memories_insert_access" ON memories
  FOR INSERT TO authenticated
  WITH CHECK (
    access_code IN (
      SELECT boards.access_code FROM boards 
      WHERE (auth.uid() = boards.owner_id OR auth.uid() = ANY(boards.member_ids))
    )
    AND auth.uid() = created_by
    AND created_by IS NOT NULL
  );

-- Recreate update policy - only allow updates by board members
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

-- Create strict delete policy - ONLY memory creators can delete their own memories
CREATE POLICY "memories_delete_creator_only" ON memories
  FOR DELETE TO authenticated
  USING (
    created_by IS NOT NULL 
    AND auth.uid() = created_by
    AND auth.uid()::text = created_by::text
  );

-- Ensure all existing memories have a created_by value
-- This will set created_by to the first board owner for any memories that don't have it set
UPDATE memories 
SET created_by = (
  SELECT boards.owner_id 
  FROM boards 
  WHERE boards.access_code = memories.access_code 
  LIMIT 1
)
WHERE created_by IS NULL;