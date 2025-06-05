/*
  # Update memories table RLS policies

  1. Changes
    - Update RLS policies for memories table to allow operations based on board_id

  2. Security
    - Enable RLS on memories table
    - Add policies for authenticated users to manage memories in accessible boards
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can create memories in accessible boards" ON memories;
DROP POLICY IF EXISTS "Anyone can create memories with valid access code" ON memories;
DROP POLICY IF EXISTS "Anyone can delete memories in accessible boards" ON memories;
DROP POLICY IF EXISTS "Anyone can delete memories with valid access code" ON memories;
DROP POLICY IF EXISTS "Anyone can update memories in accessible boards" ON memories;
DROP POLICY IF EXISTS "Anyone can update memories with valid access code" ON memories;
DROP POLICY IF EXISTS "Anyone can view memories in accessible boards" ON memories;
DROP POLICY IF EXISTS "Anyone can view memories with valid access code" ON memories;

-- Create new policies
CREATE POLICY "Enable read access for memories in accessible boards"
  ON memories FOR SELECT
  TO authenticated
  USING (
    board_id IN (
      SELECT id FROM boards
    )
  );

CREATE POLICY "Enable insert access for memories in accessible boards"
  ON memories FOR INSERT
  TO authenticated
  WITH CHECK (
    board_id IN (
      SELECT id FROM boards
    )
  );

CREATE POLICY "Enable update access for memories in accessible boards"
  ON memories FOR UPDATE
  TO authenticated
  USING (
    board_id IN (
      SELECT id FROM boards
    )
  )
  WITH CHECK (
    board_id IN (
      SELECT id FROM boards
    )
  );

CREATE POLICY "Enable delete access for memories in accessible boards"
  ON memories FOR DELETE
  TO authenticated
  USING (
    board_id IN (
      SELECT id FROM boards
    )
  );