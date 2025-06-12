/*
  # Add commenting system with threaded replies

  1. New Tables
    - `comments`
      - `id` (uuid, primary key)
      - `memory_id` (uuid, foreign key to memories)
      - `user_id` (uuid, foreign key to auth.users)
      - `content` (text, not null)
      - `parent_id` (uuid, foreign key to comments for replies)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on comments table
    - Add policies for CRUD operations
    - Users can comment on any memory they can see
    - Users can edit/delete their own comments

  3. Indexes
    - Add indexes for better query performance
*/

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  parent_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_comments_memory_id ON comments(memory_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);

-- Create policies for comments
CREATE POLICY "Users can read comments on memories they can access"
  ON comments
  FOR SELECT
  TO authenticated
  USING (
    memory_id IN (
      SELECT id FROM memories
      WHERE access_code IN (
        SELECT b.access_code
        FROM boards b
        WHERE auth.uid() = b.owner_id 
        OR auth.uid() = ANY(b.member_ids)
      )
    )
  );

CREATE POLICY "Users can create comments on accessible memories"
  ON comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND memory_id IN (
      SELECT id FROM memories
      WHERE access_code IN (
        SELECT b.access_code
        FROM boards b
        WHERE auth.uid() = b.owner_id 
        OR auth.uid() = ANY(b.member_ids)
      )
    )
  );

CREATE POLICY "Users can update their own comments"
  ON comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create trigger function for updating updated_at
CREATE OR REPLACE FUNCTION update_comments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger to update updated_at on comments
CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_comments_updated_at();