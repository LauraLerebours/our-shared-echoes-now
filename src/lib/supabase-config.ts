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
  return value;
};

export const getSupabaseConfig = (): SupabaseConfig => {
  const url = validateEnvVar('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL);
  const anonKey = validateEnvVar('VITE_SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY);
  
  return {
    url,
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
  }
}