// Supabase configuration with environment validation
interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

const validateEnvVar = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  
  // Check for placeholder values
  if (value.includes('your_supabase_url_here') || value.includes('your_supabase_anon_key_here')) {
    throw new Error(`Environment variable ${name} is still set to placeholder value. Please update your .env file with actual Supabase credentials.`);
  }
  
  return value;
};

const validateSupabaseUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    if (!urlObj.hostname.includes('supabase')) {
      throw new Error('URL does not appear to be a valid Supabase URL');
    }
    return url;
  } catch (error) {
    throw new Error(`Invalid Supabase URL format: ${url}. Please check your VITE_SUPABASE_URL in the .env file.`);
  }
};

export const getSupabaseConfig = (): SupabaseConfig => {
  const url = validateEnvVar('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL);
  const anonKey = validateEnvVar('VITE_SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY);
  
  // Validate URL format
  const validatedUrl = validateSupabaseUrl(url);
  
  return {
    url: validatedUrl,
    anonKey,
    serviceRoleKey: import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  };
};

// Validate configuration on module load
try {
  getSupabaseConfig();
} catch (error) {
  console.error('Supabase configuration error:', error);
  // In development, show a helpful error message
  if (import.meta.env.DEV) {
    console.error('Please check your .env file and ensure all required Supabase environment variables are set.');
    console.error('You can find your Supabase URL and anon key in your Supabase project settings under the API section.');
  }
}