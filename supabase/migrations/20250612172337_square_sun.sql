/*
  # Fix comments table foreign key constraint

  This migration ensures the comments table has the correct foreign key reference
  to user_profiles instead of auth.users, with proper existence checks.
*/

-- Drop the existing foreign key constraint to auth.users if it exists
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;

-- Only add the constraint if it doesn't already exist
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