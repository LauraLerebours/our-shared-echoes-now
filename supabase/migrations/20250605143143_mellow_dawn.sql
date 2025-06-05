/*
  # Fix memories table RLS policies

  1. Changes
    - Update RLS policies for memories table to allow proper access based on board access

  2. Security
    - Enable RLS on memories table
    - Add policies for CRUD operations based on board access
    - Users can manage memories in boards they have access to
*/

-- First enable RLS if not already enabled
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable delete access for memories in accessible boards" ON memories;
DROP POLICY IF EXISTS "Enable insert access for memories in accessible boards" ON memories;
DROP POLICY IF EXISTS "Enable read access for memories in accessible boards" ON memories;
DROP POLICY IF EXISTS "Enable update access for memories in accessible boards" ON memories;

-- Create new policies that properly handle board access
CREATE POLICY "Allow insert for authenticated users with board access"
ON memories FOR INSERT TO authenticated
WITH CHECK (
  -- Allow insert if the board_id exists in accessible boards
  board_id IN (
    SELECT id FROM boards
    WHERE owner_id = auth.uid()
    OR access_code = current_setting('app.current_access_code'::text, true)
  )
  -- Also verify the access_code matches the board's access_code
  AND access_code IN (
    SELECT access_code FROM boards 
    WHERE id = board_id
  )
);

CREATE POLICY "Allow select for authenticated users with board access"
ON memories FOR SELECT TO authenticated
USING (
  board_id IN (
    SELECT id FROM boards
    WHERE owner_id = auth.uid()
    OR access_code = current_setting('app.current_access_code'::text, true)
  )
);

CREATE POLICY "Allow update for authenticated users with board access"
ON memories FOR UPDATE TO authenticated
USING (
  board_id IN (
    SELECT id FROM boards
    WHERE owner_id = auth.uid()
    OR access_code = current_setting('app.current_access_code'::text, true)
  )
)
WITH CHECK (
  board_id IN (
    SELECT id FROM boards
    WHERE owner_id = auth.uid()
    OR access_code = current_setting('app.current_access_code'::text, true)
  )
);

CREATE POLICY "Allow delete for authenticated users with board access"
ON memories FOR DELETE TO authenticated
USING (
  board_id IN (
    SELECT id FROM boards
    WHERE owner_id = auth.uid()
    OR access_code = current_setting('app.current_access_code'::text, true)
  )
);