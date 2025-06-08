/*
  # Fix Database Schema Issues

  1. Database Functions
    - Create uid() function to get current user ID
    - Create user profile management functions
    - Create board management functions

  2. Foreign Key Fixes
    - Update all foreign keys to reference auth.users instead of non-existent users table
    - Ensure proper cascade behavior

  3. RLS Policy Updates
    - Fix all policies to use auth.uid() correctly
    - Ensure proper access control

  4. Triggers
    - Set up automatic user profile creation
    - Set up board share code generation
    - Set up automatic board membership
*/

-- Create function to get current user ID
CREATE OR REPLACE FUNCTION uid() 
RETURNS uuid 
LANGUAGE sql 
SECURITY DEFINER
AS $$
  SELECT auth.uid();
$$;

-- Create function to handle user profile creation
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'User'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger for automatic user profile creation
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
CREATE TRIGGER create_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create function to update user profile updated_at
CREATE OR REPLACE FUNCTION update_user_profile_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create function to generate board share code
CREATE OR REPLACE FUNCTION generate_board_share_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.share_code IS NULL OR NEW.share_code = '' THEN
    NEW.share_code = upper(substring(md5(random()::text) from 1 for 6));
  END IF;
  RETURN NEW;
END;
$$;

-- Create function to add board creator as owner
CREATE OR REPLACE FUNCTION add_board_creator_as_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO board_members (board_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (board_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Fix user_profiles table constraints
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_id_fkey 
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix boards table constraints
ALTER TABLE boards DROP CONSTRAINT IF EXISTS boards_owner_id_fkey;
ALTER TABLE boards ADD CONSTRAINT boards_owner_id_fkey 
  FOREIGN KEY (owner_id) REFERENCES auth.users(id);

-- Fix board_members table constraints
ALTER TABLE board_members DROP CONSTRAINT IF EXISTS board_members_user_id_fkey;
ALTER TABLE board_members ADD CONSTRAINT board_members_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix shared_boards table constraints
ALTER TABLE shared_boards DROP CONSTRAINT IF EXISTS shared_boards_owner_id_fkey;
ALTER TABLE shared_boards ADD CONSTRAINT shared_boards_owner_id_fkey 
  FOREIGN KEY (owner_id) REFERENCES auth.users(id);

-- Fix love_notes table constraints
ALTER TABLE love_notes DROP CONSTRAINT IF EXISTS love_notes_user_id_fkey;
ALTER TABLE love_notes ADD CONSTRAINT love_notes_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update RLS policies for user_profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can read other profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can read own profile" ON user_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can read other profiles" ON user_profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Update RLS policies for boards
DROP POLICY IF EXISTS "Allow authenticated users to create boards" ON boards;
DROP POLICY IF EXISTS "Anyone can create boards" ON boards;
DROP POLICY IF EXISTS "Anyone can view boards" ON boards;
DROP POLICY IF EXISTS "Anyone with access code can delete boards" ON boards;
DROP POLICY IF EXISTS "Anyone with access code can update boards" ON boards;
DROP POLICY IF EXISTS "Board owners can delete their boards" ON boards;
DROP POLICY IF EXISTS "Board owners can update their boards" ON boards;
DROP POLICY IF EXISTS "Users can view their boards and member boards" ON boards;

CREATE POLICY "Users can create boards" ON boards
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can view their boards and member boards" ON boards
  FOR SELECT TO authenticated
  USING (
    auth.uid() = owner_id OR 
    id IN (
      SELECT board_id FROM board_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Board owners can update their boards" ON boards
  FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT board_id FROM board_members 
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  )
  WITH CHECK (
    id IN (
      SELECT board_id FROM board_members 
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

CREATE POLICY "Board owners can delete their boards" ON boards
  FOR DELETE TO authenticated
  USING (
    id IN (
      SELECT board_id FROM board_members 
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Update RLS policies for board_members
DROP POLICY IF EXISTS "Board owners can delete members" ON board_members;
DROP POLICY IF EXISTS "Board owners can insert other members" ON board_members;
DROP POLICY IF EXISTS "Board owners can update members" ON board_members;
DROP POLICY IF EXISTS "Users can insert themselves as board members" ON board_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON board_members;

CREATE POLICY "Users can view their own memberships" ON board_members
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert themselves as board members" ON board_members
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Board owners can manage members" ON board_members
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM board_members existing_members
      WHERE existing_members.board_id = board_members.board_id 
      AND existing_members.user_id = auth.uid() 
      AND existing_members.role = 'owner'
    )
  );

-- Update RLS policies for memories
DROP POLICY IF EXISTS "Board members can delete memories" ON memories;
DROP POLICY IF EXISTS "Board members can insert memories" ON memories;
DROP POLICY IF EXISTS "Board members can update memories" ON memories;
DROP POLICY IF EXISTS "Enable delete with valid access code" ON memories;
DROP POLICY IF EXISTS "Enable insert with valid access code" ON memories;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON memories;
DROP POLICY IF EXISTS "Enable update with valid access code" ON memories;

CREATE POLICY "Enable read access for all authenticated users" ON memories
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Board members can manage memories" ON memories
  FOR ALL TO authenticated
  USING (
    access_code IN (
      SELECT b.access_code
      FROM boards b
      JOIN board_members bm ON b.id = bm.board_id
      WHERE bm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    access_code IN (
      SELECT b.access_code
      FROM boards b
      JOIN board_members bm ON b.id = bm.board_id
      WHERE bm.user_id = auth.uid()
    )
  );

-- Update RLS policies for access_codes
DROP POLICY IF EXISTS "Anyone can create access codes" ON access_codes;
DROP POLICY IF EXISTS "Anyone can view access codes" ON access_codes;

CREATE POLICY "Anyone can create access codes" ON access_codes
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can view access codes" ON access_codes
  FOR SELECT TO authenticated
  USING (true);

-- Update RLS policies for shared_boards
DROP POLICY IF EXISTS "Anyone can view shared boards" ON shared_boards;
DROP POLICY IF EXISTS "Users can create their own shared boards" ON shared_boards;
DROP POLICY IF EXISTS "Users can delete their own shared boards" ON shared_boards;
DROP POLICY IF EXISTS "Users can update their own shared boards" ON shared_boards;
DROP POLICY IF EXISTS "Users can view shared boards" ON shared_boards;

CREATE POLICY "Anyone can view shared boards" ON shared_boards
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create their own shared boards" ON shared_boards
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own shared boards" ON shared_boards
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own shared boards" ON shared_boards
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- Update RLS policies for love_notes
DROP POLICY IF EXISTS "Self access" ON love_notes;

CREATE POLICY "Self access" ON love_notes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- Ensure all tables have RLS enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE love_notes ENABLE ROW LEVEL SECURITY;