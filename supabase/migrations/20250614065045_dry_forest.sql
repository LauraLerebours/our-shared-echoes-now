-- Drop existing functions before recreating them with new return types
DROP FUNCTION IF EXISTS get_user_boards_fast(uuid);
DROP FUNCTION IF EXISTS get_memories_by_access_code(text);

-- Create a function to safely fetch memories by access code
CREATE OR REPLACE FUNCTION get_memories_by_access_code(access_code_param text)
RETURNS SETOF memories
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth, extensions
AS $$
  SELECT *
  FROM memories
  WHERE access_code = access_code_param
  ORDER BY event_date DESC, created_at DESC;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_memories_by_access_code(text) TO authenticated;

-- Create a function to get user boards without RLS
CREATE OR REPLACE FUNCTION get_user_boards_fast(user_id uuid)
RETURNS SETOF boards
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth, extensions
AS $$
  SELECT *
  FROM boards
  WHERE owner_id = user_id OR user_id = ANY(COALESCE(member_ids, ARRAY[]::uuid[]))
  ORDER BY created_at DESC;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_boards_fast(uuid) TO authenticated;

-- Create additional indexes to support the functions
CREATE INDEX IF NOT EXISTS idx_memories_access_code_date_performance 
ON memories USING btree (access_code, event_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_boards_owner_member_lookup 
ON boards USING btree (owner_id) INCLUDE (member_ids);

-- Update table statistics for better query planning
ANALYZE memories;
ANALYZE boards;