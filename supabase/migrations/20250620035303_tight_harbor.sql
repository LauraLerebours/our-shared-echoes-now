/*
  # Fix infinite recursion in RLS policies

  1. Problem
    - Infinite recursion detected in rules for relation "memories_with_likes"
    - This is caused by circular dependencies in RLS policies between boards and memories tables

  2. Solution
    - Drop all existing problematic RLS policies on boards and memories tables
    - Create simplified, non-recursive policies that avoid circular references
    - Ensure policies are straightforward and don't reference each other in ways that create loops

  3. Changes
    - Remove all existing RLS policies on boards and memories tables
    - Add new simplified policies that prevent recursion
    - Maintain security while avoiding circular dependencies
*/

-- First, disable RLS temporarily to avoid issues during policy changes
ALTER TABLE boards DISABLE ROW LEVEL SECURITY;
ALTER TABLE memories DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies on boards table
DROP POLICY IF EXISTS "boards_access" ON boards;
DROP POLICY IF EXISTS "boards_owner_update" ON boards;
DROP POLICY IF EXISTS "boards_public_view" ON boards;

-- Drop all existing policies on memories table
DROP POLICY IF EXISTS "memories_delete" ON memories;
DROP POLICY IF EXISTS "memories_insert" ON memories;
DROP POLICY IF EXISTS "memories_select" ON memories;
DROP POLICY IF EXISTS "memories_update" ON memories;
DROP POLICY IF EXISTS "memories_update_own" ON memories;

-- Re-enable RLS
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- Create simplified board policies without circular references
CREATE POLICY "boards_owner_access" ON boards
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "boards_member_read" ON boards
  FOR SELECT TO authenticated
  USING (auth.uid() = ANY(COALESCE(member_ids, ARRAY[]::uuid[])));

CREATE POLICY "boards_public_read" ON boards
  FOR SELECT TO authenticated
  USING (is_public = true);

-- Create simplified memory policies without circular references
CREATE POLICY "memories_owner_access" ON memories
  FOR ALL TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "memories_board_member_read" ON memories
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boards b 
      WHERE b.access_code = memories.access_code 
      AND (b.owner_id = auth.uid() OR auth.uid() = ANY(COALESCE(b.member_ids, ARRAY[]::uuid[])))
    )
  );

CREATE POLICY "memories_board_member_update" ON memories
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM boards b 
      WHERE b.access_code = memories.access_code 
      AND (b.owner_id = auth.uid() OR auth.uid() = ANY(COALESCE(b.member_ids, ARRAY[]::uuid[])))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boards b 
      WHERE b.access_code = memories.access_code 
      AND (b.owner_id = auth.uid() OR auth.uid() = ANY(COALESCE(b.member_ids, ARRAY[]::uuid[])))
    )
  );

CREATE POLICY "memories_board_member_insert" ON memories
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM boards b 
      WHERE b.access_code = memories.access_code 
      AND (b.owner_id = auth.uid() OR auth.uid() = ANY(COALESCE(b.member_ids, ARRAY[]::uuid[])))
    )
  );

CREATE POLICY "memories_board_member_delete" ON memories
  FOR DELETE TO authenticated
  USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM boards b 
      WHERE b.access_code = memories.access_code 
      AND b.owner_id = auth.uid()
    )
  );