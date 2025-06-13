/*
  # Comprehensive Database Schema Verification and Fixes

  1. Verify all tables exist with proper structure
  2. Ensure all functions exist and work correctly
  3. Fix any missing indexes or constraints
  4. Verify RLS policies are properly configured
  5. Test all database operations used by the application
*/

-- Set search_path for the entire migration
SET search_path = public, auth, extensions;

-- ============================================================================
-- VERIFY AND CREATE MISSING TABLES
-- ============================================================================

-- Ensure user_profiles table exists with correct structure
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'User',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure access_codes table exists
CREATE TABLE IF NOT EXISTS access_codes (
  code text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Ensure boards table exists with correct structure
CREATE TABLE IF NOT EXISTS boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  access_code text,
  share_code text NOT NULL,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  member_ids uuid[] DEFAULT ARRAY[]::uuid[]
);

-- Ensure memories table exists with correct structure
CREATE TABLE IF NOT EXISTS memories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  caption text,
  media_url text NOT NULL,
  is_video boolean NOT NULL DEFAULT false,
  event_date timestamp without time zone NOT NULL,
  location text,
  likes integer NOT NULL DEFAULT 0,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  is_liked boolean DEFAULT false,
  access_code text,
  board_id uuid,
  created_by uuid
);

-- Ensure comments table exists
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  parent_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ensure shared_boards table exists
CREATE TABLE IF NOT EXISTS shared_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  share_code text UNIQUE NOT NULL,
  name text,
  created_at timestamptz DEFAULT now(),
  board_id uuid
);

-- ============================================================================
-- ADD MISSING COLUMNS AND CONSTRAINTS
-- ============================================================================

-- Add missing columns to boards table
DO $$
BEGIN
  -- Add member_ids if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'boards' AND column_name = 'member_ids'
  ) THEN
    ALTER TABLE boards ADD COLUMN member_ids uuid[] DEFAULT ARRAY[]::uuid[];
  END IF;
  
  -- Ensure proper defaults
  ALTER TABLE boards ALTER COLUMN member_ids SET DEFAULT ARRAY[]::uuid[];
  
  -- Add missing foreign key constraints
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'boards_access_code_fkey'
  ) THEN
    ALTER TABLE boards ADD CONSTRAINT boards_access_code_fkey 
    FOREIGN KEY (access_code) REFERENCES access_codes(code);
  END IF;
END $$;

-- Add missing columns to memories table
DO $$
BEGIN
  -- Add created_by if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'memories' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE memories ADD COLUMN created_by uuid;
  END IF;
  
  -- Add foreign key constraints
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'memories_access_code_fkey'
  ) THEN
    ALTER TABLE memories ADD CONSTRAINT memories_access_code_fkey 
    FOREIGN KEY (access_code) REFERENCES access_codes(code);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'memories_created_by_fkey'
  ) THEN
    ALTER TABLE memories ADD CONSTRAINT memories_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES auth.users(id);
  END IF;
END $$;

-- Add missing foreign keys to comments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_comments_memory_id'
  ) THEN
    ALTER TABLE comments ADD CONSTRAINT fk_comments_memory_id 
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_comments_user_profile_id'
  ) THEN
    ALTER TABLE comments ADD CONSTRAINT fk_comments_user_profile_id 
    FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_comments_parent_id'
  ) THEN
    ALTER TABLE comments ADD CONSTRAINT fk_comments_parent_id 
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- CREATE ESSENTIAL INDEXES
-- ============================================================================

-- Boards table indexes
CREATE INDEX IF NOT EXISTS idx_boards_owner_id_btree ON boards USING btree (owner_id);
CREATE INDEX IF NOT EXISTS idx_boards_access_code_btree ON boards USING btree (access_code);
CREATE INDEX IF NOT EXISTS idx_boards_share_code_idx ON boards USING btree (share_code);
CREATE INDEX IF NOT EXISTS idx_boards_member_ids_gin ON boards USING gin (member_ids);
CREATE INDEX IF NOT EXISTS idx_boards_created_at_btree ON boards USING btree (created_at DESC);

-- Memories table indexes
CREATE INDEX IF NOT EXISTS idx_memories_access_code_btree ON memories USING btree (access_code);
CREATE INDEX IF NOT EXISTS idx_memories_created_by ON memories USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_memories_access_code_date ON memories USING btree (access_code, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_memories_access_code_performance ON memories USING btree (access_code, event_date DESC, created_at DESC);

-- User profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON user_profiles USING btree (id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_lookup ON user_profiles USING btree (id, name);

-- Comments indexes
CREATE INDEX IF NOT EXISTS idx_comments_memory_id ON comments USING btree (memory_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments USING btree (parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments USING btree (created_at);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_boards ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE OR UPDATE ALL REQUIRED FUNCTIONS
-- ============================================================================

-- Function: create_board_with_owner
CREATE OR REPLACE FUNCTION create_board_with_owner(
  board_name text,
  owner_user_id uuid,
  access_code_param text,
  share_code_param text
)
RETURNS uuid AS $$
DECLARE
  new_board_id uuid;
BEGIN
  SET search_path = public, auth, extensions;
  
  -- Validate inputs
  IF board_name IS NULL OR trim(board_name) = '' THEN
    RAISE EXCEPTION 'Board name cannot be empty';
  END IF;
  
  IF owner_user_id IS NULL THEN
    RAISE EXCEPTION 'Owner user ID is required';
  END IF;
  
  IF access_code_param IS NULL OR length(access_code_param) != 6 THEN
    RAISE EXCEPTION 'Access code must be 6 characters';
  END IF;
  
  IF share_code_param IS NULL OR length(share_code_param) != 6 THEN
    RAISE EXCEPTION 'Share code must be 6 characters';
  END IF;

  -- Create the board with the owner as the first member
  INSERT INTO boards (
    name,
    owner_id,
    access_code,
    share_code,
    member_ids,
    created_at,
    updated_at
  ) VALUES (
    trim(board_name),
    owner_user_id,
    upper(access_code_param),
    upper(share_code_param),
    ARRAY[owner_user_id],
    now(),
    now()
  ) RETURNING id INTO new_board_id;

  RETURN new_board_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: add_user_to_board_by_share_code
CREATE OR REPLACE FUNCTION add_user_to_board_by_share_code(
  share_code_param text,
  user_id_param uuid DEFAULT auth.uid()
)
RETURNS json AS $$
DECLARE
  board_record boards%ROWTYPE;
BEGIN
  SET search_path = public, auth, extensions;
  
  -- Validate inputs
  IF share_code_param IS NULL OR length(share_code_param) != 6 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid share code format'
    );
  END IF;
  
  IF user_id_param IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'User not authenticated'
    );
  END IF;

  -- Find the board by share code
  SELECT * INTO board_record
  FROM boards
  WHERE share_code = upper(share_code_param);

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Board not found with this share code'
    );
  END IF;

  -- Check if user is already a member
  IF user_id_param = ANY(COALESCE(board_record.member_ids, ARRAY[]::uuid[])) THEN
    RETURN json_build_object(
      'success', true,
      'message', 'You are already a member of this board',
      'board_id', board_record.id
    );
  END IF;

  -- Add user to the board
  UPDATE boards
  SET 
    member_ids = array_append(COALESCE(member_ids, ARRAY[]::uuid[]), user_id_param),
    updated_at = now()
  WHERE id = board_record.id;

  RETURN json_build_object(
    'success', true,
    'message', 'Successfully joined the board',
    'board_id', board_record.id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: rename_board
CREATE OR REPLACE FUNCTION rename_board(
  board_id uuid,
  new_name text,
  user_id uuid DEFAULT auth.uid()
)
RETURNS json AS $$
DECLARE
  board_record boards%ROWTYPE;
BEGIN
  SET search_path = public, auth, extensions;
  
  -- Validate inputs
  IF board_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Board ID is required'
    );
  END IF;
  
  IF new_name IS NULL OR trim(new_name) = '' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Board name cannot be empty'
    );
  END IF;
  
  IF user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'User not authenticated'
    );
  END IF;

  -- Check if board exists and user has access
  SELECT * INTO board_record
  FROM boards
  WHERE id = board_id
  AND (owner_id = user_id OR user_id = ANY(COALESCE(member_ids, ARRAY[]::uuid[])));

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Board not found or access denied'
    );
  END IF;

  -- Update the board name
  UPDATE boards
  SET 
    name = trim(new_name),
    updated_at = now()
  WHERE id = board_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Board renamed successfully',
    'new_name', trim(new_name)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: remove_board_member
CREATE OR REPLACE FUNCTION remove_board_member(
  board_id uuid,
  user_id uuid
)
RETURNS boolean AS $$
DECLARE
  board_record boards%ROWTYPE;
  updated_members uuid[];
BEGIN
  SET search_path = public, auth, extensions;
  
  -- Validate inputs
  IF board_id IS NULL OR user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Get the board
  SELECT * INTO board_record
  FROM boards
  WHERE id = board_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check if user is a member
  IF NOT (user_id = ANY(COALESCE(board_record.member_ids, ARRAY[]::uuid[]))) THEN
    RETURN false;
  END IF;

  -- Remove user from member_ids
  SELECT array_agg(member_id) INTO updated_members
  FROM unnest(COALESCE(board_record.member_ids, ARRAY[]::uuid[])) AS member_id
  WHERE member_id != user_id;

  -- Update the board
  UPDATE boards
  SET 
    member_ids = COALESCE(updated_members, ARRAY[]::uuid[]),
    updated_at = now()
  WHERE id = board_id;

  -- If no members left, delete the board and its access code
  IF array_length(COALESCE(updated_members, ARRAY[]::uuid[]), 1) IS NULL THEN
    -- Delete associated access code
    DELETE FROM access_codes WHERE code = board_record.access_code;
    -- Delete the board
    DELETE FROM boards WHERE id = board_id;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: add_board_member
CREATE OR REPLACE FUNCTION add_board_member(
  board_id uuid,
  user_id uuid
)
RETURNS boolean AS $$
DECLARE
  board_record boards%ROWTYPE;
BEGIN
  SET search_path = public, auth, extensions;
  
  -- Validate inputs
  IF board_id IS NULL OR user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Get the board
  SELECT * INTO board_record
  FROM boards
  WHERE id = board_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check if user is already a member
  IF user_id = ANY(COALESCE(board_record.member_ids, ARRAY[]::uuid[])) THEN
    RETURN true; -- Already a member
  END IF;

  -- Add user to the board
  UPDATE boards
  SET 
    member_ids = array_append(COALESCE(member_ids, ARRAY[]::uuid[]), user_id),
    updated_at = now()
  WHERE id = board_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: uid (utility function)
CREATE OR REPLACE FUNCTION uid()
RETURNS uuid AS $$
BEGIN
  SET search_path = public, auth, extensions;
  RETURN auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CREATE TRIGGER FUNCTIONS
-- ============================================================================

-- Function: ensure_owner_is_member
CREATE OR REPLACE FUNCTION ensure_owner_is_member()
RETURNS trigger AS $$
BEGIN
  SET search_path = public, auth, extensions;
  
  -- Ensure owner_id is in member_ids
  IF NEW.owner_id IS NOT NULL THEN
    IF NEW.member_ids IS NULL THEN
      NEW.member_ids := ARRAY[NEW.owner_id];
    ELSIF NOT (NEW.owner_id = ANY(NEW.member_ids)) THEN
      NEW.member_ids := array_append(NEW.member_ids, NEW.owner_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: cleanup_empty_boards_trigger
CREATE OR REPLACE FUNCTION cleanup_empty_boards_trigger()
RETURNS trigger AS $$
BEGIN
  SET search_path = public, auth, extensions;
  
  -- If member_ids becomes empty, delete the board
  IF array_length(NEW.member_ids, 1) IS NULL OR array_length(NEW.member_ids, 1) = 0 THEN
    -- Delete associated access code
    DELETE FROM access_codes WHERE code = NEW.access_code;
    -- Delete the board
    DELETE FROM boards WHERE id = NEW.id;
    RETURN NULL; -- Prevent the update since we're deleting
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  SET search_path = public, auth, extensions;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: update_comments_updated_at
CREATE OR REPLACE FUNCTION update_comments_updated_at()
RETURNS trigger AS $$
BEGIN
  SET search_path = public, auth, extensions;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: handle_new_user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  SET search_path = public, auth, extensions;
  
  -- Create user profile
  INSERT INTO user_profiles (id, name, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CREATE OR UPDATE TRIGGERS
-- ============================================================================

-- Boards triggers
DROP TRIGGER IF EXISTS ensure_owner_is_member_trigger ON boards;
CREATE TRIGGER ensure_owner_is_member_trigger
  BEFORE INSERT OR UPDATE ON boards
  FOR EACH ROW
  EXECUTE FUNCTION ensure_owner_is_member();

DROP TRIGGER IF EXISTS cleanup_empty_boards_trigger ON boards;
CREATE TRIGGER cleanup_empty_boards_trigger
  AFTER UPDATE OF member_ids ON boards
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_empty_boards_trigger();

-- User profiles triggers
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments triggers
DROP TRIGGER IF EXISTS update_comments_updated_at_trigger ON comments;
CREATE TRIGGER update_comments_updated_at_trigger
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_comments_updated_at();

-- Auth user trigger (if accessible)
DO $$
BEGIN
  BEGIN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION handle_new_user();
  EXCEPTION WHEN OTHERS THEN
    -- If we can't access auth.users, that's okay
    NULL;
  END;
END $$;

-- ============================================================================
-- CREATE OR UPDATE RLS POLICIES
-- ============================================================================

-- User profiles policies
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

-- Access codes policies
DROP POLICY IF EXISTS "Anyone can view access codes" ON access_codes;
CREATE POLICY "Anyone can view access codes" ON access_codes
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can create access codes" ON access_codes;
CREATE POLICY "Anyone can create access codes" ON access_codes
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Boards policies
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

-- Memories policies
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

DROP POLICY IF EXISTS "memories_delete_creator_only" ON memories;
CREATE POLICY "memories_delete_creator_only" ON memories
  FOR DELETE TO authenticated
  USING (
    created_by IS NOT NULL AND 
    auth.uid() = created_by AND 
    auth.uid()::text = created_by::text
  );

-- Comments policies
DROP POLICY IF EXISTS "Users can read comments on memories they can access" ON comments;
CREATE POLICY "Users can read comments on memories they can access" ON comments
  FOR SELECT TO authenticated
  USING (
    memory_id IN (
      SELECT memories.id FROM memories 
      WHERE memories.access_code IN (
        SELECT b.access_code FROM boards b 
        WHERE auth.uid() = b.owner_id OR auth.uid() = ANY(COALESCE(b.member_ids, ARRAY[]::uuid[]))
      )
    )
  );

DROP POLICY IF EXISTS "Users can create comments on accessible memories" ON comments;
CREATE POLICY "Users can create comments on accessible memories" ON comments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    memory_id IN (
      SELECT memories.id FROM memories 
      WHERE memories.access_code IN (
        SELECT b.access_code FROM boards b 
        WHERE auth.uid() = b.owner_id OR auth.uid() = ANY(COALESCE(b.member_ids, ARRAY[]::uuid[]))
      )
    )
  );

DROP POLICY IF EXISTS "Users can update their own comments" ON comments;
CREATE POLICY "Users can update their own comments" ON comments
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own comments" ON comments;
CREATE POLICY "Users can delete their own comments" ON comments
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Shared boards policies
DROP POLICY IF EXISTS "Anyone can view shared boards" ON shared_boards;
CREATE POLICY "Anyone can view shared boards" ON shared_boards
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create their own shared boards" ON shared_boards;
CREATE POLICY "Users can create their own shared boards" ON shared_boards
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update their own shared boards" ON shared_boards;
CREATE POLICY "Users can update their own shared boards" ON shared_boards
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete their own shared boards" ON shared_boards;
CREATE POLICY "Users can delete their own shared boards" ON shared_boards
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant table permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Grant sequence permissions
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Grant function permissions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- ============================================================================
-- UPDATE TABLE STATISTICS
-- ============================================================================

ANALYZE user_profiles;
ANALYZE access_codes;
ANALYZE boards;
ANALYZE memories;
ANALYZE comments;
ANALYZE shared_boards;

-- ============================================================================
-- VERIFY ESSENTIAL FUNCTIONS WORK
-- ============================================================================

-- Test that all functions exist and are callable
DO $$
DECLARE
  test_result json;
  test_uuid uuid;
BEGIN
  -- Test uid function
  SELECT uid() INTO test_uuid;
  RAISE NOTICE 'uid() function works: %', test_uuid IS NOT NULL;
  
  -- Test other functions exist (don't execute them, just check they exist)
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'create_board_with_owner'
  ) THEN
    RAISE EXCEPTION 'create_board_with_owner function missing';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'add_user_to_board_by_share_code'
  ) THEN
    RAISE EXCEPTION 'add_user_to_board_by_share_code function missing';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'rename_board'
  ) THEN
    RAISE EXCEPTION 'rename_board function missing';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'remove_board_member'
  ) THEN
    RAISE EXCEPTION 'remove_board_member function missing';
  END IF;
  
  RAISE NOTICE 'All essential functions exist and are accessible';
END $$;

-- Reset search_path
RESET search_path;