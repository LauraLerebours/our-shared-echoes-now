/*
  # Create Dummy Public Boards

  1. Purpose
    - Create sample public boards for testing the public boards feature
    - Populate with realistic data to demonstrate functionality

  2. Sample Data
    - Create 5 public boards with different themes
    - Create 3 private boards for comparison
    - Use realistic board names and descriptions
*/

-- Create dummy public boards
INSERT INTO boards (
  id,
  name,
  owner_id,
  access_code,
  share_code,
  member_ids,
  is_public,
  created_at,
  updated_at
) VALUES
  (
    gen_random_uuid(),
    'Travel Adventures 2024',
    (SELECT id FROM auth.users LIMIT 1),
    'TRAVEL2024',
    'share-travel-2024',
    ARRAY[(SELECT id FROM auth.users LIMIT 1)],
    true,
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '7 days'
  ),
  (
    gen_random_uuid(),
    'Family Memories',
    (SELECT id FROM auth.users LIMIT 1),
    'FAMILY2024',
    'share-family-memories',
    ARRAY[(SELECT id FROM auth.users LIMIT 1)],
    true,
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days'
  ),
  (
    gen_random_uuid(),
    'Wedding Planning',
    (SELECT id FROM auth.users LIMIT 1),
    'WEDDING24',
    'share-wedding-planning',
    ARRAY[(SELECT id FROM auth.users LIMIT 1)],
    true,
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days'
  ),
  (
    gen_random_uuid(),
    'College Friends Reunion',
    (SELECT id FROM auth.users LIMIT 1),
    'COLLEGE24',
    'share-college-reunion',
    ARRAY[(SELECT id FROM auth.users LIMIT 1)],
    true,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    gen_random_uuid(),
    'Cooking Adventures',
    (SELECT id FROM auth.users LIMIT 1),
    'COOKING24',
    'share-cooking-adventures',
    ARRAY[(SELECT id FROM auth.users LIMIT 1)],
    true,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    gen_random_uuid(),
    'Private Work Project',
    (SELECT id FROM auth.users LIMIT 1),
    'WORK2024',
    'share-work-project',
    ARRAY[(SELECT id FROM auth.users LIMIT 1)],
    false,
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '4 days'
  ),
  (
    gen_random_uuid(),
    'Personal Journal',
    (SELECT id FROM auth.users LIMIT 1),
    'JOURNAL24',
    'share-personal-journal',
    ARRAY[(SELECT id FROM auth.users LIMIT 1)],
    false,
    NOW() - INTERVAL '6 days',
    NOW() - INTERVAL '6 days'
  ),
  (
    gen_random_uuid(),
    'Secret Birthday Plans',
    (SELECT id FROM auth.users LIMIT 1),
    'BIRTHDAY24',
    'share-birthday-plans',
    ARRAY[(SELECT id FROM auth.users LIMIT 1)],
    false,
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '8 days'
  )
ON CONFLICT (id) DO NOTHING;