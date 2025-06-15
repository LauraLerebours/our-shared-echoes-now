/*
  # Create toggle_memory_like RPC function

  1. New Functions
    - `toggle_memory_like` - RPC function to toggle like status and count for memories
      - Parameters: `memory_access_code` (text), `memory_id` (uuid)
      - Returns: JSON object with `likes` (integer) and `isLiked` (boolean)
      - Handles atomic increment/decrement of likes count
      - Toggles the is_liked boolean field

  2. Security
    - Function uses the existing RLS policies on the memories table
    - No additional permissions needed as it operates on existing data
*/

CREATE OR REPLACE FUNCTION public.toggle_memory_like(
  memory_access_code text,
  memory_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_memory RECORD;
  new_likes integer;
  new_is_liked boolean;
BEGIN
  -- Get the current memory state
  SELECT * INTO current_memory
  FROM memories
  WHERE id = memory_id AND access_code = memory_access_code;
  
  -- Check if memory exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Memory not found with id % and access code %', memory_id, memory_access_code;
  END IF;
  
  -- Calculate new values
  IF current_memory.is_liked THEN
    new_likes := GREATEST(0, current_memory.likes - 1);
    new_is_liked := false;
  ELSE
    new_likes := current_memory.likes + 1;
    new_is_liked := true;
  END IF;
  
  -- Update the memory
  UPDATE memories
  SET 
    likes = new_likes,
    is_liked = new_is_liked
  WHERE id = memory_id AND access_code = memory_access_code;
  
  -- Return the new state
  RETURN json_build_object(
    'likes', new_likes,
    'isLiked', new_is_liked
  );
END;
$$;