/*
  # Update Supabase Functions with Search Path

  1. Function Updates
    - Set search_path for all existing functions
    - Ensure proper schema resolution
    - Add SECURITY DEFINER where appropriate
    - Improve function reliability and performance

  2. Security
    - Maintain existing RLS policies
    - Ensure functions run with proper permissions
    - Add input validation where needed

  3. Performance
    - Optimize function execution
    - Add proper error handling
    - Ensure consistent behavior
*/

-- Set search_path for the session
SET search_path = public, auth, extensions;

-- Update create_board_with_owner function
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
  -- Set search path for this function
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
  INSERT INTO public.boards (
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

-- Update add_user_to_board_by_share_code function
CREATE OR REPLACE FUNCTION add_user_to_board_by_share_code(
  share_code_param text,
  user_id_param uuid DEFAULT auth.uid()
)
RETURNS json AS $$
DECLARE
  board_record public.boards%ROWTYPE;
  result json;
BEGIN
  -- Set search path for this function
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
  FROM public.boards
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
  UPDATE public.boards
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

-- Update rename_board function
CREATE OR REPLACE FUNCTION rename_board(
  board_id uuid,
  new_name text,
  user_id uuid DEFAULT auth.uid()
)
RETURNS json AS $$
DECLARE
  board_record public.boards%ROWTYPE;
BEGIN
  -- Set search path for this function
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
  FROM public.boards
  WHERE id = board_id
  AND (owner_id = user_id OR user_id = ANY(COALESCE(member_ids, ARRAY[]::uuid[])));

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Board not found or access denied'
    );
  END IF;

  -- Update the board name
  UPDATE public.boards
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

-- Update remove_board_member function
CREATE OR REPLACE FUNCTION remove_board_member(
  board_id uuid,
  user_id uuid
)
RETURNS boolean AS $$
DECLARE
  board_record public.boards%ROWTYPE;
  updated_members uuid[];
BEGIN
  -- Set search path for this function
  SET search_path = public, auth, extensions;
  
  -- Validate inputs
  IF board_id IS NULL OR user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Get the board
  SELECT * INTO board_record
  FROM public.boards
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
  UPDATE public.boards
  SET 
    member_ids = COALESCE(updated_members, ARRAY[]::uuid[]),
    updated_at = now()
  WHERE id = board_id;

  -- If no members left, delete the board and its access code
  IF array_length(COALESCE(updated_members, ARRAY[]::uuid[]), 1) IS NULL THEN
    -- Delete associated access code
    DELETE FROM public.access_codes WHERE code = board_record.access_code;
    -- Delete the board
    DELETE FROM public.boards WHERE id = board_id;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update add_board_member function
CREATE OR REPLACE FUNCTION add_board_member(
  board_id uuid,
  user_id uuid
)
RETURNS boolean AS $$
DECLARE
  board_record public.boards%ROWTYPE;
BEGIN
  -- Set search path for this function
  SET search_path = public, auth, extensions;
  
  -- Validate inputs
  IF board_id IS NULL OR user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Get the board
  SELECT * INTO board_record
  FROM public.boards
  WHERE id = board_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check if user is already a member
  IF user_id = ANY(COALESCE(board_record.member_ids, ARRAY[]::uuid[])) THEN
    RETURN true; -- Already a member
  END IF;

  -- Add user to the board
  UPDATE public.boards
  SET 
    member_ids = array_append(COALESCE(member_ids, ARRAY[]::uuid[]), user_id),
    updated_at = now()
  WHERE id = board_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update ensure_owner_is_member function
CREATE OR REPLACE FUNCTION ensure_owner_is_member()
RETURNS trigger AS $$
BEGIN
  -- Set search path for this function
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

-- Update cleanup_empty_boards_trigger function
CREATE OR REPLACE FUNCTION cleanup_empty_boards_trigger()
RETURNS trigger AS $$
BEGIN
  -- Set search path for this function
  SET search_path = public, auth, extensions;
  
  -- If member_ids becomes empty, delete the board
  IF array_length(NEW.member_ids, 1) IS NULL OR array_length(NEW.member_ids, 1) = 0 THEN
    -- Delete associated access code
    DELETE FROM public.access_codes WHERE code = NEW.access_code;
    -- Delete the board
    DELETE FROM public.boards WHERE id = NEW.id;
    RETURN NULL; -- Prevent the update since we're deleting
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update user profile related functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  -- Set search path for this function
  SET search_path = public, auth, extensions;
  
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_comments_updated_at()
RETURNS trigger AS $$
BEGIN
  -- Set search path for this function
  SET search_path = public, auth, extensions;
  
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or update handle_new_user function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Set search path for this function
  SET search_path = public, auth, extensions;
  
  -- Create user profile
  INSERT INTO public.user_profiles (id, name, created_at, updated_at)
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

-- Create or update create_user_profile function
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS trigger AS $$
BEGIN
  -- Set search path for this function
  SET search_path = public, auth, extensions;
  
  -- Create user profile
  INSERT INTO public.user_profiles (id, name, created_at, updated_at)
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

-- Update uid function
CREATE OR REPLACE FUNCTION uid()
RETURNS uuid AS $$
BEGIN
  -- Set search path for this function
  SET search_path = public, auth, extensions;
  
  RETURN auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create missing user profiles function
CREATE OR REPLACE FUNCTION create_missing_user_profiles()
RETURNS void AS $$
DECLARE
  user_record record;
BEGIN
  -- Set search path for this function
  SET search_path = public, auth, extensions;
  
  -- Create profiles for users who don't have them
  FOR user_record IN 
    SELECT au.id, au.raw_user_meta_data
    FROM auth.users au
    LEFT JOIN public.user_profiles up ON au.id = up.id
    WHERE up.id IS NULL
  LOOP
    INSERT INTO public.user_profiles (id, name, created_at, updated_at)
    VALUES (
      user_record.id,
      COALESCE(user_record.raw_user_meta_data->>'name', 'User'),
      now(),
      now()
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete empty boards function
CREATE OR REPLACE FUNCTION delete_empty_boards()
RETURNS void AS $$
BEGIN
  -- Set search path for this function
  SET search_path = public, auth, extensions;
  
  -- Delete boards with no members
  DELETE FROM public.boards 
  WHERE array_length(member_ids, 1) IS NULL OR array_length(member_ids, 1) = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on all functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- Ensure triggers are properly set up with updated functions
DROP TRIGGER IF EXISTS ensure_owner_is_member_trigger ON public.boards;
CREATE TRIGGER ensure_owner_is_member_trigger
  BEFORE INSERT OR UPDATE ON public.boards
  FOR EACH ROW
  EXECUTE FUNCTION ensure_owner_is_member();

DROP TRIGGER IF EXISTS cleanup_empty_boards_trigger ON public.boards;
CREATE TRIGGER cleanup_empty_boards_trigger
  AFTER UPDATE OF member_ids ON public.boards
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_empty_boards_trigger();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_comments_updated_at_trigger ON public.comments;
CREATE TRIGGER update_comments_updated_at_trigger
  BEFORE UPDATE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION update_comments_updated_at();

-- Create trigger for new user profile creation if it doesn't exist
DO $$
BEGIN
  -- Try to create trigger on auth.users if accessible
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

-- Update table statistics for better query planning
ANALYZE public.boards;
ANALYZE public.memories;
ANALYZE public.user_profiles;
ANALYZE public.access_codes;
ANALYZE public.comments;

-- Reset search_path to default
RESET search_path;