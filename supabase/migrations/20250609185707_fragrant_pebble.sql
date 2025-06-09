/*
  # Delete boards with 0 members

  1. Function to clean up empty boards
    - Deletes boards where member_ids array is empty or null
    - Also deletes associated memories and access codes
    - Runs automatically when members are removed

  2. Trigger to run cleanup after member removal
    - Automatically checks for empty boards after any update to member_ids
    - Ensures no orphaned boards remain in the system

  3. Manual cleanup function
    - Can be called to clean up any existing empty boards
    - Safe to run multiple times
*/

-- Function to delete boards with no members
CREATE OR REPLACE FUNCTION delete_empty_boards()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  empty_board RECORD;
BEGIN
  -- Find and delete boards with no members
  FOR empty_board IN 
    SELECT id, access_code 
    FROM boards 
    WHERE member_ids IS NULL 
       OR array_length(member_ids, 1) IS NULL 
       OR array_length(member_ids, 1) = 0
  LOOP
    -- Delete memories associated with this board
    DELETE FROM memories WHERE access_code = empty_board.access_code;
    
    -- Delete access code
    DELETE FROM access_codes WHERE code = empty_board.access_code;
    
    -- Delete the board
    DELETE FROM boards WHERE id = empty_board.id;
    
    RAISE NOTICE 'Deleted empty board: %', empty_board.id;
  END LOOP;
END;
$$;

-- Enhanced remove_board_member function that automatically cleans up empty boards
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

-- Function to automatically clean up empty boards after any board update
CREATE OR REPLACE FUNCTION cleanup_empty_boards_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the updated board now has no members
  IF NEW.member_ids IS NULL 
     OR array_length(NEW.member_ids, 1) IS NULL 
     OR array_length(NEW.member_ids, 1) = 0 THEN
    
    -- Delete memories associated with this board
    DELETE FROM memories WHERE access_code = NEW.access_code;
    
    -- Delete access code
    DELETE FROM access_codes WHERE code = NEW.access_code;
    
    -- Delete the board itself
    DELETE FROM boards WHERE id = NEW.id;
    
    -- Return NULL to prevent the update since we're deleting the row
    RETURN NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically clean up empty boards
DROP TRIGGER IF EXISTS cleanup_empty_boards_trigger ON boards;
CREATE TRIGGER cleanup_empty_boards_trigger
  AFTER UPDATE OF member_ids ON boards
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_empty_boards_trigger();

-- Run cleanup for any existing empty boards
SELECT delete_empty_boards();