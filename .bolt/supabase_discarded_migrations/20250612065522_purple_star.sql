/*
  # Create comments table for memory discussions

  1. New Tables
    - `comments`
      - `id` (uuid, primary key)
      - `memory_id` (uuid, foreign key to memories table)
      - `user_id` (uuid, foreign key to user_profiles table)
      - `content` (text, the comment content)
      - `parent_id` (uuid, nullable, for threaded replies)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `comments` table
    - Add policies for authenticated users to:
      - Read all comments
      - Create their own comments
      - Update their own comments
      - Delete their own comments

  3. Indexes
    - Index on memory_id for efficient comment loading
    - Index on user_id for user-specific queries
    - Index on parent_id for threaded comments