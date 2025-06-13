/*
  # Fix Board Loading Timeout with Simplified RLS Policies

  1. Problem
    - Board queries are timing out due to complex RLS policies with circular dependencies
    - Current policies use complex subqueries that cause performance issues
    - The `boards` table has circular dependencies with other tables

  2. Solution
    - Drop existing complex RLS policies on boards table
    - Implement simplified policies as suggested in IMPROVEMENTS.md
    - Remove circular dependencies to improve query performance
    - Use direct array membership checks instead of complex joins

  3. Changes
    - Drop all existing policies on boards table
    - Create new simplified `boards_access` policy
    - Ensure owner and member access without complex subqueries
*/

-- Drop all existing policies on boards table to start fresh
DROP POLICY IF EXISTS "boards_create_access" ON boards;
DROP POLICY IF EXISTS "boards_member_read_access" ON boards;
DROP POLICY IF EXISTS "boards_owner_full_access" ON boards;

-- Create simplified board access policy as suggested in IMPROVEMENTS.md
CREATE POLICY "boards_access" ON boards
  FOR ALL TO authenticated
  USING (
    auth.uid() = owner_id OR 
    auth.uid() = ANY(member_ids)
  )
  WITH CHECK (
    auth.uid() = owner_id OR 
    auth.uid() = ANY(member_ids)
  );

-- Also simplify memory policies to remove circular dependencies
DROP POLICY IF EXISTS "Users can read all memories" ON memories;
DROP POLICY IF EXISTS "Users can create memories" ON memories;
DROP POLICY IF EXISTS "Users can fully update their own memories" ON memories;
DROP POLICY IF EXISTS "Users can delete their own memories" ON memories;
DROP POLICY IF EXISTS "Users can update memory likes" ON memories;

-- Create simplified memory policies
CREATE POLICY "memories_access" ON memories
  FOR ALL TO authenticated
  USING (
    access_code IN (
      SELECT access_code FROM boards 
      WHERE auth.uid() = owner_id OR auth.uid() = ANY(member_ids)
    )
  )
  WITH CHECK (
    access_code IN (
      SELECT access_code FROM boards 
      WHERE auth.uid() = owner_id OR auth.uid() = ANY(member_ids)
    )
  );

-- Separate policy for memory creators to manage their own memories
CREATE POLICY "memories_creator_access" ON memories
  FOR ALL TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Add index to improve performance of the array membership check
CREATE INDEX IF NOT EXISTS idx_boards_member_ids_gin ON boards USING gin(member_ids);

-- Add index to improve access_code lookups
CREATE INDEX IF NOT EXISTS idx_boards_access_code_btree ON boards USING btree(access_code);