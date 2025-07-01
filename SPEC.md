# This Is Us - Technical Specification

## Project Overview

"This Is Us" is a collaborative memory-sharing application designed for couples, friends, and families to create and share memories together. The platform allows users to create boards, upload photos, videos, notes, and carousel memories, and invite others to collaborate.

## Technology Stack

### Frontend
- **Framework**: React 18.3.1 with TypeScript
- **Build Tool**: Vite 5.4.19
- **Styling**: Tailwind CSS 3.4.11 with CSS variables for theming
- **UI Components**: Custom components built with Radix UI primitives
- **State Management**: React Context API for auth and local state
- **Routing**: React Router 6.26.2
- **Form Handling**: React Hook Form 7.53.0
- **Data Fetching**: TanStack Query (React Query) 5.56.2
- **Animations**: Framer Motion 11.0.8
- **Date Handling**: date-fns 3.6.0
- **Icons**: Lucide React 0.462.0
- **Toast Notifications**: Sonner 1.5.0
- **SEO**: React Helmet Async 2.0.5
- **PWA Support**: Vite PWA Plugin 0.19.8

### Backend
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **API**: Supabase REST API and RPC functions
- **Serverless Functions**: Supabase Edge Functions (Deno)

### Deployment
- **Hosting**: Netlify
- **CI/CD**: Netlify build hooks

## Database Schema

### Core Tables
1. **user_profiles**
   - `id` (uuid, primary key, references auth.users)
   - `name` (text, not null)
   - `profile_picture_url` (text, nullable)
   - `created_at` (timestamptz)
   - `updated_at` (timestamptz)

2. **boards**
   - `id` (uuid, primary key)
   - `name` (text, not null)
   - `access_code` (text, references access_codes)
   - `share_code` (text, unique)
   - `owner_id` (uuid, references auth.users)
   - `member_ids` (uuid[], array of user IDs)
   - `is_public` (boolean, default false)
   - `created_at` (timestamptz)
   - `updated_at` (timestamptz)

3. **memories**
   - `id` (uuid, primary key)
   - `caption` (text, nullable)
   - `media_url` (text, nullable)
   - `is_video` (boolean, default false)
   - `event_date` (timestamp)
   - `location` (text, nullable)
   - `likes` (integer, default 0)
   - `is_liked` (boolean, nullable)
   - `access_code` (text, references access_codes)
   - `board_id` (uuid, references boards)
   - `created_by` (uuid, references auth.users)
   - `memory_type` (text, enum: 'photo', 'video', 'note', 'carousel')
   - `moderation_status` (text, enum: 'pending', 'approved', 'rejected')
   - `moderation_score` (numeric)
   - `moderated_at` (timestamptz)

4. **memory_media_items** (for carousel memories)
   - `id` (uuid, primary key)
   - `memory_id` (uuid, references memories)
   - `url` (text, not null)
   - `is_video` (boolean, default false)
   - `order` (integer, default 0)
   - `created_at` (timestamptz)

5. **comments**
   - `id` (uuid, primary key)
   - `memory_id` (uuid, references memories)
   - `user_id` (uuid, references user_profiles)
   - `content` (text, not null)
   - `parent_id` (uuid, self-reference for replies)
   - `created_at` (timestamptz)
   - `updated_at` (timestamptz)

6. **memory_drafts**
   - `id` (uuid, primary key)
   - `user_id` (uuid, references auth.users)
   - `board_id` (uuid, references boards)
   - `content` (jsonb, stores draft data)
   - `created_at` (timestamptz)
   - `updated_at` (timestamptz)

7. **access_codes**
   - `code` (text, primary key)
   - `name` (text, not null)
   - `created_at` (timestamptz)

8. **moderation_logs**
   - `id` (uuid, primary key)
   - `content_type` (text, enum: 'text', 'image', 'video')
   - `content_id` (uuid, nullable)
   - `user_id` (uuid, references auth.users)
   - `is_appropriate` (boolean)
   - `confidence_score` (decimal)
   - `flagged_categories` (text[])
   - `moderation_reason` (text)
   - `content_hash` (text)
   - `created_at` (timestamptz)

### Views
- **memories_with_likes** - View that includes memory data with total likes count

### Database Functions
- `create_board_with_owner` - Creates a new board with the creator as owner
- `add_user_to_board_by_share_code` - Adds a user to a board using the share code
- `rename_board` - Renames a board (owner only)
- `remove_board_member` - Removes a user from a board
- `toggle_memory_like_v3` - Toggles a user's like on a memory
- `get_memory_like_status` - Gets the like status for a memory
- `update_memory_details` - Updates memory caption, location, and date
- `get_memories_by_access_code_safe` - Safely fetches memories by access code
- `get_memories_by_access_codes_safe` - Safely fetches memories by multiple access codes

## Authentication System

- **Email/Password Authentication**: Standard email and password signup/login
- **Google OAuth**: Sign in with Google account
- **Password Reset**: Email-based password reset flow
- **Session Management**: JWT-based session management
- **Profile Creation**: Automatic user profile creation on signup

## Row-Level Security (RLS)

- **Boards**: Users can only access boards they own or are members of
- **Memories**: Users can only access memories in boards they have access to
- **Comments**: Users can only access comments on memories they can view
- **User Profiles**: Users can update only their own profile
- **Drafts**: Users can only access their own drafts

## Core Features

### User Management
- User registration and login
- Profile management (name, profile picture)
- Password reset
- Google OAuth integration

### Boards
- Create private or public boards
- Rename boards
- View board members
- Leave boards
- Join boards via share code
- Public boards discovery

### Memories
- Create different types of memories:
  - Photos
  - Videos
  - Text notes
  - Carousels (multiple photos/videos)
- Edit memory details (caption, date, location)
- Delete memories
- Like/unlike memories
- Comment on memories
- Reply to comments

### Memory Drafts
- Auto-save drafts while creating memories
- Manual save draft option
- Draft synchronization across devices
- Draft management (view, edit, delete)

### Content Moderation
- Client-side content moderation
- Inappropriate content detection
- Moderation logs

### Viewing Options
- Timeline view (detailed list)
- Grid view (visual gallery)
- Memory detail view

### Sharing
- Generate share codes for boards
- Copy invite links
- System share integration (mobile)

### Onboarding
- Interactive tutorial
- Help center
- Guided tour of features

## User Interface Components

### Layout Components
- Header with profile access
- Footer navigation
- Main content area

### Core Components
- MemoryCard - Displays a memory in timeline view
- MemoryGrid - Displays memories in grid view
- BoardCard - Displays a board in the boards list
- CommentSection - Displays and manages comments
- CarouselMemory - Displays multiple media items in a carousel

### Dialog Components
- UserProfileDialog - Edit user profile
- BoardMembersDialog - View board members
- BoardRenameDialog - Rename a board
- BoardInviteDialog - Share a board
- DraftsDialog - Manage memory drafts

### Form Components
- Memory creation form
- Comment form
- Profile edit form
- Board creation form

### Animation Components
- AuthAnimation - Background animation for auth pages
- FloatingHearts - Decorative floating hearts animation
- MemoryParticles - Particle animation for memory pages
- IntroAnimation - Initial app loading animation

### Utility Components
- ErrorBoundary - Catches and displays React errors
- LoadingSpinner - Loading indicator
- ScrollToBottom - Button to scroll to bottom of content
- SEOHelmet - Manages SEO meta tags
- TutorialOverlay - Interactive app tutorial

## API Structure

### Authentication API
- `signIn(email, password)` - Sign in with email/password
- `signUp(email, password, name)` - Register new user
- `signInWithGoogle()` - Sign in with Google
- `signOut()` - Sign out user
- `resetPasswordForEmail(email)` - Send password reset email
- `updateUser({ password })` - Update user password

### Boards API
- `fetchBoards(userId)` - Get all boards for a user
- `getBoardById(boardId, userId)` - Get a specific board
- `getBoardByShareCode(shareCode)` - Get a board by share code
- `createBoard(name, isPublic, userId)` - Create a new board
- `renameBoard(boardId, newName, userId)` - Rename a board
- `addUserToBoard(shareCode, userId)` - Add a user to a board
- `removeUserFromBoard(boardId, userId)` - Remove a user from a board

### Memories API
- `fetchMemories(accessCode)` - Get memories for a board
- `fetchMemoriesByAccessCodes(accessCodes)` - Get memories for multiple boards
- `getMemory(id)` - Get a specific memory
- `createMemory(memory)` - Create a new memory
- `updateMemory(id, updates)` - Update a memory
- `deleteMemory(id, accessCode)` - Delete a memory
- `toggleMemoryLike(id, accessCode)` - Toggle like on a memory
- `updateMemoryDetails(id, accessCode, updates)` - Update memory details

### Drafts API
- `fetchDrafts()` - Get all drafts for current user
- `saveDraft(draft)` - Save a draft
- `deleteDraft(id)` - Delete a draft
- `getDraftById(id)` - Get a specific draft

### Media API
- `uploadMediaToStorage(file, userId)` - Upload media to storage
- `uploadProfilePicture(file, userId)` - Upload profile picture
- `deleteProfilePicture(userId)` - Delete profile picture

## Client-Side Storage

### LocalStorage
- `thisisus_memory_drafts` - Stores memory drafts
- `thisisus_auth_state` - Stores auth form state
- `tutorialSeen` - Tracks if tutorial has been viewed

### Supabase Storage Buckets
- `memories` - Stores memory photos and videos
- `profile-pictures` - Stores user profile pictures

## PWA Features
- Installable web app
- Offline support
- Service worker for caching
- App manifest
- iOS-specific meta tags

## Performance Optimizations
- Lazy loading of images
- Optimized database queries with proper indexing
- Caching of frequently accessed data
- Debounced search and input handlers
- Optimized RLS policies to prevent recursion
- Efficient state management

## Security Features
- Row-Level Security (RLS) for all database tables
- Content moderation for uploaded media
- Secure authentication with JWT
- HTTPS-only communication
- Proper input validation and sanitization
- Rate limiting for sensitive operations

## Responsive Design
- Mobile-first approach
- Responsive layouts for all screen sizes
- Touch-friendly UI elements
- iOS safe area handling
- PWA support for mobile devices

## SEO Optimization
- Meta tags for all pages
- Open Graph tags for social sharing
- Twitter Card support
- Structured data (JSON-LD)
- Canonical URLs
- Descriptive page titles and descriptions

## Accessibility
- Semantic HTML
- ARIA attributes where needed
- Keyboard navigation support
- Screen reader friendly content
- Sufficient color contrast
- Focus management

## Error Handling
- Global error boundary
- Graceful API error handling
- Offline detection and handling
- User-friendly error messages
- Automatic retry for transient errors

## Development Tools
- TypeScript for type safety
- ESLint for code quality
- Vitest for testing
- Tailwind CSS for styling
- SWC for fast compilation

## Deployment
- Netlify for hosting
- Automatic deployments from Git
- Environment variable management
- Build optimization
- CDN distribution

## Future Enhancements
- Real-time updates with Supabase Realtime
- Advanced search functionality
- Export/import capabilities
- Enhanced analytics
- More social features
- Mobile app versions