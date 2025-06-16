/*
  # Allow Memory Editing and Content Moderation

  1. Changes
    - Add policy to allow users to update their own memories
    - Create function to update memory details
    - Add index for better performance when querying by creator

  2. Security
    - Ensure only memory creators can edit their memories
    - Maintain existing security for other operations
*/

-- Drop any existing conflicting policies
DROP POLICY IF EXISTS "memories_update_own" ON memories;

-- Create a policy that allows users to update their own memories
CREATE POLICY "memories_update_own" ON memories
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Create a function to update memory details with proper validation
CREATE OR REPLACE FUNCTION update_memory_details(
  memory_id uuid,
  memory_caption text DEFAULT NULL,
  memory_location text DEFAULT NULL,
  memory_date timestamp without time zone DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  current_memory RECORD;
  current_user_id uuid;
  updated_memory RECORD;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'User not authenticated'
    );
  END IF;

  -- Get the current memory
  SELECT * INTO current_memory
  FROM memories
  WHERE id = memory_id;
  
  -- Check if memory exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Memory not found'
    );
  END IF;
  
  -- Check if user is the creator of the memory
  IF current_memory.created_by != current_user_id THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Only the creator can edit this memory'
    );
  END IF;
  
  -- Update the memory with new values, keeping existing values if not provided
  UPDATE memories
  SET 
    caption = COALESCE(memory_caption, caption),
    location = COALESCE(memory_location, location),
    event_date = COALESCE(memory_date, event_date)
  WHERE id = memory_id AND created_by = current_user_id
  RETURNING * INTO updated_memory;
  
  -- Return success with updated memory data
  RETURN json_build_object(
    'success', true,
    'message', 'Memory updated successfully',
    'memory', row_to_json(updated_memory)
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_memory_details(uuid, text, text, timestamp without time zone) TO authenticated;

-- Create an index to improve performance of the created_by lookup
CREATE INDEX IF NOT EXISTS idx_memories_created_by_lookup ON memories(created_by);

-- Function to toggle a memory's like status
CREATE OR REPLACE FUNCTION toggle_memory_like(
  memory_access_code text,
  memory_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION toggle_memory_like(text, uuid) TO authenticated;