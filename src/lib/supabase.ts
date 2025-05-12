
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

// SQL command to create memories table if it doesn't exist
const createMemoriesTableSQL = `
  CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    image_url TEXT,
    caption TEXT,
    date TIMESTAMPTZ NOT NULL,
    location TEXT,
    likes INTEGER DEFAULT 0,
    is_liked BOOLEAN DEFAULT false,
    is_video BOOLEAN DEFAULT false,
    type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  -- Enable Row Level Security
  ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
  
  -- Create policy for authenticated users to see only their own memories
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT FROM pg_policies WHERE tablename = 'memories' AND policyname = 'Users can view their own memories'
    ) THEN
      CREATE POLICY "Users can view their own memories" ON memories
        FOR SELECT USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (
      SELECT FROM pg_policies WHERE tablename = 'memories' AND policyname = 'Users can insert their own memories'
    ) THEN
      CREATE POLICY "Users can insert their own memories" ON memories
        FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (
      SELECT FROM pg_policies WHERE tablename = 'memories' AND policyname = 'Users can update their own memories'
    ) THEN
      CREATE POLICY "Users can update their own memories" ON memories
        FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (
      SELECT FROM pg_policies WHERE tablename = 'memories' AND policyname = 'Users can delete their own memories'
    ) THEN
      CREATE POLICY "Users can delete their own memories" ON memories
        FOR DELETE USING (auth.uid() = user_id);
    END IF;
  END
  $$;
`;

// Initialize Supabase resources
const initSupabaseResources = async () => {
  try {
    // First, try to create the memories table using raw SQL
    try {
      console.log("Attempting to create memories table if it doesn't exist...");
      const { error: sqlError } = await supabase.rpc('exec_sql', { sql: createMemoriesTableSQL });
      
      if (sqlError) {
        console.log("SQL execution failed, trying alternative approach:", sqlError);
        
        // Try an alternative approach - check if the table exists by querying it
        try {
          const { error: checkError } = await supabase.from('memories').select('id').limit(1);
          
          if (checkError && checkError.code === '42P01') {
            // Table doesn't exist, we need to manually notify user
            console.error("The memories table does not exist in your Supabase database.");
            console.log("Please create the memories table with the following structure:");
            console.log(createMemoriesTableSQL);
          } else if (!checkError) {
            console.log("Memories table exists.");
          }
        } catch (e) {
          console.error("Error checking if memories table exists:", e);
        }
      } else {
        console.log("Successfully created or verified memories table");
      }
    } catch (sqlExecError) {
      console.error("Error executing SQL:", sqlExecError);
    }

    // Create memories storage bucket if it doesn't exist
    try {
      console.log("Checking for existing buckets...");
      const { data: buckets, error: bucketListError } = await supabase.storage.listBuckets();
      
      if (bucketListError) {
        console.error("Error listing buckets:", bucketListError);
        // If we can't list buckets, we might not have permission, 
        // let's try to use the bucket anyway
      } else {
        console.log("Buckets found:", buckets?.length || 0);
        
        const memoriesBucketExists = buckets?.some(bucket => bucket.name === 'memories');
        
        if (!memoriesBucketExists) {
          console.log("Creating memories bucket...");
          
          // First, check if user has permission to create buckets
          const { data, error: createBucketError } = await supabase.storage.createBucket('memories', {
            public: true,
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4'],
            fileSizeLimit: 10485760 // 10MB
          });
          
          if (createBucketError) {
            console.error("Error creating memories bucket:", createBucketError);
            
            // If we get a permission error, the bucket might need to be created manually
            if (createBucketError.message?.includes('permission') || 
                createBucketError.message?.includes('policy')) {
              console.log("To resolve this issue, please create a 'memories' bucket in your Supabase dashboard");
              console.log("Make sure to enable public access and set appropriate MIME types");
            }
          } else {
            console.log("Memories bucket created successfully:", data);
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
