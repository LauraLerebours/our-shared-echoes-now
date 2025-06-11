# This Is Us - Shared Memory App

A beautiful application for couples to capture and share their memories together.

## Features

- 📸 **Photo & Video Memories** - Upload and organize your special moments
- 📝 **Notes** - Write down thoughts and memories
- 👥 **Collaborative Boards** - Share memory boards with your partner
- 🔗 **Easy Sharing** - Share boards with unique codes
- 📱 **Mobile Responsive** - Works perfectly on all devices
- 🔒 **Secure** - Your memories are private and secure

## Setup

### Prerequisites

- Node.js 18+ 
- A Supabase account and project

### Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Supabase credentials in the `.env` file:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

   You can find these values in your Supabase project dashboard:
   - Go to Settings → API
   - Copy the "Project URL" for `VITE_SUPABASE_URL`
   - Copy the "anon public" key for `VITE_SUPABASE_ANON_KEY`

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:8080`

### Database Setup

The app uses Supabase for the backend. The database schema is automatically set up through migrations in the `supabase/migrations` folder.

Make sure to:
1. Enable Row Level Security (RLS) on all tables
2. Set up authentication in your Supabase project
3. Configure storage buckets for media uploads

### Deployment

To deploy to production:

```bash
npm run build
```

The built files will be in the `dist` folder, ready for deployment to any static hosting service.

## Usage

1. **Sign Up/Sign In** - Create an account or sign in with your existing account
2. **Create a Board** - Start by creating your first memory board
3. **Add Memories** - Upload photos, videos, or write notes
4. **Share with Partner** - Use the share code to invite your partner to collaborate
5. **Enjoy Together** - Build your shared memory collection over time

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **UI Components**: Radix UI + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Deployment**: Netlify

## Contributing

This is a personal project, but feel free to fork and customize it for your own use!

## License

MIT License - feel free to use this code for your own projects.