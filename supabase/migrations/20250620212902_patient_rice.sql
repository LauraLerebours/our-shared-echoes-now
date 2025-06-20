/*
  # Fix get_memory_like_status function overloading

  1. Database Changes
    - Drop any existing overloaded versions of get_memory_like_status function
    - Create a single, unified get_memory_like_status function that uses auth.uid() internally
    - Function accepts only memory_id_param and determines user context automatically

  2. Security
    - Function uses auth.uid() to get current user context
    - Returns isLiked: false for unauthenticated users
    - Maintains proper access control through existing RLS policies
*/

-- Drop any existing versions of the function to resolve overloading
DROP FUNCTION IF EXISTS public.get_memory_like_status(uuid);
DROP FUNCTION IF EXISTS public.get_memory_like_status(uuid, uuid);

-- Create a single unified function that uses auth.uid() internally
CREATE OR REPLACE FUNCTION public.get_memory_like_status(memory_id_param uuid)
RETURNS TABLE(
  memory_id uuid,
  total_likes integer,
  is_liked boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get the current authenticated user ID
  current_user_id := auth.uid();
  
  -- Return the memory like status
  RETURN QUERY
  SELECT 
    m.id as memory_id,
    COALESCE(like_counts.total_likes, 0)::integer as total_likes,
    CASE 
      WHEN current_user_id IS NULL THEN false
      ELSE COALESCE(user_likes.is_liked, false)
    END as is_liked
  FROM memories m
  LEFT JOIN (
    SELECT 
      ml.memory_id,
      COUNT(*)::integer as total_likes
    FROM memory_likes ml
    GROUP BY ml.memory_id
  ) like_counts ON like_counts.memory_id = m.id
  LEFT JOIN (
    SELECT 
      ml.memory_id,
      true as is_liked
    FROM memory_likes ml
    WHERE ml.user_id = current_user_id
  ) user_likes ON user_likes.memory_id = m.id
  WHERE m.id = memory_id_param;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_memory_like_status(uuid) TO authenticated;