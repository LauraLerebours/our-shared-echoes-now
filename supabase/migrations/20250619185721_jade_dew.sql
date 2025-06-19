/*
  # Fix Public Boards Schema

  1. Schema Changes
    - Add `is_public` column to `boards` table if it doesn't exist
    - Set default value to false (private boards)
    - Add index for better performance when querying public boards

  2. Security
    - Update RLS policies to allow viewing public boards
    - Maintain existing security for private boards
    - Only board owners can change public/private status

  3. Functions
    - Update board creation function to support public/private flag
    - Add function to get public boards
*/

-- Add is_public column to boards table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'boards' AND column_name = 'is_public'
  ) THEN
    ALTER TABLE boards ADD COLUMN is_public boolean DEFAULT false;
  END IF;
END $$;

-- Create index for better performance when querying public boards
CREATE INDEX IF NOT EXISTS idx_boards_is_public ON boards(is_public);

-- Update create_board_with_owner function to support public/private flag
CREATE OR REPLACE FUNCTION create_board_with_owner(
  board_name text,
  owner_user_id uuid,
  access_code_param text,
  share_code_param text,
  is_public_param boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  new_board_id uuid;
BEGIN
  -- Generate a new UUID for the board
  new_board_id := gen_random_uuid();
  
  -- Insert the board with the creator as both owner and first member
  INSERT INTO boards (
    id, 
    name, 
    owner_id, 
    access_code, 
    share_code, 
    member_ids,
    is_public,
    created_at, 
    updated_at
  )
  VALUES (
    new_board_id, 
    board_name, 
    owner_user_id, 
    access_code_param, 
    share_code_param, 
    ARRAY[owner_user_id],
    is_public_param,
    NOW(), 
    NOW()
  );
  
  RETURN new_board_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and re-raise
    RAISE EXCEPTION 'Failed to create board: %', SQLERRM;
END;
$$;

-- Create function to get public boards
CREATE OR REPLACE FUNCTION get_public_boards(exclude_user_id uuid DEFAULT NULL)
RETURNS SETOF boards
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth, extensions
AS $$
  SELECT *
  FROM boards
  WHERE is_public = true
    AND (
      exclude_user_id IS NULL
      OR (
        owner_id != exclude_user_id
        AND NOT (exclude_user_id = ANY(COALESCE(member_ids, ARRAY[]::uuid[])))
      )
    )
  ORDER BY created_at DESC;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_public_boards(uuid) TO authenticated;

-- Update RLS policies to allow viewing public boards
DROP POLICY IF EXISTS "boards_public_view" ON boards;
CREATE POLICY "boards_public_view" ON boards
  FOR SELECT
  TO authenticated
  USING (is_public = true);

-- Ensure only owners can update the public/private status
DROP POLICY IF EXISTS "boards_owner_update" ON boards;
CREATE POLICY "boards_owner_update" ON boards
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Update table statistics for better query planning
ANALYZE boards;