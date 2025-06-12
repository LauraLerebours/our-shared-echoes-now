/*
  # Fix Comments to User Profiles Relationship

  1. Database Changes
    - Add foreign key constraint between comments.user_id and user_profiles.id
    - This enables PostgREST to recognize the relationship for joins

  2. Security
    - No RLS changes needed as comments table already has proper policies
    - Foreign key ensures referential integrity

  3. Notes
    - This fixes the "Could not find a relationship" error in CommentSection
    - Enables proper joining of comments with user profile data
*/

-- Add foreign key constraint between comments and user_profiles
DO $$
BEGIN
  -- Check if the foreign key constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_comments_user_profile_id' 
    AND table_name = 'comments'
  ) THEN
    -- Add the foreign key constraint
    ALTER TABLE public.comments
    ADD CONSTRAINT fk_comments_user_profile_id
    FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;