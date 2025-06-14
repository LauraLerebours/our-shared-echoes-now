-- First drop the existing function that's causing the error
DROP FUNCTION IF EXISTS get_user_boards_fast(uuid);

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
CREATE INDEX IF NOT EXISTS idx_boards_owner_member_lookup 
ON boards USING btree (owner_id) INCLUDE (member_ids);

-- Update table statistics for better query planning
ANALYZE boards;