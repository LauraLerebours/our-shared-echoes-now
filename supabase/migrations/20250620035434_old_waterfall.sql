/*
  # Fix infinite recursion in memories_with_likes view

  1. Problem
    - The current RLS policies on the memories table are causing infinite recursion
    - This happens when the memories_with_likes view tries to apply RLS policies that reference back to the view itself
    - Complex policies with subqueries can create circular dependencies

  2. Solution
    - Simplify the RLS policies on the memories table to avoid recursion
    - Use direct table references instead of complex subqueries where possible
    - Ensure policies don't create circular dependencies with views

  3. Changes
    - Drop existing complex RLS policies on memories table
    - Create simplified, non-recursive policies
    - Maintain the same access control logic but without recursion
*/

-- First, drop all existing RLS policies on the memories table
DROP POLICY IF EXISTS "memories_board_member_delete" ON memories;
DROP POLICY IF EXISTS "memories_board_member_insert" ON memories;
DROP POLICY IF EXISTS "memories_board_member_read" ON memories;
DROP POLICY IF EXISTS "memories_board_member_update" ON memories;
DROP POLICY IF EXISTS "memories_owner_access" ON memories;

-- Create simplified, non-recursive RLS policies
-- These policies avoid complex subqueries that could cause recursion

-- Policy for reading memories - users can read memories from boards they have access to
CREATE POLICY "memories_read_access" ON memories
  FOR SELECT TO authenticated
  USING (
    access_code IN (
      SELECT b.access_code FROM boards b 
      WHERE b.owner_id = auth.uid() OR auth.uid() = ANY(COALESCE(b.member_ids, ARRAY[]::uuid[]))
    )
  );

-- Policy for inserting memories - users can insert memories to boards they have access to
CREATE POLICY "memories_insert_access" ON memories
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND
    access_code IN (
      SELECT b.access_code FROM boards b 
      WHERE b.owner_id = auth.uid() OR auth.uid() = ANY(COALESCE(b.member_ids, ARRAY[]::uuid[]))
    )
  );

-- Policy for updating memories - users can update memories they created or in boards they own
CREATE POLICY "memories_update_access" ON memories
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by OR
    access_code IN (
      SELECT b.access_code FROM boards b 
      WHERE b.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = created_by OR
    access_code IN (
      SELECT b.access_code FROM boards b 
      WHERE b.owner_id = auth.uid()
    )
  );

-- Policy for deleting memories - users can delete memories they created or in boards they own
CREATE POLICY "memories_delete_access" ON memories
  FOR DELETE TO authenticated
  USING (
    auth.uid() = created_by OR
    access_code IN (
      SELECT b.access_code FROM boards b 
      WHERE b.owner_id = auth.uid()
    )
  );

-- Ensure RLS is enabled on the memories table
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- Also check and fix any potential issues with the memories_with_likes view
-- The view should be simple and not cause recursion
DROP VIEW IF EXISTS memories_with_likes;

CREATE VIEW memories_with_likes AS
SELECT 
  m.*,
  COALESCE(like_counts.total_likes, 0) as total_likes
FROM memories m
LEFT JOIN (
  SELECT 
    memory_id,
    COUNT(*) as total_likes
  FROM memory_likes
  GROUP BY memory_id
) like_counts ON m.id = like_counts.memory_id;

-- Grant necessary permissions on the view
GRANT SELECT ON memories_with_likes TO authenticated;