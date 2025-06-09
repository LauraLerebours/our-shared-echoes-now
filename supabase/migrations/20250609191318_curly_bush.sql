/*
  # Add created_by column to memories table

  1. Schema Changes
    - Add `created_by` column to `memories` table as uuid foreign key to auth.users
    - Update existing records to have a default created_by value (null for now)
    
  2. Security Updates
    - Update RLS policies to allow users to create memories
    - Add policy for users to read memories they created
    - Add policy for users to update/delete their own memories
    
  3. Indexes
    - Add index on created_by column for better query performance
*/

-- Add the created_by column to memories table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'memories' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE memories ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_memories_created_by ON memories(created_by);

-- Drop existing policies to recreate them with proper permissions
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON memories;

-- Create comprehensive RLS policies for memories table
CREATE POLICY "Users can create memories"
  ON memories
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can read all memories"
  ON memories
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own memories"
  ON memories
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own memories"
  ON memories
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);