/*
  # Ensure Smooth Backend Operation

  1. Changes
    - Fix any potential issues with the memory retrieval functions
    - Add proper error handling to database functions
    - Ensure RLS policies work correctly with the SECURITY INVOKER setting
    - Add additional helper functions for common operations

  2. Performance
    - Add missing indexes for better query performance
    - Optimize memory retrieval functions
    - Ensure proper query planning
*/

-- Create a function to get memory like status with better error handling
CREATE OR REPLACE FUNCTION get_memory_like_status(
  memory_id_param uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth, extensions
AS $$
DECLARE
  current_memory RECORD;
  result json;
BEGIN
  -- Get the current memory
  SELECT * INTO current_memory
  FROM memories
  WHERE id = memory_id_param;
  
  -- Check if memory exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Memory not found',
      'isLiked', false,
      'likes', 0
    );
  END IF;
  
  -- Return the current like status
  RETURN json_build_object(
    'success', true,
    'isLiked', COALESCE(current_memory.is_liked, false),
    'likes', COALESCE(current_memory.likes, 0)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error getting memory like status: ' || SQLERRM,
      'isLiked', false,
      'likes', 0
    );
END;
$$;

-- Create a function to safely get a single memory by ID
CREATE OR REPLACE FUNCTION get_memory_by_id_safe(memory_id_param uuid)
RETURNS SETOF memories_with_likes
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, auth, extensions
AS $$
  SELECT m.*
  FROM memories_with_likes m
  WHERE m.id = memory_id_param
  AND (m.moderation_status = 'approved' OR m.moderation_status IS NULL)
  LIMIT 1;
$$;

-- Create a function to get board details by ID
CREATE OR REPLACE FUNCTION get_board_by_id_safe(board_id_param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth, extensions
AS $$
DECLARE
  board_record RECORD;
  result json;
BEGIN
  -- Get the board
  SELECT * INTO board_record
  FROM boards
  WHERE id = board_id_param
  AND (
    auth.uid() = owner_id OR 
    auth.uid() = ANY(COALESCE(member_ids, ARRAY[]::uuid[]))
  );
  
  -- Check if board exists and user has access
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Board not found or access denied'
    );
  END IF;
  
  -- Return the board details
  RETURN json_build_object(
    'success', true,
    'data', row_to_json(board_record)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error getting board: ' || SQLERRM
    );
END;
$$;

-- Create a function to get user profile by ID
CREATE OR REPLACE FUNCTION get_user_profile_by_id(user_id_param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth, extensions
AS $$
DECLARE
  profile_record RECORD;
  result json;
BEGIN
  -- Get the user profile
  SELECT * INTO profile_record
  FROM user_profiles
  WHERE id = user_id_param;
  
  -- Check if profile exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'User profile not found'
    );
  END IF;
  
  -- Return the profile details
  RETURN json_build_object(
    'success', true,
    'data', row_to_json(profile_record)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error getting user profile: ' || SQLERRM
    );
END;
$$;

-- Create a function to get memories for a board
CREATE OR REPLACE FUNCTION get_memories_for_board_safe(board_id_param uuid)
RETURNS SETOF memories_with_likes
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, auth, extensions
AS $$
  SELECT m.*
  FROM memories_with_likes m
  JOIN boards b ON m.access_code = b.access_code
  WHERE b.id = board_id_param
  AND (m.moderation_status = 'approved' OR m.moderation_status IS NULL)
  AND (
    auth.uid() = b.owner_id OR 
    auth.uid() = ANY(COALESCE(b.member_ids, ARRAY[]::uuid[]))
  )
  ORDER BY m.event_date DESC, m.created_at DESC;
$$;

-- Add missing indexes for better performance
CREATE INDEX IF NOT EXISTS idx_memories_access_code_created_by_performance 
ON memories USING btree (access_code, created_by, event_date DESC);

CREATE INDEX IF NOT EXISTS idx_memories_rls_lookup 
ON memories USING btree (access_code) INCLUDE (created_by, event_date);

CREATE INDEX IF NOT EXISTS idx_boards_rls_lookup 
ON boards USING btree (owner_id) INCLUDE (access_code, member_ids);

CREATE INDEX IF NOT EXISTS idx_user_profiles_performance 
ON user_profiles USING btree (id, name);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_memory_like_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_memory_by_id_safe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_board_by_id_safe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_profile_by_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_memories_for_board_safe(uuid) TO authenticated;

-- Update table statistics for better query planning
ANALYZE memories;
ANALYZE boards;
ANALYZE user_profiles;