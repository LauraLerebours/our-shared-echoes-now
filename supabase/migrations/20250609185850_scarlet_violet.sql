/*
  # Add board renaming functionality

  1. Functions
    - Create function to rename boards with proper access control
    - Only board owners can rename their boards
    - Validates input and updates board name

  2. Security
    - Function uses SECURITY DEFINER for proper access control
    - Validates user ownership before allowing rename
    - Sanitizes input to prevent issues
*/

-- Function to rename a board (only owners can rename)
CREATE OR REPLACE FUNCTION rename_board(
  board_id uuid,
  new_name text,
  user_id uuid DEFAULT auth.uid()
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  board_record RECORD;
  result json;
BEGIN
  -- Validate input
  IF new_name IS NULL OR trim(new_name) = '' THEN
    result := json_build_object(
      'success', false,
      'message', 'Board name cannot be empty'
    );
    RETURN result;
  END IF;

  -- Get the board and check ownership
  SELECT * INTO board_record
  FROM boards
  WHERE id = board_id;
  
  -- Check if board exists
  IF NOT FOUND THEN
    result := json_build_object(
      'success', false,
      'message', 'Board not found'
    );
    RETURN result;
  END IF;
  
  -- Check if user is the owner
  IF board_record.owner_id != user_id THEN
    result := json_build_object(
      'success', false,
      'message', 'Only board owners can rename boards'
    );
    RETURN result;
  END IF;
  
  -- Update the board name
  UPDATE boards
  SET 
    name = trim(new_name),
    updated_at = NOW()
  WHERE id = board_id;
  
  -- Also update the access code name for consistency
  UPDATE access_codes
  SET name = trim(new_name)
  WHERE code = board_record.access_code;
  
  result := json_build_object(
    'success', true,
    'message', 'Board renamed successfully',
    'new_name', trim(new_name)
  );
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    result := json_build_object(
      'success', false,
      'message', 'Failed to rename board: ' || SQLERRM
    );
    RETURN result;
END;
$$;