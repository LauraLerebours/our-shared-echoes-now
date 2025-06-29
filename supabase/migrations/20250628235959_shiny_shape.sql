-- First, update the memory_type check constraint to include 'carousel'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'memories_memory_type_check'
  ) THEN
    ALTER TABLE memories 
    DROP CONSTRAINT memories_memory_type_check;
  END IF;
END $$;

ALTER TABLE memories 
ADD CONSTRAINT memories_memory_type_check 
CHECK (memory_type = ANY (ARRAY['photo'::text, 'video'::text, 'note'::text, 'carousel'::text]));

-- Create memory_media_items table if it doesn't exist
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

-- Create RLS policies for memory_media_items only if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'memories_media_items_select' 
    AND tablename = 'memory_media_items'
  ) THEN
    EXECUTE format('
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
        )
    ');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'memories_media_items_insert' 
    AND tablename = 'memory_media_items'
  ) THEN
    EXECUTE format('
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
        )
    ');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'memories_media_items_update' 
    AND tablename = 'memory_media_items'
  ) THEN
    EXECUTE format('
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
        )
    ');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'memories_media_items_delete' 
    AND tablename = 'memory_media_items'
  ) THEN
    EXECUTE format('
      CREATE POLICY "memories_media_items_delete"
        ON memory_media_items
        FOR DELETE
        TO authenticated
        USING (
          memory_id IN (
            SELECT id FROM memories
            WHERE created_by = auth.uid()
          )
        )
    ');
  END IF;
END $$;

-- Create function to get memory media items if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_memory_media_items'
  ) THEN
    EXECUTE format('
      CREATE FUNCTION get_memory_media_items(memory_id_param uuid)
      RETURNS SETOF memory_media_items
      LANGUAGE sql
      SECURITY INVOKER
      STABLE
      SET search_path = public, auth, extensions
      AS $inner$
        SELECT *
        FROM memory_media_items
        WHERE memory_id = memory_id_param
        ORDER BY "order" ASC;
      $inner$
    ');

    -- Grant execute permission to authenticated users
    GRANT EXECUTE ON FUNCTION get_memory_media_items(uuid) TO authenticated;
  END IF;
END $$;

-- Handle the memories_with_likes view and dependent functions
-- First drop the dependent functions if they exist
DROP FUNCTION IF EXISTS get_memories_by_access_code_safe(text);
DROP FUNCTION IF EXISTS get_memories_by_access_codes_safe(text[]);
DROP FUNCTION IF EXISTS get_memory_by_id_safe(uuid);
DROP FUNCTION IF EXISTS get_memories_for_board_safe(uuid);

-- Now we can safely drop the view if it exists
DROP VIEW IF EXISTS memories_with_likes CASCADE;

-- Recreate the view
CREATE VIEW memories_with_likes AS
SELECT 
  m.*,
  m.likes as total_likes
FROM 
  memories m;

-- Recreate the dependent functions
CREATE OR REPLACE FUNCTION get_memories_by_access_code_safe(access_code_param text)
RETURNS SETOF memories_with_likes
LANGUAGE sql
STABLE
SECURITY INVOKER
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
STABLE
SECURITY INVOKER
SET search_path = public, auth, extensions
AS $$
  SELECT m.*
  FROM memories_with_likes m
  WHERE m.access_code = ANY(access_codes)
  AND (m.moderation_status = 'approved' OR m.moderation_status IS NULL)
  ORDER BY m.event_date DESC, m.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION get_memory_by_id_safe(memory_id_param uuid)
RETURNS SETOF memories_with_likes
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, auth, extensions
AS $$
  SELECT m.*
  FROM memories_with_likes m
  WHERE m.id = memory_id_param
  AND (m.moderation_status = 'approved' OR m.moderation_status IS NULL)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_memories_for_board_safe(board_id_param uuid)
RETURNS SETOF memories_with_likes
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, auth, extensions
AS $$
  SELECT m.*
  FROM memories_with_likes m
  JOIN boards b ON m.access_code = b.access_code
  WHERE b.id = board_id_param
  AND (m.moderation_status = 'approved' OR m.moderation_status IS NULL)
  AND (
    auth.uid() = b.owner_id OR 
    auth.uid() = ANY(COALESCE(b.member_ids, ARRAY[]::uuid[]))
  )
  ORDER BY m.event_date DESC, m.created_at DESC;
$$;

-- Grant select permission on the view
GRANT SELECT ON memories_with_likes TO authenticated;

-- Grant execute permissions on the functions
GRANT EXECUTE ON FUNCTION get_memories_by_access_code_safe(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_memories_by_access_codes_safe(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_memory_by_id_safe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_memories_for_board_safe(uuid) TO authenticated;