/*
  # Database Schema Setup

  1. New Tables
    - `access_codes` - Store access codes for memory boards
    - `boards` - User-owned memory boards
    - `shared_boards` - Shareable board references
    - `memories` - Photos/videos with captions and metadata
    - `love_notes` - Scheduled notes for users

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for each table
    - Ensure users can only access their own data or shared content

  3. Relationships
    - boards.owner_id -> auth.users(id)
    - shared_boards.owner_id -> auth.users(id)
    - memories.access_code -> access_codes(code)
    - love_notes.user_id -> auth.users(id)
*/

-- Create or update access_codes table
CREATE TABLE IF NOT EXISTS access_codes (
  code text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create or update boards table
CREATE TABLE IF NOT EXISTS boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,
  name text,
  updated_at timestamptz,
  access_code text,
  owner_id uuid
);

-- Create or update shared_boards table
CREATE TABLE IF NOT EXISTS shared_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  share_code text NOT NULL,
  name text,
  created_at timestamptz DEFAULT now()
);

-- Create or update memories table (without board_id since it's not in the schema)
CREATE TABLE IF NOT EXISTS memories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  caption text,
  media_url text NOT NULL,
  is_video boolean DEFAULT false NOT NULL,
  event_date timestamp without time zone NOT NULL,
  location text,
  likes integer DEFAULT 0 NOT NULL,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  is_liked boolean,
  access_code text
);

-- Create or update love_notes table
CREATE TABLE IF NOT EXISTS love_notes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  content text NOT NULL,
  scheduled_for timestamp without time zone NOT NULL,
  delivered boolean DEFAULT false NOT NULL,
  created_at timestamp without time zone DEFAULT now() NOT NULL
);

-- Add columns that might be missing
DO $$
BEGIN
  -- Add board_id column to memories if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'memories' AND column_name = 'board_id'
  ) THEN
    ALTER TABLE memories ADD COLUMN board_id uuid;
  END IF;
END $$;

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
  -- Add foreign key for boards.owner_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'boards_owner_id_fkey'
  ) THEN
    ALTER TABLE boards ADD CONSTRAINT boards_owner_id_fkey 
    FOREIGN KEY (owner_id) REFERENCES auth.users(id);
  END IF;

  -- Add foreign key for shared_boards.owner_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'shared_boards_owner_id_fkey'
  ) THEN
    ALTER TABLE shared_boards ADD CONSTRAINT shared_boards_owner_id_fkey 
    FOREIGN KEY (owner_id) REFERENCES auth.users(id);
  END IF;

  -- Add foreign key for memories.access_code if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'memories_access_code_fkey'
  ) THEN
    ALTER TABLE memories ADD CONSTRAINT memories_access_code_fkey 
    FOREIGN KEY (access_code) REFERENCES access_codes(code);
  END IF;

  -- Add foreign key for memories.board_id if it doesn't exist (only after adding the column)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'memories' AND column_name = 'board_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'memories_board_id_fkey'
  ) THEN
    ALTER TABLE memories ADD CONSTRAINT memories_board_id_fkey 
    FOREIGN KEY (board_id) REFERENCES boards(id);
  END IF;

  -- Add foreign key for love_notes.user_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'love_notes_user_id_fkey'
  ) THEN
    ALTER TABLE love_notes ADD CONSTRAINT love_notes_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add unique constraints if they don't exist
DO $$
BEGIN
  -- Add unique constraint for boards.access_code if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'boards_access_code_key'
  ) THEN
    ALTER TABLE boards ADD CONSTRAINT boards_access_code_key UNIQUE (access_code);
  END IF;

  -- Add unique constraint for shared_boards.share_code if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'shared_boards_share_code_key'
  ) THEN
    ALTER TABLE shared_boards ADD CONSTRAINT shared_boards_share_code_key UNIQUE (share_code);
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS boards_access_code_idx ON boards(access_code);
CREATE INDEX IF NOT EXISTS boards_owner_id_idx ON boards(owner_id);
CREATE INDEX IF NOT EXISTS shared_boards_share_code_idx ON shared_boards(share_code);
CREATE INDEX IF NOT EXISTS memories_board_id_idx ON memories(board_id);

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for boards updated_at
DROP TRIGGER IF EXISTS update_boards_updated_at ON boards;
CREATE TRIGGER update_boards_updated_at
    BEFORE UPDATE ON boards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE love_notes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can create access codes" ON access_codes;
DROP POLICY IF EXISTS "Anyone can view access codes" ON access_codes;
DROP POLICY IF EXISTS "Anyone can create boards" ON boards;
DROP POLICY IF EXISTS "Anyone can view boards" ON boards;
DROP POLICY IF EXISTS "Anyone with access code can delete boards" ON boards;
DROP POLICY IF EXISTS "Anyone with access code can update boards" ON boards;
DROP POLICY IF EXISTS "Anyone can view shared boards" ON shared_boards;
DROP POLICY IF EXISTS "Users can create their own shared boards" ON shared_boards;
DROP POLICY IF EXISTS "Users can delete their own shared boards" ON shared_boards;
DROP POLICY IF EXISTS "Users can update their own shared boards" ON shared_boards;
DROP POLICY IF EXISTS "Users can view shared boards" ON shared_boards;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON memories;
DROP POLICY IF EXISTS "Enable insert with valid access code" ON memories;
DROP POLICY IF EXISTS "Enable update with valid access code" ON memories;
DROP POLICY IF EXISTS "Enable delete with valid access code" ON memories;
DROP POLICY IF EXISTS "Self access" ON love_notes;

-- Create policies for access_codes
CREATE POLICY "Anyone can create access codes"
ON access_codes FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can view access codes"
ON access_codes FOR SELECT
TO authenticated
USING (true);

-- Create policies for boards
CREATE POLICY "Anyone can create boards"
ON boards FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can view boards"
ON boards FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Anyone with access code can delete boards"
ON boards FOR DELETE
TO authenticated
USING (access_code = current_setting('app.current_access_code', true));

CREATE POLICY "Anyone with access code can update boards"
ON boards FOR UPDATE
TO authenticated
USING (access_code = current_setting('app.current_access_code', true))
WITH CHECK (access_code = current_setting('app.current_access_code', true));

-- Create policies for shared_boards
CREATE POLICY "Anyone can view shared boards"
ON shared_boards FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create their own shared boards"
ON shared_boards FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own shared boards"
ON shared_boards FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Users can update their own shared boards"
ON shared_boards FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can view shared boards"
ON shared_boards FOR SELECT
TO authenticated
USING (true);

-- Create policies for memories
CREATE POLICY "Enable read access for all authenticated users"
ON memories FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert with valid access code"
ON memories FOR INSERT
TO authenticated
WITH CHECK (access_code IN (
  SELECT boards.access_code
  FROM boards
  WHERE boards.owner_id = auth.uid()
));

CREATE POLICY "Enable update with valid access code"
ON memories FOR UPDATE
TO authenticated
USING (access_code IN (
  SELECT boards.access_code
  FROM boards
  WHERE boards.owner_id = auth.uid()
))
WITH CHECK (access_code IN (
  SELECT boards.access_code
  FROM boards
  WHERE boards.owner_id = auth.uid()
));

CREATE POLICY "Enable delete with valid access code"
ON memories FOR DELETE
TO authenticated
USING (access_code IN (
  SELECT boards.access_code
  FROM boards
  WHERE boards.owner_id = auth.uid()
));

-- Create policies for love_notes
CREATE POLICY "Self access"
ON love_notes FOR ALL
TO public
USING (auth.uid() = user_id);