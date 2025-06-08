/*
  # Fix infinite recursion by temporarily disabling RLS during board creation

  This migration takes a different approach to fix the infinite recursion issue:
  1. Modify the board creation trigger to use SECURITY DEFINER
  2. Simplify RLS policies to avoid circular dependencies
  3. Use a different approach for board member management
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "boards_insert_policy" ON boards;
DROP POLICY IF EXISTS "boards_owner_select_policy" ON boards;
DROP POLICY IF EXISTS "boards_member_select_policy" ON boards;
DROP POLICY IF EXISTS "boards_update_policy" ON boards;
DROP POLICY IF EXISTS "boards_delete_policy" ON boards;

-- Drop existing board_members policies
DROP POLICY IF EXISTS "board_members_select_policy_v3" ON board_members;
DROP POLICY IF EXISTS "board_members_insert_policy_v3" ON board_members;
DROP POLICY IF EXISTS "board_members_update_policy_v3" ON board_members;
DROP POLICY IF EXISTS "board_members_delete_policy_v3" ON board_members;

-- Temporarily disable RLS on boards table
ALTER TABLE boards DISABLE ROW LEVEL SECURITY;

-- Create a new function that handles board creation with member addition
CREATE OR REPLACE FUNCTION create_board_with_owner(
  board_name text,
  owner_user_id uuid,
  access_code_param text,
  share_code_param text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_board_id uuid;
BEGIN
  -- Insert the board
  INSERT INTO boards (name, owner_id, access_code, share_code)
  VALUES (board_name, owner_user_id, access_code_param, share_code_param)
  RETURNING id INTO new_board_id;
  
  -- Add the owner as a board member
  INSERT INTO board_members (board_id, user_id, role)
  VALUES (new_board_id, owner_user_id, 'owner')
  ON CONFLICT (board_id, user_id) DO NOTHING;
  
  RETURN new_board_id;
END;
$$;

-- Re-enable RLS on boards table
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

-- Create new simplified policies for boards

-- Policy 1: Users can see boards they own (direct check)
CREATE POLICY "boards_owner_access"
  ON boards
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Policy 2: Users can see boards they are members of (safe SELECT-only policy)
CREATE POLICY "boards_member_select"
  ON boards
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM board_members bm 
      WHERE bm.board_id = boards.id 
      AND bm.user_id = auth.uid()
    )
  );

-- Create new simplified policies for board_members

-- Policy 1: Users can see their own memberships
CREATE POLICY "board_members_own_access"
  ON board_members
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy 2: Board owners can manage all members
CREATE POLICY "board_members_owner_manage"
  ON board_members
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT b.owner_id FROM boards b WHERE b.id = board_members.board_id
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT b.owner_id FROM boards b WHERE b.id = board_members.board_id
    )
  );

-- Policy 3: Users can add themselves to boards
CREATE POLICY "board_members_self_join"
  ON board_members
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can remove themselves from boards
CREATE POLICY "board_members_self_leave"
  ON board_members
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Remove the old trigger that was causing recursion
DROP TRIGGER IF EXISTS add_board_creator_trigger ON boards;

-- Create a new trigger that uses the safe function
CREATE OR REPLACE FUNCTION safe_add_board_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only add the creator if they're not already a member
  INSERT INTO board_members (board_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (board_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create the new trigger
CREATE TRIGGER safe_add_board_creator_trigger
  AFTER INSERT ON boards
  FOR EACH ROW
  EXECUTE FUNCTION safe_add_board_creator();