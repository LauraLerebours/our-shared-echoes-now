/*
  # Fix board creation to automatically add creator as member

  1. Problem
    - When users create boards, they are not automatically added to the member_ids array
    - This causes issues with board access and membership tracking

  2. Solution
    - Update the create_board_with_owner function to add the creator to member_ids
    - Ensure the creator is both owner_id and in the member_ids array
    - Fix any existing boards that might have this issue

  3. Changes
    - Update create_board_with_owner function
    - Add creator to member_ids array during board creation
    - Fix existing boards where owner is not in member_ids
*/

-- Update the create_board_with_owner function to properly add creator as member
CREATE OR REPLACE FUNCTION create_board_with_owner(
  board_name text,
  owner_user_id uuid,
  access_code_param text,
  share_code_param text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_board_id uuid;
BEGIN
  -- Generate a new UUID for the board
  new_board_id := gen_random_uuid();
  
  -- Insert the board with the creator as both owner and first member
  INSERT INTO boards (
    id, 
    name, 
    owner_id, 
    access_code, 
    share_code, 
    member_ids,
    created_at, 
    updated_at
  )
  VALUES (
    new_board_id, 
    board_name, 
    owner_user_id, 
    access_code_param, 
    share_code_param, 
    ARRAY[owner_user_id], -- Add creator to member_ids array
    NOW(), 
    NOW()
  );
  
  RETURN new_board_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and re-raise
    RAISE EXCEPTION 'Failed to create board: %', SQLERRM;
END;
$$;

-- Fix existing boards where the owner is not in the member_ids array
UPDATE boards 
SET member_ids = CASE 
  WHEN member_ids IS NULL THEN ARRAY[owner_id]
  WHEN NOT (owner_id = ANY(member_ids)) THEN member_ids || owner_id
  ELSE member_ids
END,
updated_at = NOW()
WHERE owner_id IS NOT NULL 
  AND (
    member_ids IS NULL 
    OR NOT (owner_id = ANY(member_ids))
  );

-- Create a trigger function to ensure new boards always have the owner as a member
CREATE OR REPLACE FUNCTION ensure_owner_is_member()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Ensure owner_id is in member_ids array
  IF NEW.owner_id IS NOT NULL THEN
    IF NEW.member_ids IS NULL THEN
      NEW.member_ids := ARRAY[NEW.owner_id];
    ELSIF NOT (NEW.owner_id = ANY(NEW.member_ids)) THEN
      NEW.member_ids := NEW.member_ids || NEW.owner_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to ensure owner is always a member
DROP TRIGGER IF EXISTS ensure_owner_is_member_trigger ON boards;
CREATE TRIGGER ensure_owner_is_member_trigger
  BEFORE INSERT OR UPDATE ON boards
  FOR EACH ROW
  EXECUTE FUNCTION ensure_owner_is_member();