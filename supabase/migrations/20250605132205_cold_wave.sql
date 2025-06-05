/*
  # Simplified Board Schema with Access Codes
  
  1. New Tables
    - `boards`
      - `id` (uuid, primary key)
      - `name` (text)
      - `access_code` (text, unique)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Changes
    - Link memories to boards via board_id
    - Set up RLS policies based on access codes
    - Add performance indexes
*/

-- Create boards table with simplified schema
CREATE TABLE IF NOT EXISTS boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  access_code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add board reference to memories
ALTER TABLE memories
  ADD COLUMN board_id uuid REFERENCES boards(id);

-- Enable RLS
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

-- Create policies for boards
CREATE POLICY "Anyone can view boards"
ON boards FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Anyone can create boards"
ON boards FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Anyone with access code can update boards"
ON boards FOR UPDATE
TO authenticated
USING (access_code = current_setting('app.current_access_code', true))
WITH CHECK (access_code = current_setting('app.current_access_code', true));

CREATE POLICY "Anyone with access code can delete boards"
ON boards FOR DELETE
TO authenticated
USING (access_code = current_setting('app.current_access_code', true));

-- Update memories policies
CREATE POLICY "Anyone can view memories in accessible boards"
ON memories FOR SELECT
TO authenticated
USING (board_id IN (SELECT id FROM boards));

CREATE POLICY "Anyone can create memories in accessible boards"
ON memories FOR INSERT
TO authenticated
WITH CHECK (board_id IN (SELECT id FROM boards));

CREATE POLICY "Anyone can update memories in accessible boards"
ON memories FOR UPDATE
TO authenticated
USING (board_id IN (SELECT id FROM boards))
WITH CHECK (board_id IN (SELECT id FROM boards));

CREATE POLICY "Anyone can delete memories in accessible boards"
ON memories FOR DELETE
TO authenticated
USING (board_id IN (SELECT id FROM boards));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS boards_access_code_idx ON boards(access_code);
CREATE INDEX IF NOT EXISTS memories_board_id_idx ON memories(board_id);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_boards_updated_at
    BEFORE UPDATE ON boards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();