/*
  # Fix Board Members RLS Recursion - Safe Version

  1. Problem
    - The board_members_view_same_board policy causes infinite recursion
    - Need to safely drop the policy only if the table exists

  2. Solution
    - Check if board_members table exists before dropping policy
    - Use DO block with conditional logic
    - Avoid errors if table doesn't exist yet

  3. Changes
    - Safely drop the problematic recursive policy
    - Only execute if the table exists
*/

-- Safely drop the problematic recursive policy only if the table exists
DO $$
BEGIN
  -- Check if board_members table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'board_members'
  ) THEN
    -- Drop the problematic policy if it exists
    DROP POLICY IF EXISTS "board_members_view_same_board" ON board_members;
    
    RAISE NOTICE 'Dropped problematic board_members_view_same_board policy';
  ELSE
    RAISE NOTICE 'board_members table does not exist, skipping policy drop';
  END IF;
END $$;