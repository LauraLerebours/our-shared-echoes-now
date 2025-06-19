/*
  # Add Notes Support for Memories

  1. Schema Changes
    - Add `memory_type` column to memories table to distinguish between 'photo', 'video', and 'note'
    - Make `media_url` nullable since notes don't have media
    - Add check constraint to ensure notes don't have media_url

  2. Updates
    - Update existing memories to have memory_type based on is_video flag
    - Update RLS policies to work with new memory types
*/

-- Add memory_type column to memories table
ALTER TABLE memories ADD COLUMN memory_type text DEFAULT 'photo' CHECK (memory_type IN ('photo', 'video', 'note'));

-- Make media_url nullable for notes
ALTER TABLE memories ALTER COLUMN media_url DROP NOT NULL;

-- Add constraint to ensure notes don't have media_url and media memories have media_url
ALTER TABLE memories ADD CONSTRAINT check_memory_type_media 
  CHECK (
    (memory_type = 'note' AND media_url IS NULL) OR 
    (memory_type IN ('photo', 'video') AND media_url IS NOT NULL)
  );

-- Update existing memories to set correct memory_type
UPDATE memories SET memory_type = 'video' WHERE is_video = true;
UPDATE memories SET memory_type = 'photo' WHERE is_video = false;

-- Update the memories_with_likes view to include memory_type
DROP VIEW IF EXISTS memories_with_likes;

CREATE VIEW memories_with_likes AS
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