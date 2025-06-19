/*
  # Add Profile Pictures Support

  1. Schema Changes
    - Add `profile_picture_url` column to `user_profiles` table
    - Add storage bucket for profile pictures
    - Set up RLS policies for profile picture access

  2. Security
    - Enable RLS on storage bucket
    - Allow users to upload/update their own profile pictures
    - Allow public read access to profile pictures
*/

-- Add profile_picture_url column to user_profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'profile_picture_url' AND table_schema = 'public'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN profile_picture_url text;
  END IF;
END $$;

-- Create storage bucket for profile pictures if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for profile pictures storage
DO $$
BEGIN
  -- Allow authenticated users to upload their own profile pictures
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can upload their own profile pictures'
  ) THEN
    CREATE POLICY "Users can upload their own profile pictures"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  -- Allow authenticated users to update their own profile pictures
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can update their own profile pictures'
  ) THEN
    CREATE POLICY "Users can update their own profile pictures"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  -- Allow authenticated users to delete their own profile pictures
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete their own profile pictures'
  ) THEN
    CREATE POLICY "Users can delete their own profile pictures"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  -- Allow public read access to profile pictures
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public read access to profile pictures'
  ) THEN
    CREATE POLICY "Public read access to profile pictures"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'profile-pictures');
  END IF;
END $$;

-- Create function to handle profile picture cleanup when user is deleted
CREATE OR REPLACE FUNCTION cleanup_user_profile_picture()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete profile picture from storage when user profile is deleted
  IF OLD.profile_picture_url IS NOT NULL THEN
    -- Extract the file path from the URL
    DECLARE
      file_path text;
    BEGIN
      -- Extract path after the bucket name
      file_path := substring(OLD.profile_picture_url from '/profile-pictures/(.*)');
      
      IF file_path IS NOT NULL THEN
        -- Delete the file from storage
        DELETE FROM storage.objects 
        WHERE bucket_id = 'profile-pictures' 
        AND name = file_path;
      END IF;
    EXCEPTION
      WHEN others THEN
        -- Log error but don't fail the deletion
        NULL;
    END;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for profile picture cleanup
DROP TRIGGER IF EXISTS cleanup_profile_picture_trigger ON user_profiles;
CREATE TRIGGER cleanup_profile_picture_trigger
  BEFORE DELETE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_user_profile_picture();

-- Add index for profile picture URL lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_profile_picture ON user_profiles(profile_picture_url);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;