/*
  # Fix comments table foreign key reference

  1. Changes
    - Update comments table to reference user_profiles instead of auth.users
    - This matches what the code expects based on the existing foreign key constraint
*/

-- Update the comments table to reference user_profiles instead of auth.users
-- First, drop the existing foreign key constraint
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;

-- Add the correct foreign key constraint to user_profiles
ALTER TABLE comments ADD CONSTRAINT fk_comments_user_profile_id 
  FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;