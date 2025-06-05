/*
  # Create boards table and update memories

  1. New Tables
    - `boards` table with:
      - `id` (uuid, primary key)
      - `owner_id` (uuid, references auth.users)
      - `name` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes
    - Add `board_id` column to memories table
    - Add foreign key constraint from memories to boards

  3. Security
    - Enable RLS on boards table
    - Add policies for CRUD operations on boards
    - Update memories policies
*/

-- Create boards table
CREATE TABLE IF NOT EXISTS boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add board_id to memories
ALTER TABLE memories 
ADD COLUMN IF NOT EXISTS board_id uuid REFERENCES boards;

-- Enable RLS
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

-- Create policies for boards
CREATE POLICY "Users can create their own boards"
ON boards FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can view their own boards"
ON boards FOR SELECT
TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Users can update their own boards"
ON boards FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own boards"
ON boards FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- Update memories policies to include board_id check
DROP POLICY IF EXISTS "Users can view their own memories" ON memories;
CREATE POLICY "Users can view their own memories"
ON memories FOR SELECT
TO authenticated
USING (
  board_id IN (
    SELECT id FROM boards WHERE owner_id = auth.uid()
  )
);

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