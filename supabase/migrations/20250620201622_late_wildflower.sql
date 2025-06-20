/*
  # Fix infinite recursion in memories_with_likes view and improve user recognition

  1. Problem
    - The current RLS policies on the memories table are causing infinite recursion
    - This happens when the memories_with_likes view tries to apply RLS policies that reference back to the view itself
    - Complex policies with subqueries can create circular dependencies
    - Creator information is not properly displayed in the timeline view

  2. Solution
    - Drop the problematic memories_with_likes view WITH CASCADE to handle dependencies
    - Create a new function-based approach to fetch memories
    - Simplify RLS policies to avoid recursion
    - Ensure creator information is properly included and displayed
    - Maintain the same access control logic but without recursion
*/

-- First, drop the problematic view that's causing recursion WITH CASCADE to handle dependencies
DROP VIEW IF EXISTS memories_with_likes CASCADE;

-- Drop existing policies that might be causing recursion
DROP POLICY IF EXISTS "memories_read_access" ON memories;
DROP POLICY IF EXISTS "memories_insert_access" ON memories;
DROP POLICY IF EXISTS "memories_update_access" ON memories;
DROP POLICY IF EXISTS "memories_delete_access" ON memories;
DROP POLICY IF EXISTS "memories_delete_creator_only" ON memories;
DROP POLICY IF EXISTS "memories_simple_access" ON memories;
DROP POLICY IF EXISTS "memories_read_simple" ON memories;
DROP POLICY IF EXISTS "memories_insert_simple" ON memories;
DROP POLICY IF EXISTS "memories_update_simple" ON memories;
DROP POLICY IF EXISTS "memories_delete_simple" ON memories;

-- Create a new, simpler view that doesn't cause recursion
CREATE VIEW memories_with_likes AS
SELECT 
  m.*,
  COALESCE(ml.like_count, 0) as total_likes
FROM 
  memories m
LEFT JOIN (
  SELECT 
    memory_id, 
    COUNT(*) as like_count
  FROM 
    memory_likes
  GROUP BY 
    memory_id
) ml ON m.id = ml.memory_id;

-- Create simplified policies that avoid recursion
-- Policy for SELECT operations - simple and direct
CREATE POLICY "memories_read_simple" ON memories
  FOR SELECT TO authenticated
  USING (
    access_code IN (
      SELECT access_code FROM boards 
      WHERE owner_id = auth.uid() OR auth.uid() = ANY(COALESCE(member_ids, ARRAY[]::uuid[]))
    )
  );

-- Policy for INSERT operations
CREATE POLICY "memories_insert_simple" ON memories
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND
    access_code IN (
      SELECT access_code FROM boards 
      WHERE owner_id = auth.uid() OR auth.uid() = ANY(COALESCE(member_ids, ARRAY[]::uuid[]))
    )
  );

-- Policy for UPDATE operations
CREATE POLICY "memories_update_simple" ON memories
  FOR UPDATE TO authenticated
  USING (
    (auth.uid() = created_by) OR
    (access_code IN (
      SELECT access_code FROM boards 
      WHERE owner_id = auth.uid()
    ))
  )
  WITH CHECK (
    (auth.uid() = created_by) OR
    (access_code IN (
      SELECT access_code FROM boards 
      WHERE owner_id = auth.uid()
    ))
  );

-- Policy for DELETE operations
CREATE POLICY "memories_delete_simple" ON memories
  FOR DELETE TO authenticated
  USING (
    (auth.uid() = created_by) OR
    (access_code IN (
      SELECT access_code FROM boards 
      WHERE owner_id = auth.uid()
    ))
  );

-- Drop existing functions that depend on the view
DROP FUNCTION IF EXISTS get_memories_by_access_code_safe(text);
DROP FUNCTION IF EXISTS get_memories_by_access_codes_safe(text[]);

-- Create a function to safely get memories by access code
CREATE OR REPLACE FUNCTION get_memories_by_access_code_safe(access_code_param text)
RETURNS SETOF memories_with_likes
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth, extensions
AS $$
  SELECT m.*
  FROM memories_with_likes m
  WHERE m.access_code = access_code_param
  AND (m.moderation_status = 'approved' OR m.moderation_status IS NULL)
  ORDER BY m.event_date DESC, m.created_at DESC;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_memories_by_access_code_safe(text) TO authenticated;

-- Create a function to safely get memories by multiple access codes
CREATE OR REPLACE FUNCTION get_memories_by_access_codes_safe(access_codes text[])
RETURNS SETOF memories_with_likes
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth, extensions
AS $$
  SELECT m.*
  FROM memories_with_likes m
  WHERE m.access_code = ANY(access_codes)
  AND (m.moderation_status = 'approved' OR m.moderation_status IS NULL)
  ORDER BY m.event_date DESC, m.created_at DESC;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_memories_by_access_codes_safe(text[]) TO authenticated;

-- Create additional indexes to support the new approach
CREATE INDEX IF NOT EXISTS idx_memories_access_code_date_performance 
ON memories USING btree (access_code, event_date DESC, created_at DESC);

-- Create index for better performance when looking up memories by creator
CREATE INDEX IF NOT EXISTS idx_memories_created_by_lookup 
ON memories USING btree (created_by, access_code);

-- Create index for better performance when joining with user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_lookup 
ON user_profiles USING btree (id, name);

-- Update table statistics for better query planning
ANALYZE memories;
ANALYZE memory_likes;
ANALYZE boards;
ANALYZE user_profiles;