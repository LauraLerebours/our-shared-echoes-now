
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
    // Check if memories table exists, if not, create it
    const { error: tableError } = await supabase.rpc('create_memories_table_if_not_exists', {});
    if (tableError) {
      console.log("Creating memories table manually...");
      // Create the memories table manually if the RPC doesn't exist
      const { error: createError } = await supabase.query(`
        CREATE TABLE IF NOT EXISTS public.memories (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL,
          image_url TEXT,
          caption TEXT,
          date TEXT NOT NULL,
          location TEXT,
          likes INTEGER DEFAULT 0,
          is_liked BOOLEAN DEFAULT false,
          is_video BOOLEAN DEFAULT false,
          type TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
        );
      `);
      if (createError) {
        console.error("Error creating memories table:", createError);
      } else {
        console.log("Memories table created successfully");
      }
    }

    // Check if memories bucket exists, if not, create it
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) {
      console.error("Error listing buckets:", bucketsError);
    } else {
      const memoriesBucket = buckets?.find(bucket => bucket.name === 'memories');
      
      if (!memoriesBucket) {
        console.log("Creating memories bucket...");
        const { error: createBucketError } = await supabase.storage.createBucket('memories', {
          public: true
        });
        
        if (createBucketError) {
          console.error("Error creating memories bucket:", createBucketError);
        } else {
          console.log("Memories bucket created successfully");
        }
      }
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
