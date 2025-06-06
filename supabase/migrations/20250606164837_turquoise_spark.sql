/*
  # Add board_id to shared_boards table

  1. Schema Changes
    - Add `board_id` column to `shared_boards` table
    - Add foreign key constraint to reference `boards` table
    - Add index for better query performance

  2. Data Migration
    - This migration assumes existing shared_boards data needs to be handled
    - New shared boards will properly reference specific boards

  3. Security
    - Maintain existing RLS policies
    - Ensure proper foreign key relationships
*/

-- Add board_id column to shared_boards table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shared_boards' AND column_name = 'board_id'
  ) THEN
    ALTER TABLE shared_boards ADD COLUMN board_id uuid;
  END IF;
END $$;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'shared_boards_board_id_fkey'
  ) THEN
    ALTER TABLE shared_boards 
    ADD CONSTRAINT shared_boards_board_id_fkey 
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add index for better query performance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'shared_boards_board_id_idx'
  ) THEN
    CREATE INDEX shared_boards_board_id_idx ON shared_boards(board_id);
  END IF;
END $$;