/*
  # Content Moderation System

  1. New Tables
    - `moderation_logs` - Stores content moderation history
      - `id` (uuid, primary key)
      - `content_type` (text, not null) - Type of content being moderated
      - `content_id` (uuid) - References the content being moderated
      - `user_id` (uuid) - User who created the content
      - `is_appropriate` (boolean, not null) - Whether content passed moderation
      - `confidence_score` (decimal) - Confidence level of moderation decision
      - `flagged_categories` (text[]) - Categories content was flagged for
      - `moderation_reason` (text) - Reason for moderation decision
      - `content_hash` (text) - Hash for duplicate detection
      - `created_at` (timestamptz) - When moderation occurred

  2. Changes to Existing Tables
    - Add moderation fields to `memories` table:
      - `moderation_status` (text) - 'pending', 'approved', or 'rejected'
      - `moderation_score` (decimal) - Confidence score from moderation
      - `moderated_at` (timestamptz) - When moderation occurred

  3. New Functions
    - `log_moderation_result` - Records moderation decisions
    - `check_content_moderation` - Checks if content was previously moderated
    - `update_moderated_at` - Updates timestamp when moderation status changes

  4. Security
    - Enable RLS on moderation_logs
    - Add policies for viewing and inserting moderation logs
    - Update memories_with_likes view to only show approved content
*/

-- Create moderation_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS moderation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL CHECK (content_type IN ('text', 'image', 'video')),
  content_id uuid, -- References memory ID or other content
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_appropriate boolean NOT NULL,
  confidence_score decimal(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  flagged_categories text[],
  moderation_reason text,
  content_hash text, -- Hash of content for duplicate detection
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE moderation_logs ENABLE ROW LEVEL SECURITY;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_moderation_logs_content_id ON moderation_logs(content_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_user_id ON moderation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_is_appropriate ON moderation_logs(is_appropriate);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_created_at ON moderation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_content_hash ON moderation_logs(content_hash);

-- RLS Policies - check if they exist first to avoid errors
DO $$
BEGIN
  -- Check if the policy already exists before creating it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'moderation_logs' 
    AND policyname = 'Users can view their own moderation logs'
  ) THEN
    CREATE POLICY "Users can view their own moderation logs"
      ON moderation_logs
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  -- Check if the policy already exists before creating it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'moderation_logs' 
    AND policyname = 'System can insert moderation logs'
  ) THEN
    CREATE POLICY "System can insert moderation logs"
      ON moderation_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Add moderation fields to memories table if they don't exist
DO $$
BEGIN
  -- Add moderation_status column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'memories' AND column_name = 'moderation_status'
  ) THEN
    ALTER TABLE memories ADD COLUMN moderation_status text DEFAULT 'approved' CHECK (moderation_status IN ('pending', 'approved', 'rejected'));
  END IF;

  -- Add moderation_score column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'memories' AND column_name = 'moderation_score'
  ) THEN
    ALTER TABLE memories ADD COLUMN moderation_score decimal(3,2) DEFAULT 1.0 CHECK (moderation_score >= 0 AND moderation_score <= 1);
  END IF;

  -- Add moderated_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'memories' AND column_name = 'moderated_at'
  ) THEN
    ALTER TABLE memories ADD COLUMN moderated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create function to log moderation results
CREATE OR REPLACE FUNCTION log_moderation_result(
  p_content_type text,
  p_content_id uuid,
  p_user_id uuid,
  p_is_appropriate boolean,
  p_confidence_score decimal,
  p_flagged_categories text[],
  p_moderation_reason text DEFAULT NULL,
  p_content_hash text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO moderation_logs (
    content_type,
    content_id,
    user_id,
    is_appropriate,
    confidence_score,
    flagged_categories,
    moderation_reason,
    content_hash
  ) VALUES (
    p_content_type,
    p_content_id,
    p_user_id,
    p_is_appropriate,
    p_confidence_score,
    p_flagged_categories,
    p_moderation_reason,
    p_content_hash
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if content was previously moderated
CREATE OR REPLACE FUNCTION check_content_moderation(
  p_content_hash text,
  p_user_id uuid
) RETURNS TABLE (
  is_appropriate boolean,
  confidence_score decimal,
  flagged_categories text[],
  moderation_reason text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ml.is_appropriate,
    ml.confidence_score,
    ml.flagged_categories,
    ml.moderation_reason
  FROM moderation_logs ml
  WHERE ml.content_hash = p_content_hash
    AND ml.user_id = p_user_id
    AND ml.created_at > (now() - interval '24 hours') -- Only check recent results
  ORDER BY ml.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update memories_with_likes view to include moderation status
DO $$
BEGIN
  -- Check if the view exists before dropping it
  IF EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' AND table_name = 'memories_with_likes'
  ) THEN
    DROP VIEW memories_with_likes;
  END IF;
END $$;

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
) like_counts ON m.id = like_counts.memory_id
WHERE COALESCE(m.moderation_status, 'approved') = 'approved'; -- Only show approved content

-- Create trigger to automatically set moderation timestamp
CREATE OR REPLACE FUNCTION update_moderated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.moderated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for memories moderation updates
DO $$
BEGIN
  -- Check if the trigger exists before dropping it
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_memories_moderated_at' 
    AND tgrelid = 'memories'::regclass
  ) THEN
    DROP TRIGGER update_memories_moderated_at ON memories;
  END IF;
END $$;

CREATE TRIGGER update_memories_moderated_at
  BEFORE UPDATE OF moderation_status ON memories
  FOR EACH ROW
  EXECUTE FUNCTION update_moderated_at();

-- Add index for moderation queries
CREATE INDEX IF NOT EXISTS idx_memories_moderation_status ON memories(moderation_status);
CREATE INDEX IF NOT EXISTS idx_memories_moderated_at ON memories(moderated_at);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT ON moderation_logs TO authenticated;
GRANT EXECUTE ON FUNCTION log_moderation_result TO authenticated;
GRANT EXECUTE ON FUNCTION check_content_moderation TO authenticated;