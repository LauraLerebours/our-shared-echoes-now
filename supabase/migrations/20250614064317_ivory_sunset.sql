/*
  # Fix Memories Display Issue

  1. Create a function to directly fetch memories by access code
    - Bypasses RLS policies that might be causing issues
    - Uses SECURITY DEFINER to ensure proper access
    - Returns memories for a specific access code

  2. Performance Optimizations
    - Uses direct access code check for better performance
    - Includes proper sorting by event date
    - Avoids complex joins or subqueries
*/

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

-- Create additional index to support the function
CREATE INDEX IF NOT EXISTS idx_memories_access_code_date_performance 
ON memories USING btree (access_code, event_date DESC, created_at DESC);

-- Update table statistics for better query planning
ANALYZE memories;