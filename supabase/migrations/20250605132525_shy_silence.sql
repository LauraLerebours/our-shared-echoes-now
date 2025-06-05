/*
  # Add shared boards schema

  1. New Tables
    - `shared_boards`
      - `id` (uuid, primary key)
      - `owner_id` (uuid, references auth.users)
      - `name` (text)
      - `share_code` (text, unique)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on shared_boards table
    - Add policies for CRUD operations
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can create their own shared boards" ON shared_boards;
DROP POLICY IF EXISTS "Anyone can view shared boards" ON shared_boards;
DROP POLICY IF EXISTS "Users can update their own shared boards" ON shared_boards;
DROP POLICY IF EXISTS "Users can delete their own shared boards" ON shared_boards;

-- Create shared_boards table
CREATE TABLE IF NOT EXISTS shared_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  share_code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE shared_boards ENABLE ROW LEVEL SECURITY;

-- Create policies for shared_boards
CREATE POLICY "Users can create their own shared boards"
ON shared_boards FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Anyone can view shared boards"
ON shared_boards FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update their own shared boards"
ON shared_boards FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own shared boards"
ON shared_boards FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- Create index on share_code for faster lookups
CREATE INDEX IF NOT EXISTS shared_boards_share_code_idx ON shared_boards (share_code);