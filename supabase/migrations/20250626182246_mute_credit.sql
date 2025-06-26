/*
  # Add Drafts Table for Server-Side Draft Storage

  1. New Tables
    - `memory_drafts` - Store drafts on the server
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `board_id` (uuid, references boards)
      - `content` (jsonb, stores draft data)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on memory_drafts table
    - Add policies for users to manage their own drafts
    - Ensure proper access control

  3. Functions
    - Add function to get user's drafts
    - Add function to save draft
    - Add function to delete draft
*/

-- Create memory_drafts table
CREATE TABLE IF NOT EXISTS memory_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  board_id uuid REFERENCES boards(id) ON DELETE SET NULL,
  content jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE memory_drafts ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_memory_drafts_user_id ON memory_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_drafts_board_id ON memory_drafts(board_id);
CREATE INDEX IF NOT EXISTS idx_memory_drafts_updated_at ON memory_drafts(updated_at);

-- Create RLS policies for memory_drafts
CREATE POLICY "Users can manage their own drafts"
  ON memory_drafts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_memory_draft_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for memory_drafts updated_at
CREATE TRIGGER update_memory_drafts_updated_at
  BEFORE UPDATE ON memory_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_memory_draft_updated_at();

-- Create function to get user's drafts
CREATE OR REPLACE FUNCTION get_user_drafts(user_id_param uuid DEFAULT auth.uid())
RETURNS SETOF memory_drafts
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public, auth, extensions
AS $$
  SELECT *
  FROM memory_drafts
  WHERE user_id = user_id_param
  ORDER BY updated_at DESC;
$$;

-- Create function to save draft
CREATE OR REPLACE FUNCTION save_memory_draft(
  draft_id uuid,
  board_id uuid,
  content jsonb,
  user_id_param uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth, extensions
AS $$
DECLARE
  result_id uuid;
BEGIN
  -- Insert or update the draft
  INSERT INTO memory_drafts (id, user_id, board_id, content, updated_at)
  VALUES (
    COALESCE(draft_id, gen_random_uuid()),
    user_id_param,
    board_id,
    content,
    now()
  )
  ON CONFLICT (id) 
  DO UPDATE SET
    board_id = EXCLUDED.board_id,
    content = EXCLUDED.content,
    updated_at = now()
  RETURNING id INTO result_id;
  
  RETURN result_id;
END;
$$;

-- Create function to delete draft
CREATE OR REPLACE FUNCTION delete_memory_draft(
  draft_id uuid,
  user_id_param uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth, extensions
AS $$
DECLARE
  deleted boolean;
BEGIN
  -- Delete the draft if it belongs to the user
  WITH deleted_rows AS (
    DELETE FROM memory_drafts
    WHERE id = draft_id AND user_id = user_id_param
    RETURNING id
  )
  SELECT EXISTS(SELECT 1 FROM deleted_rows) INTO deleted;
  
  RETURN deleted;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_drafts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION save_memory_draft(uuid, uuid, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_memory_draft(uuid, uuid) TO authenticated;