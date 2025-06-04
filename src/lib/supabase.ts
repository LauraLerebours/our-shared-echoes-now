import { createClient } from '@supabase/supabase-js';

// When using Lovable's Supabase integration, these values are automatically injected
// Use import.meta.env to access environment variables in Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;  // Ensure these are set in your .env file
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;  // Initialize Supabase client with actual values or fallbacks
let clientUrl = supabaseUrl;
let clientKey = supabaseAnonKey;



// Create and export the Supabase client
export const supabase = createClient(clientUrl, clientKey);

// Assume bucket already exists and skip creation attempts
export const ensureMemoriesBucketExists = async (): Promise<boolean> => {
  // Return true since we're assuming the bucket exists
  return true;
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
    
  } catch (error) {
    console.error("Error initializing Supabase resources:", error);
  }
};

// Initialize resources when this module is loaded
initSupabaseResources();

// Utility function to upload a file to the memories bucket
export const uploadToMemories = async (filePath: string, file: File) => {
  try {
    // Upload the file directly, assuming bucket exists
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