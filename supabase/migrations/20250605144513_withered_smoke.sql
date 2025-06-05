/*
  # Fix RLS Policies for Memories Table

  1. Changes
    - Drop existing policies that are causing issues
    - Create new simplified policies for memories table
    - Update access control based on access_code

  2. Security
    - Enable RLS
    - Add policies for CRUD operations
    - Ensure proper access control
*/

-- First drop all existing policies to start fresh
DROP POLICY IF EXISTS "Allow delete for authenticated users with board access" ON memories;
DROP POLICY IF EXISTS "Allow insert for authenticated users with board access" ON memories;
DROP POLICY IF EXISTS "Allow select for authenticated users with board access" ON memories;
DROP POLICY IF EXISTS "Allow update for authenticated users with board access" ON memories;

-- Enable RLS
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- Create new simplified policies
CREATE POLICY "Enable read access for all authenticated users"
ON memories FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert with valid access code"
ON memories FOR INSERT
TO authenticated
WITH CHECK (
  access_code IN (
    SELECT access_code FROM boards
    WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Enable update with valid access code"
ON memories FOR UPDATE
TO authenticated
USING (
  access_code IN (
    SELECT access_code FROM boards
    WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  access_code IN (
    SELECT access_code FROM boards
    WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Enable delete with valid access code"
ON memories FOR DELETE
TO authenticated
USING (
  access_code IN (
    SELECT access_code FROM boards
    WHERE owner_id = auth.uid()
  )
);