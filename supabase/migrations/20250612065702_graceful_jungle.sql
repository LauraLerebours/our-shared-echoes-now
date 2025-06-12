/*
  # Add foreign key relationship between comments and user_profiles

  1. Changes
    - Add foreign key constraint linking comments.user_id to user_profiles.id
    - This enables proper joins between comments and user profiles for displaying user names

  2. Security
    - No changes to existing RLS policies
    - Maintains data integrity with proper referential constraints
*/

-- Add foreign key constraint between comments and user_profiles
ALTER TABLE public.comments
ADD CONSTRAINT fk_comments_user_profile_id
FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;