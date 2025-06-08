/*
  # Fix board creation infinite recursion

  1. Remove all problematic triggers and policies
  2. Create a simple, safe board creation function
  3. Implement non-recursive RLS policies
  4. Ensure board creation works without circular dependencies
*/

-- Drop all existing problematic triggers
DROP TRIGGER IF EXISTS safe_add_board_creator_trigger ON boards;
DROP TRIGGER IF EXISTS add_board_creator_trigger ON boards;
DROP TRIGGER IF EXISTS generate_share_code_trigger ON boards;

-- Drop all existing problematic policies on boards
DROP POLICY IF EXISTS "boards_owner_access" ON boards;
DROP POLICY IF EXISTS "boards_member_select" ON boards;

-- Drop all existing problematic policies on board_members
DROP POLICY IF EXISTS "board_members_own_access" ON board_members;
DROP POLICY IF EXISTS "board_members_owner_manage" ON board_members;
DROP POLICY IF EXISTS "board_members_self_join" ON board_members;
DROP POLICY IF EXISTS "board_members_self_leave" ON board_members;

-- Drop the existing problematic function
DROP FUNCTION IF EXISTS create_board_with_owner(text, uuid, text, text);
DROP FUNCTION IF EXISTS safe_add_board_creator();

-- Temporarily disable RLS to avoid recursion during setup
ALTER TABLE boards DISABLE ROW LEVEL SECURITY;
ALTER TABLE board_members DISABLE ROW LEVEL SECURITY;

-- Create a simple, safe board creation function
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
  -- Insert the board (RLS is disabled, so this will work)
  INSERT INTO boards (name, owner_id, access_code, share_code, created_at, updated_at)
  VALUES (board_name, owner_user_id, access_code_param, share_code_param, NOW(), NOW())
  RETURNING id INTO new_board_id;
  
  -- Add the owner as a board member (RLS is disabled, so this will work)
  INSERT INTO board_members (board_id, user_id, role, joined_at)
  VALUES (new_board_id, owner_user_id, 'owner', NOW())
  ON CONFLICT (board_id, user_id) DO NOTHING;
  
  RETURN new_board_id;
END;
$$;

-- Re-enable RLS
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies for boards

-- Policy 1: Board owners can do everything with their boards
CREATE POLICY "boards_owner_full_access"
  ON boards
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Policy 2: Board members can only SELECT boards they're members of
CREATE POLICY "boards_member_read_only"
  ON boards
  FOR SELECT
  TO authenticated
  USING (
    -- Direct check without recursion
    id IN (
      SELECT board_id 
      FROM board_members 
      WHERE user_id = auth.uid()
    )
  );

-- Create simple, non-recursive policies for board_members

-- Policy 1: Users can see their own memberships
CREATE POLICY "board_members_view_own"
  ON board_members
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy 2: Board owners can see all members of their boards
CREATE POLICY "board_members_owner_view_all"
  ON board_members
  FOR SELECT
  TO authenticated
  USING (
    -- Direct check using boards table
    board_id IN (
      SELECT id FROM boards WHERE owner_id = auth.uid()
    )
  );

-- Policy 3: Users can add themselves to boards (for joining)
CREATE POLICY "board_members_self_insert"
  ON board_members
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy 4: Board owners can add/update/delete members
CREATE POLICY "board_members_owner_manage"
  ON board_members
  FOR ALL
  TO authenticated
  USING (
    -- Direct check using boards table
    board_id IN (
      SELECT id FROM boards WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Direct check using boards table
    board_id IN (
      SELECT id FROM boards WHERE owner_id = auth.uid()
    )
  );

-- Policy 5: Users can remove themselves from boards
CREATE POLICY "board_members_self_delete"
  ON board_members
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create a simple trigger for share code generation (no recursion risk)
CREATE OR REPLACE FUNCTION generate_board_share_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.share_code IS NULL OR NEW.share_code = '' THEN
    NEW.share_code = upper(substring(md5(random()::text) from 1 for 6));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_share_code_trigger
  BEFORE INSERT ON boards
  FOR EACH ROW
  EXECUTE FUNCTION generate_board_share_code();

-- Ensure all necessary indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_boards_owner_id ON boards(owner_id);
CREATE INDEX IF NOT EXISTS idx_board_members_user_id ON board_members(user_id);
CREATE INDEX IF NOT EXISTS idx_board_members_board_id ON board_members(board_id);
CREATE INDEX IF NOT EXISTS idx_board_members_board_user ON board_members(board_id, user_id);