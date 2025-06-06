/*
  # Add share codes directly to boards

  1. Changes
    - Add share_code column to boards table
    - Generate unique share codes for existing boards
    - Remove dependency on shared_boards table for sharing
    - Update indexes and constraints

  2. Security
    - Maintain existing RLS policies
    - Ensure share codes are unique
*/

-- Add share_code column to boards table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'boards' AND column_name = 'share_code'
  ) THEN
    ALTER TABLE boards ADD COLUMN share_code text;
  END IF;
END $$;

-- Generate unique share codes for existing boards that don't have them
DO $$
DECLARE
  board_record RECORD;
  new_share_code text;
  code_exists boolean;
BEGIN
  FOR board_record IN SELECT id FROM boards WHERE share_code IS NULL LOOP
    LOOP
      -- Generate a random 6-character code
      new_share_code := upper(substring(md5(random()::text) from 1 for 6));
      
      -- Check if this code already exists
      SELECT EXISTS(SELECT 1 FROM boards WHERE share_code = new_share_code) INTO code_exists;
      
      -- If code doesn't exist, use it
      IF NOT code_exists THEN
        UPDATE boards SET share_code = new_share_code WHERE id = board_record.id;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Make share_code NOT NULL after populating existing records
ALTER TABLE boards ALTER COLUMN share_code SET NOT NULL;

-- Add unique constraint for share_code
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'boards_share_code_key'
  ) THEN
    ALTER TABLE boards ADD CONSTRAINT boards_share_code_key UNIQUE (share_code);
  END IF;
END $$;

-- Add index for share_code
CREATE INDEX IF NOT EXISTS boards_share_code_idx ON boards(share_code);

-- Create function to generate share code for new boards
CREATE OR REPLACE FUNCTION generate_board_share_code()
RETURNS TRIGGER AS $$
DECLARE
  new_share_code text;
  code_exists boolean;
BEGIN
  -- Only generate if share_code is not already set
  IF NEW.share_code IS NULL THEN
    LOOP
      -- Generate a random 6-character code
      new_share_code := upper(substring(md5(random()::text) from 1 for 6));
      
      -- Check if this code already exists
      SELECT EXISTS(SELECT 1 FROM boards WHERE share_code = new_share_code) INTO code_exists;
      
      -- If code doesn't exist, use it
      IF NOT code_exists THEN
        NEW.share_code := new_share_code;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate share codes for new boards
DROP TRIGGER IF EXISTS generate_share_code_trigger ON boards;
CREATE TRIGGER generate_share_code_trigger
  BEFORE INSERT ON boards
  FOR EACH ROW
  EXECUTE FUNCTION generate_board_share_code();