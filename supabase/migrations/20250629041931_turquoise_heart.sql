/*
  # Fix Carousel Memory Type Constraint

  1. Problem
    - The current check_memory_type_media constraint doesn't account for carousel memories
    - This causes errors when creating carousel memories
    - The constraint requires media_url to be NULL for notes and NOT NULL for photos/videos

  2. Solution
    - Update the constraint to include carousel memories
    - Allow carousel memories to have NULL media_url
    - Maintain existing constraints for other memory types

  3. Changes
    - Drop the existing constraint
    - Create a new constraint that includes carousel type
    - Ensure proper validation for all memory types
*/

-- First, drop the existing constraint
ALTER TABLE memories 
DROP CONSTRAINT IF EXISTS check_memory_type_media;

-- Create a new constraint that includes carousel type
ALTER TABLE memories 
ADD CONSTRAINT check_memory_type_media 
CHECK (
  (memory_type = 'note' AND media_url IS NULL) OR 
  (memory_type = 'carousel' AND media_url IS NULL) OR
  (memory_type IN ('photo', 'video') AND media_url IS NOT NULL)
);

-- Update any existing carousel memories to ensure they comply with the constraint
UPDATE memories
SET media_url = NULL
WHERE memory_type = 'carousel' AND media_url IS NOT NULL;