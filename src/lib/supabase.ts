
import { createClient } from '@supabase/supabase-js';

// When using Lovable's Supabase integration, these values are automatically injected
// Use import.meta.env to access environment variables in Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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

export type Profile = {
  id: string;
  username?: string;
  created_at?: string;
};
