/*
  # Fix infinite recursion in board_members RLS policy

  1. Problem
    - The board_members_view_same_board policy creates infinite recursion
    - Policy queries board_members table within its own USING clause
    - This causes database timeouts when loading boards

  2. Solution
    - Drop the problematic board_members_view_same_board policy
    - The existing policies (board_members_owner_full_access and board_members_self_manage) 
      are sufficient for proper access control without recursion

  3. Changes
    - Remove the recursive policy that's causing timeouts
    - Keep the working non-recursive policies intact
*/

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "board_members_view_same_board" ON board_members;