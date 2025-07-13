/*
  # Add toggle_memory_like_v3 function

  1. New Functions
    - `toggle_memory_like_v3` - Improved version of the like toggle function that:
      - Properly handles user authentication
      - Maintains accurate like counts
      - Returns correct like status
      - Uses a transaction for data consistency
      - Includes better error handling
*/

CREATE OR REPLACE FUNCTION toggle_memory_like_v3(memory_id_param UUID)
RETURNS JSON AS $$
DECLARE
  current_user_id UUID;
  like_exists BOOLEAN;
  current_likes INT;
  is_liked BOOLEAN;
  memory_exists BOOLEAN;
  result JSON;
BEGIN
  -- Get the current user ID
  current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'User not authenticated',
      'likes', 0,
      'isLiked', false
    );
  END IF;
  
  -- Check if memory exists
  SELECT EXISTS(SELECT 1 FROM memories WHERE id = memory_id_param) INTO memory_exists;
  IF NOT memory_exists THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Memory not found',
      'likes', 0,
      'isLiked', false
    );
  END IF;
  
  -- Check if the user has already liked this memory
  SELECT EXISTS(
    SELECT 1 FROM memory_likes 
    WHERE memory_id = memory_id_param AND user_id = current_user_id
  ) INTO like_exists;
  
  -- Begin transaction for data consistency
  BEGIN
    -- If like exists, delete it; otherwise, insert it
    IF like_exists THEN
      DELETE FROM memory_likes 
      WHERE memory_id = memory_id_param AND user_id = current_user_id;
      is_liked := false;
    ELSE
      INSERT INTO memory_likes (memory_id, user_id)
      VALUES (memory_id_param, current_user_id);
      is_liked := true;
    END IF;
    
    -- Get the current like count
    SELECT COUNT(*) INTO current_likes
    FROM memory_likes
    WHERE memory_id = memory_id_param;
    
    -- Update the likes count in the memories table
    UPDATE memories
    SET likes = current_likes
    WHERE id = memory_id_param;
    
    -- Build the result JSON
    result := json_build_object(
      'success', true,
      'likes', current_likes,
      'isLiked', is_liked
    );
    
    RETURN result;
  EXCEPTION
    WHEN OTHERS THEN
      -- Handle any errors
      RETURN json_build_object(
        'success', false,
        'message', SQLERRM,
        'likes', 0,
        'isLiked', false
      );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION toggle_memory_like_v3(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION toggle_memory_like_v3(UUID) IS 'Toggles a like on a memory for the current user and returns updated like count and status';