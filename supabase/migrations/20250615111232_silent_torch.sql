/*
  # Allow Memory Owners to Edit Their Memories

  1. Changes
    - Create a new RLS policy that allows memory creators to edit their own memories
    - Add a function to update memory details (caption, location, date)
    - Ensure proper access control so only creators can edit their memories

  2. Security
    - Maintain existing RLS policies for read access
    - Only allow editing of specific fields (not likes or other sensitive data)
    - Validate user ownership before allowing edits
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
  WHERE id = memory_id AND created_by = current_user_id;
  
  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Memory updated successfully'
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_memory_details(uuid, text, text, timestamp without time zone) TO authenticated;

-- Create an index to improve performance of the created_by lookup
CREATE INDEX IF NOT EXISTS idx_memories_created_by_lookup ON memories(created_by);