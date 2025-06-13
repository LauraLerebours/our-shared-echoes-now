/*
  # Fix Database Migration - Remove Non-existent Table References

  1. Changes Made
    - Remove references to non-existent board_members table
    - Ensure all policies and constraints are properly set up
    - Add missing indexes for performance
    - Clean up any orphaned policies

  2. Security
    - Maintain proper RLS policies on existing tables
    - Ensure user access controls are working correctly
*/

-- First, check if board_members table exists and drop policy only if table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'board_members') THEN
        DROP POLICY IF EXISTS "board_members_view_same_board" ON board_members;
    END IF;
END $$;

-- Ensure all existing tables have proper RLS enabled
ALTER TABLE IF EXISTS boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shared_boards ENABLE ROW LEVEL SECURITY;

-- Add missing indexes for better performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_boards_owner_member_access ON boards USING btree (owner_id, member_ids, access_code);
CREATE INDEX IF NOT EXISTS idx_memories_access_code_date ON memories USING btree (access_code, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_lookup ON user_profiles USING btree (id, name);

-- Ensure boards table has proper policies
DROP POLICY IF EXISTS "boards_simple_access" ON boards;
CREATE POLICY "boards_simple_access" ON boards
  FOR ALL TO authenticated
  USING (
    auth.uid() = owner_id OR 
    auth.uid() = ANY(member_ids)
  )
  WITH CHECK (
    auth.uid() = owner_id OR 
    auth.uid() = ANY(member_ids)
  );

-- Ensure memories table has proper policies
DROP POLICY IF EXISTS "memories_simple_access" ON memories;
CREATE POLICY "memories_simple_access" ON memories
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

-- Clean up any orphaned policies that might reference non-existent tables
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Get all policies that might reference non-existent tables
    FOR policy_record IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename NOT IN (
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        )
    LOOP
        -- This will only execute if there are policies on non-existent tables
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      policy_record.policyname, 
                      policy_record.schemaname, 
                      policy_record.tablename);
    END LOOP;
END $$;