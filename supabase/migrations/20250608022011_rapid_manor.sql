/*
  # Fix Authentication and User Profile Issues

  1. Functions
    - Create uid() function for getting current user ID
    - Create user profile creation trigger function
    - Create timestamp update functions
    - Create board management functions

  2. Foreign Key Constraints
    - Fix user_profiles foreign key to auth.users
    - Fix boards foreign key to auth.users
    - Fix board_members foreign key to auth.users
    - Fix shared_boards foreign key to auth.users

  3. RLS Policies
    - Update user_profiles policies for proper access control
    - Update boards policies for member access
    - Update board_members policies for user access

  4. Security
    - Enable RLS on all tables
    - Ensure proper authentication checks
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

-- Update RLS policies for user_profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can read other profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;

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
DROP POLICY IF EXISTS "Users can view their boards and member boards" ON boards;
CREATE POLICY "Users can view their boards and member boards" ON boards
  FOR SELECT TO authenticated
  USING (
    auth.uid() = owner_id OR 
    id IN (
      SELECT board_id FROM board_members 
      WHERE user_id = auth.uid()
    )
  );

-- Update RLS policies for board_members
DROP POLICY IF EXISTS "Users can view their own memberships" ON board_members;
CREATE POLICY "Users can view their own memberships" ON board_members
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Ensure all tables have RLS enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_boards ENABLE ROW LEVEL SECURITY;