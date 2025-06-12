/*
  # Fix comments foreign key constraint

  1. Changes
    - Drop existing foreign key constraint if it exists
    - Add correct foreign key constraint to user_profiles only if it doesn't exist
  
  2. Security
    - Maintains referential integrity
    - Ensures proper cascade deletion
*/

-- Update the comments table to reference user_profiles instead of auth.users
-- First, drop the existing foreign key constraint
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;

-- Add the correct foreign key constraint to user_profiles only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_comments_user_profile_id' 
    AND table_name = 'comments'
  ) THEN
    ALTER TABLE comments ADD CONSTRAINT fk_comments_user_profile_id 
      FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;