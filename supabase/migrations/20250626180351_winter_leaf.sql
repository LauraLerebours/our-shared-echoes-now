/*
  # Add Carousel Memories Feature

  1. New Tables
    - `memory_media_items` - Stores multiple media items for carousel memories
      - `id` (uuid, primary key)
      - `memory_id` (uuid, references memories)
      - `url` (text, not null) - URL to the media item
      - `is_video` (boolean) - Whether this item is a video
      - `order` (integer) - Order in the carousel
      - `created_at` (timestamptz)

  2. Changes to Existing Tables
    - Update `memories` table to support carousel type
      - Add 'carousel' as valid memory_type

  3. Security
    - Enable RLS on memory_media_items
    - Add policies for CRUD operations
    - Ensure proper access control
*/

-- First, update the memory_type check constraint to include 'carousel'
ALTER TABLE memories 
DROP CONSTRAINT IF EXISTS memories_memory_type_check;

ALTER TABLE memories 
ADD CONSTRAINT memories_memory_type_check 
CHECK (memory_type = ANY (ARRAY['photo'::text, 'video'::text, 'note'::text, 'carousel'::text]));

-- Create memory_media_items table
CREATE TABLE IF NOT EXISTS memory_media_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  url text NOT NULL,
  is_video boolean DEFAULT false NOT NULL,
  "order" integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE memory_media_items ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_memory_media_items_memory_id ON memory_media_items(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_media_items_order ON memory_media_items("order");

-- Create RLS policies for memory_media_items
CREATE POLICY "memories_media_items_select"
  ON memory_media_items
  FOR SELECT
  TO authenticated
  USING (
    memory_id IN (
      SELECT id FROM memories
      WHERE access_code IN (
        SELECT access_code FROM boards
        WHERE auth.uid() = owner_id OR auth.uid() = ANY(COALESCE(member_ids, ARRAY[]::uuid[]))
      )
    )
  );

CREATE POLICY "memories_media_items_insert"
  ON memory_media_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    memory_id IN (
      SELECT id FROM memories
      WHERE created_by = auth.uid()
      AND access_code IN (
        SELECT access_code FROM boards
        WHERE auth.uid() = owner_id OR auth.uid() = ANY(COALESCE(member_ids, ARRAY[]::uuid[]))
      )
    )
  );

CREATE POLICY "memories_media_items_update"
  ON memory_media_items
  FOR UPDATE
  TO authenticated
  USING (
    memory_id IN (
      SELECT id FROM memories
      WHERE created_by = auth.uid()
    )
  )
  WITH CHECK (
    memory_id IN (
      SELECT id FROM memories
      WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "memories_media_items_delete"
  ON memory_media_items
  FOR DELETE
  TO authenticated
  USING (
    memory_id IN (
      SELECT id FROM memories
      WHERE created_by = auth.uid()
    )
  );

-- Create function to get memory media items
CREATE OR REPLACE FUNCTION get_memory_media_items(memory_id_param uuid)
RETURNS SETOF memory_media_items
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, auth, extensions
AS $$
  SELECT *
  FROM memory_media_items
  WHERE memory_id = memory_id_param
  ORDER BY "order" ASC;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_memory_media_items(uuid) TO authenticated;

-- Update memories_with_likes view to include carousel memories
DROP VIEW IF EXISTS memories_with_likes;

CREATE VIEW memories_with_likes AS
SELECT 
  m.*,
  m.likes as total_likes
FROM 
  memories m;

-- Grant select permission on the view
GRANT SELECT ON memories_with_likes TO authenticated;