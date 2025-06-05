/*
  # Add owner_id column to boards table

  1. Changes
    - Add `owner_id` column to `boards` table
    - Add foreign key constraint to link `owner_id` to `auth.users.id`
    - Add index on `owner_id` for better query performance
  
  2. Security
    - No changes to RLS policies needed as they are already in place
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'boards' AND column_name = 'owner_id'
  ) THEN
    -- Add owner_id column
    ALTER TABLE boards 
    ADD COLUMN owner_id uuid REFERENCES auth.users(id);

    -- Create index for better performance
    CREATE INDEX IF NOT EXISTS boards_owner_id_idx ON boards(owner_id);
  END IF;
END $$;