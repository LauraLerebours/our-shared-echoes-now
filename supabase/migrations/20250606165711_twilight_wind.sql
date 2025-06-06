/*
  # Add collaborative boards functionality

  1. New Tables
    - `board_members` - Junction table for user-board relationships
      - `id` (uuid, primary key)
      - `board_id` (uuid, foreign key to boards)
      - `user_id` (uuid, foreign key to auth.users)
      - `role` (text, either 'owner' or 'member')
      - `joined_at` (timestamp)

  2. Changes
    - Update RLS policies to allow board members to access boards
    - Allow members to add memories to shared boards
    - Maintain backward compatibility with existing owner_id system

  3. Security
    - Enable RLS on board_members table
    - Add policies for board access based on membership
    - Update memory policies to include board members
*/

-- Create board_members table for collaborative access
CREATE TABLE IF NOT EXISTS board_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(board_id, user_id)
);

-- Add foreign key constraints
ALTER TABLE board_members 
ADD CONSTRAINT board_members_board_id_fkey 
FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

ALTER TABLE board_members 
ADD CONSTRAINT board_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS board_members_board_id_idx ON board_members(board_id);
CREATE INDEX IF NOT EXISTS board_members_user_id_idx ON board_members(user_id);

-- Populate board_members table with existing board owners
INSERT INTO board_members (board_id, user_id, role)
SELECT id, owner_id, 'owner'
FROM boards 
WHERE owner_id IS NOT NULL
ON CONFLICT (board_id, user_id) DO NOTHING;

-- Enable RLS on board_members
ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;

-- Create policies for board_members
CREATE POLICY "Users can view their board memberships"
ON board_members FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Board owners can manage members"
ON board_members FOR ALL
TO authenticated
USING (
  board_id IN (
    SELECT board_id FROM board_members 
    WHERE user_id = auth.uid() AND role = 'owner'
  )
);

-- Update boards policies to include board members
DROP POLICY IF EXISTS "Anyone can view boards" ON boards;
CREATE POLICY "Board members can view boards"
ON boards FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT board_id FROM board_members 
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Anyone with access code can delete boards" ON boards;
CREATE POLICY "Board owners can delete boards"
ON boards FOR DELETE
TO authenticated
USING (
  id IN (
    SELECT board_id FROM board_members 
    WHERE user_id = auth.uid() AND role = 'owner'
  )
);

DROP POLICY IF EXISTS "Anyone with access code can update boards" ON boards;
CREATE POLICY "Board owners can update boards"
ON boards FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT board_id FROM board_members 
    WHERE user_id = auth.uid() AND role = 'owner'
  )
)
WITH CHECK (
  id IN (
    SELECT board_id FROM board_members 
    WHERE user_id = auth.uid() AND role = 'owner'
  )
);

-- Update memory policies to include board members
DROP POLICY IF EXISTS "Enable insert with valid access code" ON memories;
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

DROP POLICY IF EXISTS "Enable update with valid access code" ON memories;
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

DROP POLICY IF EXISTS "Enable delete with valid access code" ON memories;
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

-- Create function to add user to board
CREATE OR REPLACE FUNCTION add_user_to_board(board_share_code text, user_id_param uuid)
RETURNS boolean AS $$
DECLARE
  target_board_id uuid;
  membership_exists boolean;
BEGIN
  -- Find the board by share code
  SELECT id INTO target_board_id
  FROM boards
  WHERE share_code = board_share_code;
  
  -- Return false if board doesn't exist
  IF target_board_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user is already a member
  SELECT EXISTS(
    SELECT 1 FROM board_members 
    WHERE board_id = target_board_id AND user_id = user_id_param
  ) INTO membership_exists;
  
  -- Return true if already a member
  IF membership_exists THEN
    RETURN true;
  END IF;
  
  -- Add user as member
  INSERT INTO board_members (board_id, user_id, role)
  VALUES (target_board_id, user_id_param, 'member');
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically add board creator as owner
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

DROP TRIGGER IF EXISTS add_board_creator_trigger ON boards;
CREATE TRIGGER add_board_creator_trigger
  AFTER INSERT ON boards
  FOR EACH ROW
  EXECUTE FUNCTION add_board_creator_as_owner();