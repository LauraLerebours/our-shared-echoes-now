/*
  # Update RLS policies for memories table

  1. Changes
    - Update RLS policies for the memories table to allow authenticated users to:
      - Insert memories when they have access to the board (via ownership or access code)
      - Select memories when they have access to the board
      - Update memories when they have access to the board
      - Delete memories when they have access to the board

  2. Security
    - Maintains RLS enabled on memories table
    - Updates policies to properly check board access
    - Ensures users can only access memories they should have access to
*/

-- Drop existing policies to recreate them with correct conditions
DROP POLICY IF EXISTS "Allow delete for authenticated users with board access" ON memories;
DROP POLICY IF EXISTS "Allow insert for authenticated users with board access" ON memories;
DROP POLICY IF EXISTS "Allow select for authenticated users with board access" ON memories;
DROP POLICY IF EXISTS "Allow update for authenticated users with board access" ON memories;

-- Create new policies with correct conditions
CREATE POLICY "Allow insert for authenticated users with board access"
ON memories
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM boards
    WHERE (
      boards.access_code = memories.access_code
      AND (
        boards.owner_id = auth.uid()
        OR
        boards.access_code = current_setting('app.current_access_code'::text, true)
      )
    )
  )
);

CREATE POLICY "Allow select for authenticated users with board access"
ON memories
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM boards
    WHERE (
      boards.access_code = memories.access_code
      AND (
        boards.owner_id = auth.uid()
        OR
        boards.access_code = current_setting('app.current_access_code'::text, true)
      )
    )
  )
);

CREATE POLICY "Allow update for authenticated users with board access"
ON memories
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM boards
    WHERE (
      boards.access_code = memories.access_code
      AND (
        boards.owner_id = auth.uid()
        OR
        boards.access_code = current_setting('app.current_access_code'::text, true)
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM boards
    WHERE (
      boards.access_code = memories.access_code
      AND (
        boards.owner_id = auth.uid()
        OR
        boards.access_code = current_setting('app.current_access_code'::text, true)
      )
    )
  )
);

CREATE POLICY "Allow delete for authenticated users with board access"
ON memories
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM boards
    WHERE (
      boards.access_code = memories.access_code
      AND (
        boards.owner_id = auth.uid()
        OR
        boards.access_code = current_setting('app.current_access_code'::text, true)
      )
    )
  )
);