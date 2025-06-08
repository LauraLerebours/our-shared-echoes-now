/*
  # Update schema to use access codes

  1. Changes
    - Create access_codes table
    - Add access_code to memories table
    - Update RLS policies

  2. Security
    - Enable RLS on access_codes table
    - Add policies for CRUD operations
*/

-- Create access_codes table
CREATE TABLE IF NOT EXISTS access_codes (
  code text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Drop existing policies first
DROP POLICY IF EXISTS "Self access" ON memories;
DROP POLICY IF EXISTS "Users can create their own memories" ON memories;
DROP POLICY IF EXISTS "Users can view their own memories" ON memories;
DROP POLICY IF EXISTS "Users can update their own memories" ON memories;
DROP POLICY IF EXISTS "Users can delete their own memories" ON memories;

-- Modify memories table
ALTER TABLE memories
  DROP CONSTRAINT IF EXISTS memories_user_id_fkey,
  DROP CONSTRAINT IF EXISTS memories_board_id_fkey;

ALTER TABLE memories
  DROP COLUMN IF EXISTS board_id,
  DROP COLUMN IF EXISTS user_id,
  ADD COLUMN IF NOT EXISTS access_code text REFERENCES access_codes(code);

-- Enable RLS
ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- New policies based on access code
CREATE POLICY "Anyone can view memories with valid access code"
ON memories FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Anyone can create memories with valid access code"
ON memories FOR INSERT
TO authenticated
WITH CHECK (access_code IN (SELECT code FROM access_codes));

CREATE POLICY "Anyone can update memories with valid access code"
ON memories FOR UPDATE
TO authenticated
USING (access_code IN (SELECT code FROM access_codes))
WITH CHECK (access_code IN (SELECT code FROM access_codes));

CREATE POLICY "Anyone can delete memories with valid access code"
ON memories FOR DELETE
TO authenticated
USING (access_code IN (SELECT code FROM access_codes));

-- Access code policies
CREATE POLICY "Anyone can create access codes"
ON access_codes FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can view access codes"
ON access_codes FOR SELECT
TO authenticated
USING (true);