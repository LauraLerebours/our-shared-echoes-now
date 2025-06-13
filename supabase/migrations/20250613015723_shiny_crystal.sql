/*
  # Fix boards loading performance issues

  1. Database Optimizations
    - Simplify RLS policies to remove circular dependencies
    - Add proper indexing for better query performance
    - Clean up redundant policies

  2. Security Updates
    - Streamlined board access policies
    - Improved memory access policies
    - Better performance for member_ids array queries

  3. Performance Improvements
    - GIN index on member_ids for faster array operations
    - Simplified policy logic to reduce query complexity
    - Remove duplicate/conflicting policies
*/

-- First, drop existing problematic policies
DROP POLICY IF EXISTS "boards_access" ON boards;

-- Create a simplified, high-performance board access policy
CREATE POLICY "boards_access_optimized" ON boards
  FOR ALL TO authenticated
  USING (
    auth.uid() = owner_id OR 
    auth.uid() = ANY(member_ids)
  )
  WITH CHECK (
    auth.uid() = owner_id OR 
    auth.uid() = ANY(member_ids)
  );

-- Ensure we have the GIN index for member_ids array operations (if not exists)
CREATE INDEX IF NOT EXISTS idx_boards_member_ids_gin ON boards USING gin (member_ids);

-- Add additional performance indexes
CREATE INDEX IF NOT EXISTS idx_boards_owner_id_btree ON boards USING btree (owner_id);
CREATE INDEX IF NOT EXISTS idx_boards_created_at_btree ON boards USING btree (created_at DESC);

-- Optimize memory policies to work better with the simplified board structure
DROP POLICY IF EXISTS "memories_read_access" ON memories;
DROP POLICY IF EXISTS "memories_insert_access" ON memories;
DROP POLICY IF EXISTS "memories_update_access" ON memories;

-- Create optimized memory policies
CREATE POLICY "memories_access_optimized" ON memories
  FOR ALL TO authenticated
  USING (
    access_code IN (
      SELECT b.access_code FROM boards b 
      WHERE auth.uid() = b.owner_id OR auth.uid() = ANY(b.member_ids)
    )
  )
  WITH CHECK (
    access_code IN (
      SELECT b.access_code FROM boards b 
      WHERE auth.uid() = b.owner_id OR auth.uid() = ANY(b.member_ids)
    ) AND
    auth.uid() = created_by
  );

-- Add index to improve memory access performance
CREATE INDEX IF NOT EXISTS idx_memories_access_code_btree ON memories USING btree (access_code);

-- Create a function to safely fetch user boards with better performance
CREATE OR REPLACE FUNCTION get_user_boards(user_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  access_code text,
  share_code text,
  owner_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  member_ids uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.access_code,
    b.share_code,
    b.owner_id,
    b.created_at,
    b.updated_at,
    b.member_ids
  FROM boards b
  WHERE b.owner_id = user_id OR user_id = ANY(b.member_ids)
  ORDER BY b.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_boards(uuid) TO authenticated;

-- Analyze tables to update statistics for better query planning
ANALYZE boards;
ANALYZE memories;
ANALYZE access_codes;