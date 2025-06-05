import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if Supabase credentials are properly configured
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.");
  console.log("To get your Supabase credentials:");
  console.log("1. Go to https://supabase.com/dashboard");
  console.log("2. Create a new project or select an existing one");
  console.log("3. Go to Settings > API");
  console.log("4. Copy your Project URL and anon/public key");
  console.log("5. Set them in your .env file");
}

// Create Supabase client with environment variables
export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);

// Test the connection and provide helpful feedback
const testConnection = async () => {
  try {
    console.log("Testing Supabase connection...");
    const { data, error } = await supabase.from('memories').select('count', { count: 'exact', head: true });
    
    if (error) {
      if (error.message.includes('Failed to fetch')) {
        console.error("❌ Supabase connection failed: Invalid URL or network issue");
        console.log("Please check your VITE_SUPABASE_URL is correct");
      } else if (error.message.includes('JWT')) {
        console.error("❌ Supabase authentication failed: Invalid API key");
        console.log("Please check your VITE_SUPABASE_ANON_KEY is correct");
      } else if (error.message.includes('relation "memories" does not exist')) {
        console.error("❌ Database table 'memories' does not exist");
        console.log("Please create the memories table in your Supabase database");
      } else {
        console.error("❌ Supabase error:", error.message);
      }
      return false;
    }
    
    console.log("✅ Supabase connection successful");
    return true;
  } catch (err) {
    console.error("❌ Supabase connection test failed:", err);
    return false;
  }
};

// Test connection when module loads
testConnection();

// Storage bucket utilities
export const ensureMemoriesBucketExists = async (): Promise<boolean> => {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Cannot create bucket: Supabase not properly configured");
    return false;
  }

  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error("Error checking buckets:", listError.message);
      return false;
    }

    const memoriesBucket = buckets?.find(bucket => bucket.name === 'memories');
    
    if (memoriesBucket) {
      console.log("✅ Memories bucket already exists");
      return true;
    }

    // Create bucket if it doesn't exist
    const { error: createError } = await supabase.storage.createBucket('memories', {
      public: true,
      allowedMimeTypes: ['image/*', 'video/*'],
      fileSizeLimit: 10485760 // 10MB
    });

    if (createError) {
      console.error("Error creating memories bucket:", createError.message);
      return false;
    }

    console.log("✅ Memories bucket created successfully");
    return true;
  } catch (error) {
    console.error("Error managing memories bucket:", error);
    return false;
  }
};

// File upload utility
export const uploadToMemories = async (filePath: string, file: File) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { url: null, error: new Error("Supabase not configured") };
  }

  try {
    // Ensure bucket exists before uploading
    const bucketReady = await ensureMemoriesBucketExists();
    if (!bucketReady) {
      return { url: null, error: new Error("Could not prepare storage bucket") };
    }

    // Upload the file
    const { data, error } = await supabase.storage
      .from('memories')
      .upload(filePath, file);
      
    if (error) {
      console.error('Upload error:', error);
      return { url: null, error };
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