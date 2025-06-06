/*
  # Fix Board Lookup System

  1. Database Schema Updates
    - Ensure all tables have proper structure
    - Fix foreign key relationships
    - Update RLS policies for collaborative access

  2. Board Member System
    - Proper board membership management
    - Owner and member role handling
    - Share code functionality

  3. Security Policies
    - Board access based on membership
    - Memory access for board members
    - Proper isolation between boards
*/

-- Ensure users table exists (this should be handled by Supabase Auth)
-- We'll reference auth.users directly

-- Drop and recreate board_members table with proper structure
DROP TABLE IF EXISTS board_members CASCADE;
CREATE TABLE board_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(board_id, user_id)
);

-- Add foreign key constraints for board_members
ALTER TABLE board_members 
ADD CONSTRAINT board_members_board_id_fkey 
FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

ALTER TABLE board_members 
ADD CONSTRAINT board_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX board_members_board_id_idx ON board_members(board_id);
CREATE INDEX board_members_user_id_idx ON board_members(user_id);

-- Enable RLS on board_members
ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can view their own memberships" ON board_members;
DROP POLICY IF EXISTS "Users can insert themselves as board members" ON board_members;
DROP POLICY IF EXISTS "Board owners can insert other members" ON board_members;
DROP POLICY IF EXISTS "Board owners can update members" ON board_members;
DROP POLICY IF EXISTS "Board owners can delete members" ON board_members;

-- Create board_members policies
CREATE POLICY "Users can view their own memberships"
  ON board_members FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert themselves as board members"
  ON board_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Board owners can insert other members"
  ON board_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM board_members existing_members
      WHERE existing_members.board_id = board_members.board_id
        AND existing_members.user_id = auth.uid()
        AND existing_members.role = 'owner'
    )
  );

CREATE POLICY "Board owners can update members"
  ON board_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM board_members existing_members
      WHERE existing_members.board_id = board_members.board_id
        AND existing_members.user_id = auth.uid()
        AND existing_members.role = 'owner'
    )
  );

CREATE POLICY "Board owners can delete members"
  ON board_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM board_members existing_members
      WHERE existing_members.board_id = board_members.board_id
        AND existing_members.user_id = auth.uid()
        AND existing_members.role = 'owner'
    )
  );

-- Update boards policies
DROP POLICY IF EXISTS "Allow authenticated users to create boards" ON boards;
DROP POLICY IF EXISTS "Users can view their boards and member boards" ON boards;
DROP POLICY IF EXISTS "Board owners can update their boards" ON boards;
DROP POLICY IF EXISTS "Board owners can delete their boards" ON boards;

CREATE POLICY "Allow authenticated users to create boards"
  ON boards FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can view their boards and member boards"
  ON boards FOR SELECT
  TO authenticated
  USING (
    (owner_id = auth.uid()) OR 
    (id IN (
      SELECT board_members.board_id
      FROM board_members
      WHERE board_members.user_id = auth.uid()
    ))
  );

CREATE POLICY "Board owners can update their boards"
  ON boards FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT board_members.board_id
      FROM board_members
      WHERE board_members.user_id = auth.uid() AND board_members.role = 'owner'
    )
  )
  WITH CHECK (
    id IN (
      SELECT board_members.board_id
      FROM board_members
      WHERE board_members.user_id = auth.uid() AND board_members.role = 'owner'
    )
  );

CREATE POLICY "Board owners can delete their boards"
  ON boards FOR DELETE
  TO authenticated
  USING (
    id IN (
      SELECT board_members.board_id
      FROM board_members
      WHERE board_members.user_id = auth.uid() AND board_members.role = 'owner'
    )
  );

-- Update memory policies for board members
DROP POLICY IF EXISTS "Board members can insert memories" ON memories;
DROP POLICY IF EXISTS "Board members can update memories" ON memories;
DROP POLICY IF EXISTS "Board members can delete memories" ON memories;

CREATE POLICY "Board members can insert memories"
  ON memories FOR INSERT
  TO authenticated
  WITH CHECK (
    access_code IN (
      SELECT b.access_code
      FROM boards b
      JOIN board_members bm ON b.id = bm.board_id
      WHERE bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Board members can update memories"
  ON memories FOR UPDATE
  TO authenticated
  USING (
    access_code IN (
      SELECT b.access_code
      FROM boards b
      JOIN board_members bm ON b.id = bm.board_id
      WHERE bm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    access_code IN (
      SELECT b.access_code
      FROM boards b
      JOIN board_members bm ON b.id = bm.board_id
      WHERE bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Board members can delete memories"
  ON memories FOR DELETE
  TO authenticated
  USING (
    access_code IN (
      SELECT b.access_code
      FROM boards b
      JOIN board_members bm ON b.id = bm.board_id
      WHERE bm.user_id = auth.uid()
    )
  );

-- Recreate the trigger function for adding board creators as owners
CREATE OR REPLACE FUNCTION add_board_creator_as_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Add the creator as owner if owner_id is set
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO board_members (board_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'owner')
    ON CONFLICT (board_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS add_board_creator_trigger ON boards;
CREATE TRIGGER add_board_creator_trigger
  AFTER INSERT ON boards
  FOR EACH ROW
  EXECUTE FUNCTION add_board_creator_as_owner();

-- Populate board_members table with existing board owners (if any)
INSERT INTO board_members (board_id, user_id, role)
SELECT id, owner_id, 'owner'
FROM boards 
WHERE owner_id IS NOT NULL
ON CONFLICT (board_id, user_id) DO NOTHING;

-- Create helper function for adding users to boards via share code
CREATE OR REPLACE FUNCTION add_user_to_board_by_share_code(
  share_code_param text,
  user_id_param uuid DEFAULT auth.uid()
)
RETURNS json AS $$
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
  
  -- Check if user is already a member
  SELECT EXISTS(
    SELECT 1 FROM board_members 
    WHERE board_id = target_board_id AND user_id = user_id_param
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
  
  -- Add user as member
  INSERT INTO board_members (board_id, user_id, role)
  VALUES (target_board_id, user_id_param, 'member');
  
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
$$ LANGUAGE plpgsql SECURITY DEFINER;