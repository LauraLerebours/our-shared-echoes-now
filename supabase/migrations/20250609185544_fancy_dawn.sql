/*
  # Add created_by field to memories table

  1. Changes
    - Add `created_by` column to `memories` table to track who created each memory
    - Set up foreign key relationship to auth.users
    - Add index for better query performance

  2. Security
    - No changes to RLS policies needed as they already handle access control
*/

-- Add created_by column to memories table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'memories' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE memories ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Add index for better performance when querying by creator
CREATE INDEX IF NOT EXISTS idx_memories_created_by ON memories(created_by);

-- Add index for better performance when querying by access_code and creator
CREATE INDEX IF NOT EXISTS idx_memories_access_code_created_by ON memories(access_code, created_by);