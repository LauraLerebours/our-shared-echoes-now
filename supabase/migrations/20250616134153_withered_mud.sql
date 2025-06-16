/*
  # Create memory likes system

  1. New Tables
    - `memory_likes`
      - `id` (uuid, primary key)
      - `memory_id` (uuid, foreign key to memories)
      - `user_id` (uuid, foreign key to user_profiles)
      - `created_at` (timestamp)
      - Unique constraint on (memory_id, user_id) to prevent duplicate likes

  2. Security
    - Enable RLS on `memory_likes` table
    - Add policies for authenticated users to manage their own likes
    - Add policies to read likes for memories they have access to

  3. Functions
    - Create function to toggle memory likes
    - Create function to get like count and user's like status
*/

-- Create memory_likes table
CREATE TABLE IF NOT EXISTS memory_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(memory_id, user_id)
);

-- Add foreign key constraints
ALTER TABLE memory_likes 
ADD CONSTRAINT fk_memory_likes_memory_id 
FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE;

ALTER TABLE memory_likes 
ADD CONSTRAINT fk_memory_likes_user_id 
FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_memory_likes_memory_id ON memory_likes(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_likes_user_id ON memory_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_likes_created_at ON memory_likes(created_at);

-- Enable RLS
ALTER TABLE memory_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for memory_likes
CREATE POLICY "Users can read likes for accessible memories"
  ON memory_likes
  FOR SELECT
  TO authenticated
  USING (
    memory_id IN (
      SELECT m.id FROM memories m
      JOIN boards b ON m.access_code = b.access_code
      WHERE auth.uid() = b.owner_id OR auth.uid() = ANY(COALESCE(b.member_ids, ARRAY[]::uuid[]))
    )
  );

CREATE POLICY "Users can insert their own likes"
  ON memory_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    memory_id IN (
      SELECT m.id FROM memories m
      JOIN boards b ON m.access_code = b.access_code
      WHERE auth.uid() = b.owner_id OR auth.uid() = ANY(COALESCE(b.member_ids, ARRAY[]::uuid[]))
    )
  );

CREATE POLICY "Users can delete their own likes"
  ON memory_likes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to toggle memory like
CREATE OR REPLACE FUNCTION toggle_memory_like_v2(
  memory_id_param uuid,
  user_id_param uuid DEFAULT auth.uid()
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  like_exists boolean;
  total_likes integer;
  user_has_liked boolean;
  result json;
BEGIN
  -- Check if user has access to this memory
  IF NOT EXISTS (
    SELECT 1 FROM memories m
    JOIN boards b ON m.access_code = b.access_code
    WHERE m.id = memory_id_param 
    AND (user_id_param = b.owner_id OR user_id_param = ANY(COALESCE(b.member_ids, ARRAY[]::uuid[])))
  ) THEN
    RAISE EXCEPTION 'Access denied to this memory';
  END IF;

  -- Check if like already exists
  SELECT EXISTS(
    SELECT 1 FROM memory_likes 
    WHERE memory_id = memory_id_param AND user_id = user_id_param
  ) INTO like_exists;

  -- Toggle the like
  IF like_exists THEN
    -- Remove like
    DELETE FROM memory_likes 
    WHERE memory_id = memory_id_param AND user_id = user_id_param;
    user_has_liked := false;
  ELSE
    -- Add like
    INSERT INTO memory_likes (memory_id, user_id) 
    VALUES (memory_id_param, user_id_param);
    user_has_liked := true;
  END IF;

  -- Get total like count
  SELECT COUNT(*) INTO total_likes
  FROM memory_likes 
  WHERE memory_id = memory_id_param;

  -- Return result
  result := json_build_object(
    'success', true,
    'likes', total_likes,
    'isLiked', user_has_liked,
    'memory_id', memory_id_param
  );

  RETURN result;
END;
$$;

-- Function to get memory like status
CREATE OR REPLACE FUNCTION get_memory_like_status(
  memory_id_param uuid,
  user_id_param uuid DEFAULT auth.uid()
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_likes integer;
  user_has_liked boolean;
  result json;
BEGIN
  -- Check if user has access to this memory
  IF NOT EXISTS (
    SELECT 1 FROM memories m
    JOIN boards b ON m.access_code = b.access_code
    WHERE m.id = memory_id_param 
    AND (user_id_param = b.owner_id OR user_id_param = ANY(COALESCE(b.member_ids, ARRAY[]::uuid[])))
  ) THEN
    RAISE EXCEPTION 'Access denied to this memory';
  END IF;

  -- Get total like count
  SELECT COUNT(*) INTO total_likes
  FROM memory_likes 
  WHERE memory_id = memory_id_param;

  -- Check if current user has liked
  SELECT EXISTS(
    SELECT 1 FROM memory_likes 
    WHERE memory_id = memory_id_param AND user_id = user_id_param
  ) INTO user_has_liked;

  -- Return result
  result := json_build_object(
    'likes', total_likes,
    'isLiked', user_has_liked,
    'memory_id', memory_id_param
  );

  RETURN result;
END;
$$;

-- Create a view to easily get memory data with like counts
CREATE OR REPLACE VIEW memories_with_likes AS
SELECT 
  m.*,
  COALESCE(like_counts.total_likes, 0) as total_likes
FROM memories m
LEFT JOIN (
  SELECT 
    memory_id,
    COUNT(*) as total_likes
  FROM memory_likes
  GROUP BY memory_id
) like_counts ON m.id = like_counts.memory_id;

-- Grant permissions
GRANT SELECT ON memories_with_likes TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_memory_like_v2(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_memory_like_status(uuid, uuid) TO authenticated;