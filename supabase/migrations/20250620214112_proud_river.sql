/*
  # Fix get_memory_like_status function overloading

  1. Problem
    - Multiple versions of get_memory_like_status function causing ambiguity
    - Supabase REST API cannot determine which function to call
    - Error: "Could not choose the best candidate function"

  2. Solution
    - Drop all existing versions of the function
    - Create a single unified function that uses auth.uid() internally
    - Return a consistent result structure
*/

-- Drop any existing versions of the function to resolve overloading
DROP FUNCTION IF EXISTS public.get_memory_like_status(uuid);
DROP FUNCTION IF EXISTS public.get_memory_like_status(uuid, uuid);

-- Create a single unified function that uses auth.uid() internally
CREATE OR REPLACE FUNCTION public.get_memory_like_status(memory_id_param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  current_memory RECORD;
  current_user_id uuid;
  result json;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Get the current memory
  SELECT * INTO current_memory
  FROM memories
  WHERE id = memory_id_param;
  
  -- Check if memory exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Memory not found',
      'isLiked', false,
      'likes', 0
    );
  END IF;
  
  -- Return the current like status
  RETURN json_build_object(
    'success', true,
    'isLiked', COALESCE(current_memory.is_liked, false),
    'likes', COALESCE(current_memory.likes, 0)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error getting memory like status: ' || SQLERRM,
      'isLiked', false,
      'likes', 0
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_memory_like_status(uuid) TO authenticated;