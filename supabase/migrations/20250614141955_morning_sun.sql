/*
  # Fix Board Join Error Message

  1. Problem
    - When users join a board, they sometimes see "failed to join board" error
    - The remove_board_member function returns a boolean but should return JSON
    - The add_user_to_board_by_share_code function needs better error handling

  2. Solution
    - Update the add_user_to_board_by_share_code function to provide better error messages
    - Improve error handling for invalid share codes
    - Add more detailed success messages

  3. Changes
    - Modify add_user_to_board_by_share_code function to return more detailed responses
    - Add better validation for share codes
    - Improve error handling for edge cases
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS add_user_to_board_by_share_code(text, uuid);

-- Create an improved version with better error handling
CREATE OR REPLACE FUNCTION add_user_to_board_by_share_code(
  share_code_param text,
  user_id_param uuid DEFAULT auth.uid()
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  board_record boards%ROWTYPE;
  board_name text;
  result json;
BEGIN
  -- Validate inputs
  IF share_code_param IS NULL OR length(trim(share_code_param)) = 0 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Share code cannot be empty'
    );
  END IF;
  
  -- Standardize share code format (uppercase, trimmed)
  share_code_param := upper(trim(share_code_param));
  
  -- Validate share code format
  IF length(share_code_param) != 6 OR share_code_param !~ '^[A-Z0-9]{6}$' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid share code format. Share codes must be 6 characters (letters and numbers only).'
    );
  END IF;
  
  -- Validate user ID
  IF user_id_param IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'User not authenticated'
    );
  END IF;

  -- Find the board by share code
  SELECT * INTO board_record
  FROM boards
  WHERE share_code = share_code_param;

  -- Return error if board doesn't exist
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'No board found with this share code. Please check and try again.'
    );
  END IF;

  -- Get board name for better user feedback
  board_name := COALESCE(board_record.name, 'Shared Board');

  -- Check if user is already a member
  IF user_id_param = ANY(COALESCE(board_record.member_ids, ARRAY[]::uuid[])) THEN
    RETURN json_build_object(
      'success', true,
      'message', 'You are already a member of "' || board_name || '"',
      'board_id', board_record.id,
      'board_name', board_name
    );
  END IF;

  -- Add user to the board's member_ids array
  UPDATE boards
  SET 
    member_ids = array_append(COALESCE(member_ids, ARRAY[]::uuid[]), user_id_param),
    updated_at = now()
  WHERE id = board_record.id;

  -- Return success with board details
  RETURN json_build_object(
    'success', true,
    'message', 'Successfully joined "' || board_name || '"!',
    'board_id', board_record.id,
    'board_name', board_name
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'An error occurred while joining the board: ' || SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION add_user_to_board_by_share_code(text, uuid) TO authenticated;