/*
  # Create comments table for memory discussions

  1. New Tables
    - `comments`
      - `id` (uuid, primary key)
      - `memory_id` (uuid, foreign key to memories)
      - `user_id` (uuid, foreign key to user_profiles)
      - `content` (text, the comment content)
      - `parent_id` (uuid, nullable, for threaded replies)
      - `created_at` (timestamptz, when comment was created)
      - `updated_at` (timestamptz, when comment was last updated)

  2. Security
    - Enable RLS on `comments` table
    - Add policies for authenticated users to:
      - Read all comments
      - Create their own comments
      - Update their own comments
      - Delete their own comments

  3. Relationships
    - Foreign key from `comments.memory_id` to `memories.id`
    - Foreign key from `comments.user_id` to `user_profiles.id`
    - Self-referencing foreign key from `comments.parent_id` to `comments.id` for replies

  4. Indexes
    - Index on memory_id for efficient comment loading
    - Index on user_id for user's comment queries
    - Index on parent_id for threaded replies
*/

-- Create the comments table
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  parent_id uuid DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE comments 
ADD CONSTRAINT fk_comments_memory_id 
FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE;

ALTER TABLE comments 
ADD CONSTRAINT fk_comments_user_profile_id 
FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;

ALTER TABLE comments 
ADD CONSTRAINT fk_comments_parent_id 
FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_comments_memory_id ON comments(memory_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);

-- Enable Row Level Security
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can read all comments"
  ON comments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create comments"
  ON comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

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

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_comments_updated_at_trigger
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_comments_updated_at();