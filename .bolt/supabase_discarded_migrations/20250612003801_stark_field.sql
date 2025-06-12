/*
  # Allow all users to like memories from other users

  1. Changes
    - Update RLS policies to allow all authenticated users to update like counts
    - Users can like/unlike any memory, not just their own
    - Maintain security for other operations (create, delete)

  2. Security
    - Users can still only create memories with their own created_by
    - Users can still only delete their own memories
    - All users can read all memories
    - All users can update like counts on any memory
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can update their own memories" ON memories;

-- Create new policies that allow liking any memory
CREATE POLICY "Users can update memory likes"
  ON memories
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    -- Only allow updating likes and is_liked fields
    -- This prevents users from modifying other fields of memories they don't own
    auth.uid() = created_by OR (
      -- Allow updating only like-related fields for memories not owned by user
      OLD.caption IS NOT DISTINCT FROM NEW.caption AND
      OLD.media_url IS NOT DISTINCT FROM NEW.media_url AND
      OLD.is_video IS NOT DISTINCT FROM NEW.is_video AND
      OLD.event_date IS NOT DISTINCT FROM NEW.event_date AND
      OLD.location IS NOT DISTINCT FROM NEW.location AND
      OLD.access_code IS NOT DISTINCT FROM NEW.access_code AND
      OLD.board_id IS NOT DISTINCT FROM NEW.board_id AND
      OLD.created_by IS NOT DISTINCT FROM NEW.created_by
    )
  );

-- Create a separate policy for users to update their own memories completely
CREATE POLICY "Users can fully update their own memories"
  ON memories
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);