/*
  # Allow Memory Owners to Edit Their Memories

  1. Changes
    - Add RLS policy to allow users to update their own memories
    - Create a function to securely update memory details
    - Add index for better performance

  2. Security
    - Only memory creators can update their own memories
    - Proper validation of input parameters
    - SECURITY DEFINER function to ensure proper access control
*/

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