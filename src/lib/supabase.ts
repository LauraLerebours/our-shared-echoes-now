
import { createClient } from '@supabase/supabase-js';

// When using Lovable's Supabase integration, these values are automatically injected
// Use import.meta.env to access environment variables in Vite
const supabaseUrl = "https://hhcoeuedfeoudgxtttgn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoY29ldWVkZmVvdWRneHR0dGduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY4NDU4NDYsImV4cCI6MjA2MjQyMTg0Nn0.3MPbiHpdddcJipa-UxMaTBN8MfRBP1Bw_WiVX76Xt_w";

// We need to log the environment for debugging
console.log("Environment variables:", {
  hasSupabaseUrl: !!supabaseUrl,
  hasSupabaseAnonKey: !!supabaseAnonKey
});

// Initialize Supabase client with actual values or fallbacks
let clientUrl = supabaseUrl;
let clientKey = supabaseAnonKey;

// Check if Supabase URL and Anon Key are defined
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.");
  
  // Use fallback values for development (these won't actually work for real operations)
  clientUrl = "https://example.supabase.co";
  clientKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24ifQ.625_WdcF3KHqz5amU0x2X5WWHP-OEs_4qj0ssLNHzTs";
}

// Create and export the Supabase client
export const supabase = createClient(clientUrl, clientKey);

// Initialize Supabase resources
const initSupabaseResources = async () => {
  try {
    // Check if the memories table exists
    console.log("Checking if memories table exists...");
    const { error: checkTableError } = await supabase
      .from('memories')
      .select('id')
      .limit(1);
    
    if (checkTableError) {
      console.error("Error checking memories table:", checkTableError.message);
      console.log("It seems the memories table may not exist or has incorrect schema.");
      console.log("Please create the memories table with the following structure:");
      console.log(`
CREATE TABLE memories (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  image_url TEXT,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  location TEXT,
  likes INTEGER DEFAULT 0,
  is_liked BOOLEAN DEFAULT false,
  is_video BOOLEAN DEFAULT false,
  type TEXT NOT NULL
);`);
    } else {
      console.log("Memories table exists.");
    }

    // Create memories storage bucket if it doesn't exist
    try {
      console.log("Checking for existing buckets...");
      const { data: buckets, error: bucketListError } = await supabase.storage.listBuckets();
      
      if (bucketListError) {
        console.error("Error listing buckets:", bucketListError);
      } else {
        console.log("Buckets found:", buckets?.length || 0);
        
        const memoriesBucketExists = buckets?.some(bucket => bucket.name === 'memories');
        
        if (!memoriesBucketExists) {
          console.log("Creating memories bucket...");
          
          // Create a public bucket for memories
          const { error: createBucketError } = await supabase.storage.createBucket('memories', {
            public: true,
            fileSizeLimit: 10485760, // 10MB
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4']
          });
          
          if (createBucketError) {
            console.error("Error creating memories bucket:", createBucketError);
            console.log("To resolve this issue, please create a 'memories' bucket in your Supabase dashboard");
            console.log("Make sure to enable public access and set appropriate MIME types");
          } else {
            console.log("Memories bucket created successfully");
          }
        } else {
          console.log("Memories bucket already exists");
        }
      }
    } catch (bucketError) {
      console.error("Error checking or creating storage buckets:", bucketError);
    }
  } catch (error) {
    console.error("Error initializing Supabase resources:", error);
  }
};

// Initialize resources when this module is loaded
initSupabaseResources();

export type Profile = {
  id: string;
  username?: string;
  created_at?: string;
};
