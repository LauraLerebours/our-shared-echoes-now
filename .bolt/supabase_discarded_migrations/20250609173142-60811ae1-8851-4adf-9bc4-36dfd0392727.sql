
-- Integrate board_members and boards into a single table structure
-- This eliminates the circular dependency causing infinite recursion

-- First, create a new temporary table with the integrated structure
CREATE TABLE boards_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  access_code text,
  share_code text NOT NULL,
  owner_id uuid NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now(),
  -- Store all members as an array of user IDs for simplicity
  member_ids uuid[] DEFAULT ARRAY[]::uuid[]
);

-- Migrate data from existing boards and board_members tables
INSERT INTO boards_new (id, name, access_code, share_code, owner_id, created_at, updated_at, member_ids)
SELECT 
  b.id,
  b.name,
  b.access_code,
  b.share_code,
  b.owner_id,
  b.created_at,
  b.updated_at,
  COALESCE(
    ARRAY(
      SELECT bm.user_id 
      FROM board_members bm 
      WHERE bm.board_id = b.id 
        AND bm.role = 'member'
    ), 
    ARRAY[]::uuid[]
  ) as member_ids
FROM boards b
WHERE b.owner_id IS NOT NULL;

-- Drop old tables and their policies
DROP TABLE IF EXISTS board_members CASCADE;
DROP TABLE IF EXISTS boards CASCADE;

-- Rename new table to boards
ALTER TABLE boards_new RENAME TO boards;

-- Create indexes for performance
CREATE INDEX boards_owner_id_idx ON boards(owner_id);
CREATE INDEX boards_share_code_idx ON boards(share_code);
CREATE INDEX boards_access_code_idx ON boards(access_code);

-- Enable RLS
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies
-- Policy 1: Board owners can do everything with their boards
CREATE POLICY "boards_owner_full_access"
  ON boards
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Policy 2: Board members can read boards they're part of
CREATE POLICY "boards_member_read_access"
  ON boards
  FOR SELECT
  TO authenticated
  USING (auth.uid() = ANY(member_ids));

-- Policy 3: Users can create new boards (they become the owner)
CREATE POLICY "boards_create_access"
  ON boards
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Create helper functions for managing board members
CREATE OR REPLACE FUNCTION add_board_member(board_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_owner uuid;
BEGIN
  -- Check if the current user is the board owner
  SELECT owner_id INTO current_owner FROM boards WHERE id = board_id;
  
  IF current_owner != auth.uid() THEN
    RETURN false;
  END IF;
  
  -- Add user to member_ids array if not already present
  UPDATE boards 
  SET member_ids = array_append(member_ids, user_id),
      updated_at = now()
  WHERE id = board_id 
    AND NOT (user_id = ANY(member_ids));
  
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION remove_board_member(board_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_owner uuid;
BEGIN
  -- Check if the current user is the board owner or removing themselves
  SELECT owner_id INTO current_owner FROM boards WHERE id = board_id;
  
  IF current_owner != auth.uid() AND user_id != auth.uid() THEN
    RETURN false;
  END IF;
  
  -- Remove user from member_ids array
  UPDATE boards 
  SET member_ids = array_remove(member_ids, user_id),
      updated_at = now()
  WHERE id = board_id;
  
  RETURN true;
END;
$$;

-- Update the existing add_user_to_board_by_share_code function
CREATE OR REPLACE FUNCTION add_user_to_board_by_share_code(share_code_param text, user_id_param uuid DEFAULT auth.uid())
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_board_id uuid;
  target_board_name text;
  membership_exists boolean;
  is_owner boolean;
  result json;
BEGIN
  -- Find the board by share code
  SELECT id, name, owner_id INTO target_board_id, target_board_name
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
  
  -- Check if user is the owner
  SELECT owner_id = user_id_param INTO is_owner
  FROM boards 
  WHERE id = target_board_id;
  
  IF is_owner THEN
    result := json_build_object(
      'success', true,
      'message', 'You are the owner of this board',
      'board_id', target_board_id,
      'board_name', target_board_name
    );
    RETURN result;
  END IF;
  
  -- Check if user is already a member
  SELECT user_id_param = ANY(member_ids) INTO membership_exists
  FROM boards 
  WHERE id = target_board_id;
  
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
  
  -- Add user as member
  UPDATE boards 
  SET member_ids = array_append(member_ids, user_id_param),
      updated_at = now()
  WHERE id = target_board_id;
  
  result := json_build_object(
    'success', true,
    'message', 'Successfully joined the board!',
    'board_id', target_board_id,
    'board_name', target_board_name
  );
  
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

-- Update the create_board_with_owner function to work with new structure
CREATE OR REPLACE FUNCTION create_board_with_owner(board_name text, owner_user_id uuid, access_code_param text, share_code_param text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_board_id uuid;
BEGIN
  -- Generate a new UUID for the board
  new_board_id := gen_random_uuid();
  
  -- Insert the board with integrated structure
  INSERT INTO boards (id, name, owner_id, access_code, share_code, created_at, updated_at, member_ids)
  VALUES (new_board_id, board_name, owner_user_id, access_code_param, share_code_param, NOW(), NOW(), ARRAY[]::uuid[]);
  
  RETURN new_board_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and re-raise
    RAISE EXCEPTION 'Failed to create board: %', SQLERRM;
END;
$$;
