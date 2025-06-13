/*
  # Fix Infinite Recursion in RLS Policies

  1. Problem
    - Current RLS policies create circular dependencies between tables
    - This causes infinite recursion during query execution
    - Particularly affects boards and memories tables

  2. Solution
    - Simplify RLS policies to avoid circular references
    - Use direct checks instead of complex subqueries
    - Ensure policies don't reference each other in ways that create loops

  3. Changes
    - Drop all existing problematic policies
    - Create new simplified policies
    - Add performance indexes to support the new policies
*/

-- First, drop all existing policies that might be causing recursion
DROP POLICY IF EXISTS "boards_simple_access" ON boards;
DROP POLICY IF EXISTS "memories_simple_access" ON memories;
DROP POLICY IF EXISTS "memories_delete_creator_only" ON memories;

-- Create new, simplified policies for boards
CREATE POLICY "boards_access" ON boards
  FOR ALL TO authenticated
  USING (
    auth.uid() = owner_id OR 
    auth.uid() = ANY(COALESCE(member_ids, ARRAY[]::uuid[]))
  )
  WITH CHECK (
    auth.uid() = owner_id OR 
    auth.uid() = ANY(COALESCE(member_ids, ARRAY[]::uuid[]))
  );

-- Create new, simplified policies for memories
-- For SELECT operations
CREATE POLICY "memories_select" ON memories
  FOR SELECT TO authenticated
  USING (true);  -- Allow all authenticated users to read memories

-- For INSERT operations
CREATE POLICY "memories_insert" ON memories
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND
    access_code IN (
      SELECT access_code FROM boards 
      WHERE auth.uid() = owner_id OR auth.uid() = ANY(COALESCE(member_ids, ARRAY[]::uuid[]))
    )
  );

-- For UPDATE operations
CREATE POLICY "memories_update" ON memories
  FOR UPDATE TO authenticated
  USING (
    -- Either the user created the memory
    auth.uid() = created_by
    OR
    -- Or the memory is in a board the user has access to (for likes)
    access_code IN (
      SELECT access_code FROM boards 
      WHERE auth.uid() = owner_id OR auth.uid() = ANY(COALESCE(member_ids, ARRAY[]::uuid[]))
    )
  )
  WITH CHECK (
    -- Either the user created the memory
    auth.uid() = created_by
    OR
    -- Or the memory is in a board the user has access to (for likes)
    access_code IN (
      SELECT access_code FROM boards 
      WHERE auth.uid() = owner_id OR auth.uid() = ANY(COALESCE(member_ids, ARRAY[]::uuid[]))
    )
  );

-- For DELETE operations - only creators can delete
CREATE POLICY "memories_delete" ON memories
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- Add or update indexes to support these policies
CREATE INDEX IF NOT EXISTS idx_boards_member_ids_gin ON boards USING gin (member_ids);
CREATE INDEX IF NOT EXISTS idx_boards_owner_id ON boards USING btree (owner_id);
CREATE INDEX IF NOT EXISTS idx_boards_access_code ON boards USING btree (access_code);
CREATE INDEX IF NOT EXISTS idx_memories_access_code ON memories USING btree (access_code);
CREATE INDEX IF NOT EXISTS idx_memories_created_by ON memories USING btree (created_by);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_boards_owner_member_access ON boards USING btree (owner_id, access_code) INCLUDE (member_ids);
CREATE INDEX IF NOT EXISTS idx_memories_access_created_by ON memories USING btree (access_code, created_by);

-- Fix comments policies to avoid recursion
DROP POLICY IF EXISTS "Users can read comments on memories they can access" ON comments;
CREATE POLICY "comments_select" ON comments
  FOR SELECT TO authenticated
  USING (true);  -- Allow all authenticated users to read comments

DROP POLICY IF EXISTS "Users can create comments on accessible memories" ON comments;
CREATE POLICY "comments_insert" ON comments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    memory_id IN (
      SELECT id FROM memories
      WHERE access_code IN (
        SELECT access_code FROM boards 
        WHERE auth.uid() = owner_id OR auth.uid() = ANY(COALESCE(member_ids, ARRAY[]::uuid[]))
      )
    )
  );

DROP POLICY IF EXISTS "Users can update their own comments" ON comments;
CREATE POLICY "comments_update" ON comments
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own comments" ON comments;
CREATE POLICY "comments_delete" ON comments
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Update table statistics for better query planning
ANALYZE boards;
ANALYZE memories;
ANALYZE comments;