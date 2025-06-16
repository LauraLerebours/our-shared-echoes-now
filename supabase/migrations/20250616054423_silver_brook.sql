/*
  # Add Content Moderation Tracking

  1. New Tables
    - `moderation_logs` - Track content moderation results
      - `id` (uuid, primary key)
      - `media_url` (text, the URL of the moderated content)
      - `is_appropriate` (boolean, whether the content passed moderation)
      - `moderation_results` (jsonb, detailed results from moderation service)
      - `user_id` (uuid, the user who uploaded the content)
      - `created_at` (timestamptz, when the moderation occurred)
      - `is_video` (boolean, whether the content is a video)

  2. Security
    - Enable RLS on the new table
    - Add policies for administrators to view logs
    - Add function to record moderation results
*/

-- Create moderation_logs table
CREATE TABLE IF NOT EXISTS moderation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_url text NOT NULL,
  is_appropriate boolean NOT NULL,
  moderation_results jsonb,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now() NOT NULL,
  is_video boolean DEFAULT false NOT NULL
);

-- Enable RLS
ALTER TABLE moderation_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for users to see their own logs
CREATE POLICY "Users can view their own moderation logs"
  ON moderation_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to record moderation results
CREATE OR REPLACE FUNCTION record_moderation_result(
  media_url text,
  is_appropriate boolean,
  moderation_results jsonb,
  is_video boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  log_id uuid;
  current_user_id uuid;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  -- Insert moderation log
  INSERT INTO moderation_logs (
    media_url,
    is_appropriate,
    moderation_results,
    user_id,
    is_video
  ) VALUES (
    media_url,
    is_appropriate,
    moderation_results,
    current_user_id,
    is_video
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION record_moderation_result(text, boolean, jsonb, boolean) TO authenticated;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_moderation_logs_user_id ON moderation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_is_appropriate ON moderation_logs(is_appropriate);