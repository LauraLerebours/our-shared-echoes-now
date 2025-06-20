/*
  # Simplify Likes System

  1. Changes
    - Modify the memories table to use a direct likes count
    - Add a migration function to transfer existing likes counts
    - Update the toggle_memory_like function to work with the new structure
    - Drop the memory_likes table after migration

  2. Benefits
    - Simpler database structure
    - Better performance for likes operations
    - Reduced complexity in queries
    - Fewer tables to maintain
*/

-- First, ensure the likes column exists on memories table
DO $$
BEGIN
  -- Check if likes column already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'memories' AND column_name = 'likes'
  ) THEN
    -- Add likes column if it doesn't exist
    ALTER TABLE memories ADD COLUMN likes integer DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Create a function to migrate existing likes counts
CREATE OR REPLACE FUNCTION migrate_memory_likes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  memory_record RECORD;
  like_count integer;
BEGIN
  -- Only run if memory_likes table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'memory_likes' AND table_schema = 'public'
  ) THEN
    -- For each memory, count likes and update the memories table
    FOR memory_record IN SELECT id FROM memories
    LOOP
      -- Count likes for this memory
      SELECT COUNT(*) INTO like_count
      FROM memory_likes
      WHERE memory_id = memory_record.id;
      
      -- Update the memory with the like count
      UPDATE memories
      SET likes = like_count
      WHERE id = memory_record.id;
    END LOOP;
    
    RAISE NOTICE 'Migrated likes counts for all memories';
  ELSE
    RAISE NOTICE 'memory_likes table does not exist, no migration needed';
  END IF;
END;
$$;

-- Run the migration function
SELECT migrate_memory_likes();

-- Update the toggle_memory_like function to work with the new structure
CREATE OR REPLACE FUNCTION toggle_memory_like_v3(
  memory_id_param uuid,
  user_id_param uuid DEFAULT auth.uid()
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  current_memory RECORD;
  new_likes integer;
  new_is_liked boolean;
  result json;
BEGIN
  -- Get the current memory
  SELECT * INTO current_memory
  FROM memories
  WHERE id = memory_id_param;
  
  -- Check if memory exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Memory not found'
    );
  END IF;
  
  -- Toggle the like status
  new_is_liked := NOT COALESCE(current_memory.is_liked, false);
  
  -- Update the likes count
  IF new_is_liked THEN
    new_likes := COALESCE(current_memory.likes, 0) + 1;
  ELSE
    new_likes := GREATEST(0, COALESCE(current_memory.likes, 0) - 1);
  END IF;
  
  -- Update the memory
  UPDATE memories
  SET 
    likes = new_likes,
    is_liked = new_is_liked
  WHERE id = memory_id_param;
  
  -- Return the result
  RETURN json_build_object(
    'success', true,
    'likes', new_likes,
    'isLiked', new_is_liked
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION toggle_memory_like_v3(uuid, uuid) TO authenticated;

-- Update the memories_with_likes view to use the direct likes count
DROP VIEW IF EXISTS memories_with_likes CASCADE;

CREATE VIEW memories_with_likes AS
SELECT 
  m.*,
  m.likes as total_likes
FROM 
  memories m;

-- Grant select permission on the view
GRANT SELECT ON memories_with_likes TO authenticated;

-- Update the get_memories functions to work with the new view
CREATE OR REPLACE FUNCTION get_memories_by_access_code_safe(access_code_param text)
RETURNS SETOF memories_with_likes
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth, extensions
AS $$
  SELECT m.*
  FROM memories_with_likes m
  WHERE m.access_code = access_code_param
  AND (m.moderation_status = 'approved' OR m.moderation_status IS NULL)
  ORDER BY m.event_date DESC, m.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION get_memories_by_access_codes_safe(access_codes text[])
RETURNS SETOF memories_with_likes
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth, extensions
AS $$
  SELECT m.*
  FROM memories_with_likes m
  WHERE m.access_code = ANY(access_codes)
  AND (m.moderation_status = 'approved' OR m.moderation_status IS NULL)
  ORDER BY m.event_date DESC, m.created_at DESC;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_memories_by_access_code_safe(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_memories_by_access_codes_safe(text[]) TO authenticated;

-- Drop the memory_likes table if it exists
-- Note: We're keeping this commented out for safety. Uncomment after verifying migration success.
-- DROP TABLE IF EXISTS memory_likes CASCADE;

-- Update table statistics for better query planning
ANALYZE memories;