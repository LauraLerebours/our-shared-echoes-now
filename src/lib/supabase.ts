
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
      // Create the memories table using createTable instead of direct SQL query
      const { error: createError } = await supabase.from('memories').insert({
        id: '00000000-0000-0000-0000-000000000000',
        user_id: '00000000-0000-0000-0000-000000000000',
        date: new Date().toISOString(),
        likes: 0,
        is_liked: false,
        type: 'memory'
      }).select();
      
      if (createError) {
        // If we get an error because the table already exists, that's fine
        if (createError.message && !createError.message.includes('already exists')) {
          console.error("Error creating memories table:", createError);
        }
      } else {
        console.log("Memories table created successfully");
        // Delete the dummy row we created
        await supabase.from('memories').delete().eq('id', '00000000-0000-0000-0000-000000000000');
      }
    }

    // Create memories storage bucket if it doesn't exist
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      
      const memoriesBucketExists = buckets?.some(bucket => bucket.name === 'memories');
      
      if (!memoriesBucketExists) {
        console.log("Creating memories bucket...");
        const { data, error: createBucketError } = await supabase.storage.createBucket('memories', {
          public: true,
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4'],
          fileSizeLimit: 10485760 // 10MB
        });
        
        if (createBucketError) {
          console.error("Error creating memories bucket:", createBucketError);
        } else {
          console.log("Memories bucket created successfully:", data);
        }
      } else {
        console.log("Memories bucket already exists");
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
