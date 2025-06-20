/*
  # Update memories_with_likes view security policy

  1. Changes
    - Change the get_memories_by_access_code_safe and get_memories_by_access_codes_safe functions
      to use SECURITY INVOKER instead of SECURITY DEFINER
    - This ensures the functions run with the permissions of the calling user
    - Maintains proper access control while avoiding potential security issues

  2. Security
    - Functions will now respect the RLS policies of the calling user
    - Reduces the risk of privilege escalation
    - Maintains the same functionality but with improved security model
*/

-- Drop existing functions
DROP FUNCTION IF EXISTS get_memories_by_access_code_safe(text);
DROP FUNCTION IF EXISTS get_memories_by_access_codes_safe(text[]);

-- Recreate the function with SECURITY INVOKER
CREATE OR REPLACE FUNCTION get_memories_by_access_code_safe(access_code_param text)
RETURNS SETOF memories_with_likes
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, auth, extensions
AS $$
  SELECT m.*
  FROM memories_with_likes m
  WHERE m.access_code = access_code_param
  AND (m.moderation_status = 'approved' OR m.moderation_status IS NULL)
  ORDER BY m.event_date DESC, m.created_at DESC;
$$;

-- Recreate the function with SECURITY INVOKER
CREATE OR REPLACE FUNCTION get_memories_by_access_codes_safe(access_codes text[])
RETURNS SETOF memories_with_likes
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, auth, extensions
AS $$
  SELECT m.*
  FROM memories_with_likes m
  WHERE m.access_code = ANY(access_codes)
  AND (m.moderation_status = 'approved' OR m.moderation_status IS NULL)
  ORDER BY m.event_date DESC, m.created_at DESC;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_memories_by_access_code_safe(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_memories_by_access_codes_safe(text[]) TO authenticated;

-- Update table statistics for better query planning
ANALYZE memories;