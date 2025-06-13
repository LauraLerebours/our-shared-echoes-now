/*
  # Database Optimization and Board Access Fix

  1. Database Structure
    - Ensure all tables have proper RLS enabled
    - Add missing indexes for performance
    - Fix board member access patterns

  2. Performance Improvements
    - Add optimized indexes for common queries
    - Ensure proper foreign key constraints
    - Clean up any orphaned policies

  3. Security
    - Recreate essential RLS policies without circular dependencies
    - Ensure proper user access controls
    - Grant necessary permissions
*/

-- First, ensure all tables have RLS enabled
ALTER TABLE IF EXISTS user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shared_boards ENABLE ROW LEVEL SECURITY;

-- Add missing indexes for better performance
CREATE INDEX IF NOT EXISTS idx_boards_owner_member_lookup 
ON boards USING btree (owner_id, member_ids);

CREATE INDEX IF NOT EXISTS idx_memories_access_code_performance 
ON memories USING btree (access_code, event_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_profiles_performance 
ON user_profiles USING btree (id, name);

-- Add GIN index for array operations on member_ids
CREATE INDEX IF NOT EXISTS idx_boards_member_ids_gin 
ON boards USING gin (member_ids);

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_boards_access_lookup 
ON boards USING btree (owner_id, access_code, share_code);

CREATE INDEX IF NOT EXISTS idx_memories_user_access 
ON memories USING btree (access_code, created_by, event_date DESC);

-- Ensure boards table has proper structure
DO $$
BEGIN
  -- Add member_ids column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'boards' AND column_name = 'member_ids'
  ) THEN
    ALTER TABLE boards ADD COLUMN member_ids uuid[] DEFAULT ARRAY[]::uuid[];
  END IF;
  
  -- Ensure member_ids has proper default
  ALTER TABLE boards ALTER COLUMN member_ids SET DEFAULT ARRAY[]::uuid[];
  
  -- Ensure access_code is not null
  UPDATE boards SET access_code = upper(substring(md5(random()::text) from 1 for 6)) 
  WHERE access_code IS NULL;
  
  -- Ensure share_code is not null
  UPDATE boards SET share_code = upper(substring(md5(random()::text) from 1 for 6)) 
  WHERE share_code IS NULL;
END $$;

-- Clean up any policies that might reference non-existent tables
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  -- Get all policies that might reference board_members
  FOR policy_record IN 
    SELECT schemaname, tablename, policyname 
    FROM pg_policies 
    WHERE policyname LIKE '%board_members%' OR policyname LIKE '%member%'
  LOOP
    -- Try to drop each policy safely
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
        policy_record.policyname, 
        policy_record.schemaname, 
        policy_record.tablename);
    EXCEPTION WHEN OTHERS THEN
      -- Ignore errors for policies that don't exist
      NULL;
    END;
  END LOOP;
END $$;

-- Recreate essential policies for boards with better performance
DROP POLICY IF EXISTS "boards_simple_access" ON boards;
CREATE POLICY "boards_simple_access" ON boards
  FOR ALL TO authenticated
  USING (
    auth.uid() = owner_id OR 
    auth.uid() = ANY(COALESCE(member_ids, ARRAY[]::uuid[]))
  )
  WITH CHECK (
    auth.uid() = owner_id OR 
    auth.uid() = ANY(COALESCE(member_ids, ARRAY[]::uuid[]))
  );

-- Recreate essential policies for memories
DROP POLICY IF EXISTS "memories_simple_access" ON memories;
CREATE POLICY "memories_simple_access" ON memories
  FOR ALL TO authenticated
  USING (
    access_code IN (
      SELECT b.access_code FROM boards b 
      WHERE auth.uid() = b.owner_id OR auth.uid() = ANY(COALESCE(b.member_ids, ARRAY[]::uuid[]))
    )
  )
  WITH CHECK (
    access_code IN (
      SELECT b.access_code FROM boards b 
      WHERE auth.uid() = b.owner_id OR auth.uid() = ANY(COALESCE(b.member_ids, ARRAY[]::uuid[]))
    )
  );

-- Ensure user_profiles policies are correct
DROP POLICY IF EXISTS "Users can read other profiles" ON user_profiles;
CREATE POLICY "Users can read other profiles" ON user_profiles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ensure access_codes policies are correct
DROP POLICY IF EXISTS "Anyone can view access codes" ON access_codes;
CREATE POLICY "Anyone can view access codes" ON access_codes
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can create access codes" ON access_codes;
CREATE POLICY "Anyone can create access codes" ON access_codes
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Add performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_boards_member_search 
ON boards USING gin (member_ids);

CREATE INDEX IF NOT EXISTS idx_memories_created_by_lookup 
ON memories USING btree (created_by, access_code);

CREATE INDEX IF NOT EXISTS idx_comments_memory_user 
ON comments USING btree (memory_id, user_id);

-- Add indexes for RLS policy performance
CREATE INDEX IF NOT EXISTS idx_boards_rls_lookup 
ON boards USING btree (owner_id) INCLUDE (access_code, member_ids);

CREATE INDEX IF NOT EXISTS idx_memories_rls_lookup 
ON memories USING btree (access_code) INCLUDE (created_by, event_date);

-- Ensure all foreign key constraints are properly set up
DO $$
BEGIN
  -- Add foreign key for memories.created_by if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'memories_created_by_fkey'
  ) THEN
    BEGIN
      ALTER TABLE memories 
      ADD CONSTRAINT memories_created_by_fkey 
      FOREIGN KEY (created_by) REFERENCES auth.users(id);
    EXCEPTION WHEN OTHERS THEN
      -- If auth.users doesn't exist, reference user_profiles instead
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'memories_created_by_user_profiles_fkey'
      ) THEN
        ALTER TABLE memories 
        ADD CONSTRAINT memories_created_by_user_profiles_fkey 
        FOREIGN KEY (created_by) REFERENCES user_profiles(id);
      END IF;
    END;
  END IF;
END $$;

-- Create a function to clean up empty boards (if it doesn't exist)
CREATE OR REPLACE FUNCTION cleanup_empty_boards()
RETURNS void AS $$
BEGIN
  DELETE FROM boards 
  WHERE array_length(member_ids, 1) IS NULL OR array_length(member_ids, 1) = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to validate board access
CREATE OR REPLACE FUNCTION user_has_board_access(board_id uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM boards 
    WHERE id = board_id 
    AND (owner_id = user_id OR user_id = ANY(COALESCE(member_ids, ARRAY[]::uuid[])))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Update table statistics for better query planning
ANALYZE boards;
ANALYZE memories;
ANALYZE user_profiles;
ANALYZE access_codes;
ANALYZE comments;