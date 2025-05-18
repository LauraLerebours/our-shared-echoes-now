
import { createClient } from '@supabase/supabase-js';

// When using Lovable's Supabase integration, these values are automatically injected
// Use import.meta.env to access environment variables in Vite
const supabaseUrl = "https://hhcoeuedfeoudgxtttgn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhoY29ldWVkZmVvdWRneHR0dGduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY4NDU4NDYsImV4cCI6MjA2MjQyMTg0Nn0.3MPbiHpdddcJipa-UxMaTBN8MfRBP1Bw_WiVX76Xt_w";
~
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

// Create the memories bucket and ensure it exists before any operations
export const ensureMemoriesBucketExists = async () => {
  try {
    // Check if the memories bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error("Error listing buckets:", listError);
      return false;
    }
    
    const memoriesBucketExists = buckets?.some(bucket => bucket.name === 'memories');
    
    if (!memoriesBucketExists) {
      // Create the memories bucket with public access
      const { data, error: createError } = await supabase.storage.createBucket('memories', {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4']
      });
      
      if (createError) {
        console.error("Error creating memories bucket:", createError);
        console.log("To create the bucket manually, go to your Supabase dashboard and:");
        console.log("1. Navigate to the Storage section");
        console.log("2. Click 'New Bucket'");
        console.log("3. Name it 'memories'");
        console.log("4. Enable public access");
        console.log("5. Set file size limits to 10MB");
        console.log("6. Allow MIME types: image/png, image/jpeg, image/gif, image/webp, video/mp4");
        return false;
      }
      
      console.log("Successfully created memories bucket");
      return true;
    } else {
      console.log("Memories bucket already exists");
      return true;
    }
  } catch (error) {
    console.error("Error ensuring memories bucket exists:", error);
    return false;
  }
};

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
    await ensureMemoriesBucketExists();
    
  } catch (error) {
    console.error("Error initializing Supabase resources:", error);
  }
};

// Initialize resources when this module is loaded
initSupabaseResources();

// Utility function to upload a file to the memories bucket
export const uploadToMemories = async (filePath: string, file: File) => {
  try {
    // First, ensure the bucket exists
    const bucketExists = await ensureMemoriesBucketExists();
    
    if (!bucketExists) {
      throw new Error("Memories bucket does not exist and couldn't be created");
    }
    
    // Upload the file
    const { data, error } = await supabase.storage
      .from('memories')
      .upload(filePath, file);
      
    if (error) {
      throw error;
    }
    
    // Get the public URL
    const { data: publicUrlData } = supabase.storage
      .from('memories')
      .getPublicUrl(filePath);
      
    return { url: publicUrlData.publicUrl, error: null };
  } catch (error) {
    console.error('Error uploading file:', error);
    return { url: null, error };
  }
};

export type Profile = {
  id: string;
  username?: string;
  created_at?: string;
};
