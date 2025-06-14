/*
  # Fix remove_board_member function to handle foreign key constraints

  1. Function Updates
    - Update `remove_board_member` function to properly handle deletion order
    - Delete memories first, then board, then access_code to avoid foreign key violations
    - Handle ownership transfer when owner leaves but other members remain
    - Properly check if user is the last member before deleting the board

  2. Logic Flow
    - Fetch board details (owner_id, member_ids, access_code)
    - Check if user is owner and last member
    - If last member: delete memories → delete board → delete access_code
    - If not last member: remove from member_ids or transfer ownership
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS remove_board_member(uuid, uuid);

-- Create the updated remove_board_member function
CREATE OR REPLACE FUNCTION remove_board_member(board_id uuid, user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    board_record RECORD;
    new_member_ids uuid[];
    is_last_member boolean := false;
    new_owner_id uuid;
BEGIN
    -- Fetch board details
    SELECT owner_id, member_ids, access_code, name
    INTO board_record
    FROM boards
    WHERE id = board_id;

    -- Check if board exists
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Board not found');
    END IF;

    -- Check if user has permission (must be owner or member)
    IF board_record.owner_id != user_id AND NOT (user_id = ANY(COALESCE(board_record.member_ids, ARRAY[]::uuid[]))) THEN
        RETURN json_build_object('success', false, 'error', 'User not authorized to leave this board');
    END IF;

    -- Remove user from member_ids array
    new_member_ids := array_remove(COALESCE(board_record.member_ids, ARRAY[]::uuid[]), user_id);

    -- Check if this is the last member (owner leaving and no other members)
    IF board_record.owner_id = user_id AND array_length(new_member_ids, 1) IS NULL THEN
        is_last_member := true;
    END IF;

    -- If user is the last member, delete the entire board and its data
    IF is_last_member THEN
        -- First, delete all memories associated with this board's access_code
        DELETE FROM memories WHERE access_code = board_record.access_code;
        
        -- Then delete the board (this will cascade to related data)
        DELETE FROM boards WHERE id = board_id;
        
        -- Finally, delete the access_code (now safe since no board references it)
        DELETE FROM access_codes WHERE code = board_record.access_code;
        
        RETURN json_build_object(
            'success', true, 
            'message', 'Board deleted successfully as last member left',
            'board_deleted', true
        );
    END IF;

    -- If owner is leaving but other members remain, transfer ownership
    IF board_record.owner_id = user_id AND array_length(new_member_ids, 1) > 0 THEN
        -- Transfer ownership to the first remaining member
        new_owner_id := new_member_ids[1];
        
        -- Update the board with new owner and updated member list
        UPDATE boards 
        SET owner_id = new_owner_id,
            member_ids = new_member_ids,
            updated_at = now()
        WHERE id = board_id;
        
        RETURN json_build_object(
            'success', true, 
            'message', 'Left board and transferred ownership',
            'new_owner_id', new_owner_id
        );
    END IF;

    -- If user is just a member (not owner), simply remove from member_ids
    UPDATE boards 
    SET member_ids = new_member_ids,
        updated_at = now()
    WHERE id = board_id;

    RETURN json_build_object('success', true, 'message', 'Successfully left the board');

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Failed to remove user from board: ' || SQLERRM
        );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION remove_board_member(uuid, uuid) TO authenticated;