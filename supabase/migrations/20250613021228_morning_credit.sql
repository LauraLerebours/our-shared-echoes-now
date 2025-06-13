/*
  # Performance Optimization for Boards and Memories

  1. Database Optimizations
    - Add missing indexes for better query performance
    - Optimize RLS policies to reduce complexity
    - Add database-level performance improvements
  
  2. Query Optimizations
    - Create optimized functions for common operations
    - Reduce policy complexity
    - Improve index usage
*/

-- Drop existing policies that might be causing performance issues
DROP POLICY IF EXISTS "boards_access_optimized" ON boards;
DROP POLICY IF EXISTS "memories_access_optimized" ON memories;

-- Create simplified, high-performance policies
CREATE POLICY "boards_simple_access" ON boards
  FOR ALL TO authenticated
  USING (
    auth.uid() = owner_id OR 
    auth.uid() = ANY(member_ids)
  );

CREATE POLICY "memories_simple_access" ON memories
  FOR ALL TO authenticated
  USING (
    access_code IN (
      SELECT access_code FROM boards 
      WHERE auth.uid() = owner_id OR auth.uid() = ANY(member_ids)
    )
  );

-- Ensure all necessary indexes exist for optimal performance
CREATE INDEX IF NOT EXISTS idx_boards_owner_id_btree ON boards USING btree (owner_id);
CREATE INDEX IF NOT EXISTS idx_boards_member_ids_gin ON boards USING gin (member_ids);
CREATE INDEX IF NOT EXISTS idx_boards_access_code_btree ON boards USING btree (access_code);
CREATE INDEX IF NOT EXISTS idx_boards_created_at_btree ON boards USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memories_access_code_btree ON memories USING btree (access_code);
CREATE INDEX IF NOT EXISTS idx_memories_created_by ON memories USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_memories_access_code_created_by ON memories USING btree (access_code, created_by);

-- Create a fast function to get user boards without complex RLS
CREATE OR REPLACE FUNCTION get_user_boards_fast(user_id uuid)
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
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
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
$$;

-- Create a fast function to get memories for a user
CREATE OR REPLACE FUNCTION get_user_memories_fast(user_id uuid)
RETURNS TABLE (
  id uuid,
  caption text,
  media_url text,
  is_video boolean,
  event_date timestamp,
  location text,
  likes integer,
  created_at timestamp,
  is_liked boolean,
  access_code text,
  board_id uuid,
  created_by uuid
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    m.id,
    m.caption,
    m.media_url,
    m.is_video,
    m.event_date,
    m.location,
    m.likes,
    m.created_at,
    m.is_liked,
    m.access_code,
    m.board_id,
    m.created_by
  FROM memories m
  WHERE m.access_code IN (
    SELECT b.access_code 
    FROM boards b 
    WHERE b.owner_id = user_id OR user_id = ANY(b.member_ids)
  )
  ORDER BY m.event_date DESC;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_boards_fast(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_memories_fast(uuid) TO authenticated;

-- Update table statistics for better query planning
ANALYZE boards;
ANALYZE memories;
ANALYZE access_codes;
ANALYZE user_profiles;

-- Set some performance-related settings (if not already set)
-- These will help with query performance
ALTER TABLE boards SET (fillfactor = 90);
ALTER TABLE memories SET (fillfactor = 90);