-- Function to toggle a memory's like status
CREATE OR REPLACE FUNCTION toggle_memory_like(
  memory_id uuid,
  memory_access_code text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  current_memory memories%ROWTYPE;
  new_likes integer;
  new_is_liked boolean;
  result json;
BEGIN
  -- Get the current memory
  SELECT * INTO current_memory
  FROM memories
  WHERE id = memory_id AND access_code = memory_access_code;
  
  -- Check if memory exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Memory not found'
    );
  END IF;
  
  -- Toggle the like status
  new_is_liked := NOT COALESCE(current_memory.is_liked, false);
  
  -- Update the likes count
  IF new_is_liked THEN
    new_likes := COALESCE(current_memory.likes, 0) + 1;
  ELSE
    new_likes := GREATEST(0, COALESCE(current_memory.likes, 0) - 1);
  END IF;
  
  -- Update the memory
  UPDATE memories
  SET 
    likes = new_likes,
    is_liked = new_is_liked
  WHERE id = memory_id AND access_code = memory_access_code;
  
  -- Return the result
  RETURN json_build_object(
    'success', true,
    'likes', new_likes,
    'isLiked', new_is_liked
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION toggle_memory_like(uuid, text) TO authenticated;