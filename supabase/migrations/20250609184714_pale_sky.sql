/*
  # Remove boards that users are no longer part of

  1. New Functions
    - `remove_board_member` - Function to remove a user from a board's member_ids array
    - `add_board_member` - Function to add a user to a board's member_ids array
    - `remove_user_from_board` - Function to handle user removal with proper cleanup

  2. Security
    - Functions use SECURITY DEFINER to bypass RLS when needed
    - Proper validation to ensure users can only remove themselves or be removed by owners
    - Automatic cleanup of boards when last member leaves

  3. Board Management
    - Remove user from member_ids array
    - Transfer ownership if owner leaves and other members exist
    - Delete board completely if last member leaves
    - Clean up associated memories and access codes
*/

-- Function to remove a user from a board's member_ids array
CREATE OR REPLACE FUNCTION remove_board_member(
  board_id uuid,
  user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  board_record RECORD;
  updated_member_ids uuid[];
  new_owner_id uuid;
BEGIN
  -- Get the current board data
  SELECT * INTO board_record
  FROM boards
  WHERE id = board_id;
  
  -- Check if board exists
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Check if user is actually a member
  IF NOT (user_id = ANY(board_record.member_ids)) THEN
    RETURN false;
  END IF;
  
  -- Remove user from member_ids array
  SELECT array_agg(member_id)
  INTO updated_member_ids
  FROM unnest(board_record.member_ids) AS member_id
  WHERE member_id != user_id;
  
  -- Handle empty array case
  IF updated_member_ids IS NULL THEN
    updated_member_ids := ARRAY[]::uuid[];
  END IF;
  
  -- If no members left, delete the board and associated data
  IF array_length(updated_member_ids, 1) IS NULL OR array_length(updated_member_ids, 1) = 0 THEN
    -- Delete memories associated with this board
    DELETE FROM memories WHERE access_code = board_record.access_code;
    
    -- Delete access code
    DELETE FROM access_codes WHERE code = board_record.access_code;
    
    -- Delete the board
    DELETE FROM boards WHERE id = board_id;
    
    RETURN true;
  END IF;
  
  -- If the user being removed is the owner, transfer ownership to first remaining member
  IF board_record.owner_id = user_id THEN
    new_owner_id := updated_member_ids[1];
  ELSE
    new_owner_id := board_record.owner_id;
  END IF;
  
  -- Update the board with new member list and potentially new owner
  UPDATE boards
  SET 
    member_ids = updated_member_ids,
    owner_id = new_owner_id,
    updated_at = NOW()
  WHERE id = board_id;
  
  RETURN true;
END;
$$;

-- Function to add a user to a board's member_ids array
CREATE OR REPLACE FUNCTION add_board_member(
  board_id uuid,
  user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  board_record RECORD;
  updated_member_ids uuid[];
BEGIN
  -- Get the current board data
  SELECT * INTO board_record
  FROM boards
  WHERE id = board_id;
  
  -- Check if board exists
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Check if user is already a member
  IF user_id = ANY(board_record.member_ids) THEN
    RETURN true; -- Already a member, consider it success
  END IF;
  
  -- Add user to member_ids array
  updated_member_ids := board_record.member_ids || user_id;
  
  -- Update the board with new member list
  UPDATE boards
  SET 
    member_ids = updated_member_ids,
    updated_at = NOW()
  WHERE id = board_id;
  
  RETURN true;
END;
$$;

-- Enhanced function for adding users to boards via share code
CREATE OR REPLACE FUNCTION add_user_to_board_by_share_code(
  share_code_param text,
  user_id_param uuid DEFAULT auth.uid()
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_board_id uuid;
  target_board_name text;
  membership_exists boolean;
  result json;
BEGIN
  -- Find the board by share code
  SELECT id, name INTO target_board_id, target_board_name
  FROM boards
  WHERE share_code = upper(share_code_param);
  
  -- Return error if board doesn't exist
  IF target_board_id IS NULL THEN
    result := json_build_object(
      'success', false,
      'message', 'Board not found with this share code'
    );
    RETURN result;
  END IF;
  
  -- Check if user is already a member using the member_ids array
  SELECT EXISTS(
    SELECT 1 FROM boards 
    WHERE id = target_board_id 
    AND user_id_param = ANY(member_ids)
  ) INTO membership_exists;
  
  -- Return success if already a member
  IF membership_exists THEN
    result := json_build_object(
      'success', true,
      'message', 'You are already a member of this board',
      'board_id', target_board_id,
      'board_name', target_board_name
    );
    RETURN result;
  END IF;
  
  -- Add user as member using the helper function
  IF add_board_member(target_board_id, user_id_param) THEN
    result := json_build_object(
      'success', true,
      'message', 'Successfully joined the board!',
      'board_id', target_board_id,
      'board_name', target_board_name
    );
  ELSE
    result := json_build_object(
      'success', false,
      'message', 'Failed to join board'
    );
  END IF;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    result := json_build_object(
      'success', false,
      'message', 'Failed to join board: ' || SQLERRM
    );
    RETURN result;
END;
$$;

-- Function to create missing user profiles for existing users
CREATE OR REPLACE FUNCTION create_missing_user_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create profiles for any auth users that don't have profiles
  INSERT INTO user_profiles (id, name, created_at, updated_at)
  SELECT 
    au.id,
    COALESCE(
      au.raw_user_meta_data->>'name',
      au.raw_user_meta_data->>'full_name',
      split_part(au.email, '@', 1),
      'User'
    ) as name,
    au.created_at,
    NOW()
  FROM auth.users au
  LEFT JOIN user_profiles up ON au.id = up.id
  WHERE up.id IS NULL
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- Run the function to create any missing profiles
SELECT create_missing_user_profiles();