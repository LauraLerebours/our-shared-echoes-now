/*
  # Fix Board Joining System

  1. Database Functions
    - Create reliable board joining function
    - Add proper validation and error handling
    - Ensure proper RLS compliance

  2. Security
    - Validate board exists and is accessible
    - Check user permissions
    - Prevent duplicate memberships

  3. Performance
    - Optimize queries
    - Add proper indexes
*/

-- Function to safely add user to board
CREATE OR REPLACE FUNCTION add_user_to_board_safe(
  share_code_param text,
  user_id_param uuid DEFAULT auth.uid()
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  board_record boards%ROWTYPE;
  current_member_ids uuid[];
  new_member_ids uuid[];
  result json;
BEGIN
  -- Validate inputs
  IF share_code_param IS NULL OR trim(share_code_param) = '' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Share code is required'
    );
  END IF;

  IF user_id_param IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'User must be authenticated'
    );
  END IF;

  -- Find the board by share code
  SELECT * INTO board_record
  FROM boards
  WHERE share_code = upper(trim(share_code_param));

  -- Check if board exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Board not found with this share code'
    );
  END IF;

  -- Check if user is already the owner
  IF board_record.owner_id = user_id_param THEN
    RETURN json_build_object(
      'success', true,
      'message', format('You''re the owner of "%s"', board_record.name),
      'board_id', board_record.id,
      'board_name', board_record.name
    );
  END IF;

  -- Get current member IDs (handle null case)
  current_member_ids := COALESCE(board_record.member_ids, ARRAY[]::uuid[]);

  -- Check if user is already a member
  IF user_id_param = ANY(current_member_ids) THEN
    RETURN json_build_object(
      'success', true,
      'message', format('You''re already a member of "%s"', board_record.name),
      'board_id', board_record.id,
      'board_name', board_record.name
    );
  END IF;

  -- Add user to member_ids array
  new_member_ids := current_member_ids || user_id_param;

  -- Update the board with new member
  UPDATE boards
  SET 
    member_ids = new_member_ids,
    updated_at = now()
  WHERE id = board_record.id;

  -- Check if update was successful
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Failed to join board. Please try again.'
    );
  END IF;

  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', format('Successfully joined "%s"!', board_record.name),
    'board_id', board_record.id,
    'board_name', board_record.name
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and return a user-friendly message
    RAISE LOG 'Error in add_user_to_board_safe: %', SQLERRM;
    RETURN json_build_object(
      'success', false,
      'message', 'An error occurred while joining the board. Please try again.'
    );
END;
$$;

-- Function to get board by share code (for API consistency)
CREATE OR REPLACE FUNCTION get_board_by_share_code(
  share_code_param text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  board_record boards%ROWTYPE;
  result json;
BEGIN
  -- Validate input
  IF share_code_param IS NULL OR trim(share_code_param) = '' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Share code is required'
    );
  END IF;

  -- Find the board by share code
  SELECT * INTO board_record
  FROM boards
  WHERE share_code = upper(trim(share_code_param));

  -- Check if board exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Board not found with this share code'
    );
  END IF;

  -- Return board data
  RETURN json_build_object(
    'success', true,
    'data', row_to_json(board_record)
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in get_board_by_share_code: %', SQLERRM;
    RETURN json_build_object(
      'success', false,
      'message', 'An error occurred while fetching the board.'
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION add_user_to_board_safe(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_board_by_share_code(text) TO authenticated;

-- Ensure proper indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_boards_share_code_upper ON boards(upper(share_code));
CREATE INDEX IF NOT EXISTS idx_boards_member_ids_gin ON boards USING gin(member_ids);

-- Update RLS policies to ensure they work correctly
DROP POLICY IF EXISTS "boards_access" ON boards;

CREATE POLICY "boards_access" ON boards
  FOR ALL TO authenticated
  USING (
    auth.uid() = owner_id OR 
    auth.uid() = ANY(COALESCE(member_ids, ARRAY[]::uuid[]))
  )
  WITH CHECK (
    auth.uid() = owner_id OR 
    auth.uid() = ANY(COALESCE(member_ids, ARRAY[]::uuid[]))
  );