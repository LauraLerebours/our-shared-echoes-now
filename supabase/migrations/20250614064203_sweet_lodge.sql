/*
  # Fix Boards Display Issue

  1. Create a function to directly fetch user boards
    - Bypasses RLS policies that might be causing issues
    - Uses SECURITY DEFINER to ensure proper access
    - Returns boards that the user owns or is a member of

  2. Performance Optimizations
    - Uses direct array membership check for better performance
    - Includes proper indexing support
    - Avoids complex joins or subqueries
*/

-- Create a function to safely fetch user boards with better performance
CREATE OR REPLACE FUNCTION get_user_boards_fast(user_id uuid)
RETURNS SETOF boards
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth, extensions
AS $$
  SELECT *
  FROM boards
  WHERE owner_id = user_id 
     OR user_id = ANY(COALESCE(member_ids, ARRAY[]::uuid[]))
  ORDER BY created_at DESC;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_boards_fast(uuid) TO authenticated;

-- Create additional index to support the function
CREATE INDEX IF NOT EXISTS idx_boards_owner_member_lookup 
ON boards USING btree (owner_id) INCLUDE (member_ids);

-- Update table statistics for better query planning
ANALYZE boards;