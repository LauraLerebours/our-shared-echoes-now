/*
  # Fix Comments and User Profiles Relationship

  1. Database Changes
    - Ensure proper foreign key relationship between comments.user_id and user_profiles.id
    - Add constraint if missing to enable proper joins in Supabase queries

  2. Security
    - Maintain existing RLS policies
    - Ensure referential integrity
*/

-- First, let's ensure the foreign key constraint exists
-- We'll use DO block to check if it exists before adding it
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

-- Ensure we have an index on user_id for better performance
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);