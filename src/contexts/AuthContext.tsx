import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type UserProfile = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type AuthContextType = {
  user: User | null;
  userProfile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any, user: any }>;
  signOut: () => Promise<void>;
  updateProfile: (name: string) => Promise<{ error: any }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      console.log('Fetching user profile for:', userId);
      
      // Get user profile with retry logic
      let retries = 3;
      let data = null;
      let error = null;

      while (retries > 0 && !data) {
        const result = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        data = result.data;
        error = result.error;

        if (error) {
          console.error('Error fetching user profile (attempt', 4 - retries, '):', error);
          retries--;
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
          }
        } else {
          break;
        }
      }

      if (error) {
        console.error('Final error fetching user profile:', error);
        return null;
      }

      if (data) {
        console.log('User profile found:', data);
        return data as UserProfile;
      }

      console.log('No profile found for user:', userId);
      return null;
    } catch (error) {
      console.error('Unexpected error in fetchUserProfile:', error);
      return null;
    }
  };

  const signOut = async () => {
    try {
      console.log('Signing out...');
      setLoading(true);
      
      const { error } = await supabase.auth.signOut();
      
      // Check for specific Supabase errors that indicate the session is already invalid
      if (error) {
        // If it's a session_not_found error or 403 status, log a warning but don't throw
        if (error.message?.includes('session_not_found') || 
            error.message?.includes('Session from session_id claim in JWT does not exist') ||
            (error as any)?.status === 403) {
          console.warn('Session already invalid on server, proceeding with client-side logout:', error.message);
        } else {
          // For other errors, still throw
          throw error;
        }
      }
      
      // Always clear local state regardless of server response
      setUser(null);
      setUserProfile(null);
      setSession(null);
      console.log('Sign out successful');
    } catch (error) {
      console.error('Sign out error:', error);
      // Even if there's an error, clear local state to ensure user appears logged out
      setUser(null);
      setUserProfile(null);
      setSession(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('AuthContext: Initializing...');
    
    // Get initial session first
    const getInitialSession = async () => {
      try {
        console.log('Getting initial session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting initial session:', error);
          setLoading(false);
          return;
        }
        
        console.log('Initial session:', session?.user?.email || 'No session');
        
        if (session?.user) {
          setSession(session);
          setUser(session.user);
          
          // Fetch profile with delay to ensure database is ready
          setTimeout(async () => {
            const profile = await fetchUserProfile(session.user.id);
            setUserProfile(profile);
            setLoading(false);
          }, 500);
        } else {
          setLoading(false);
        }
        
      } catch (error) {
        console.error('Error initializing auth:', error);
        setLoading(false);
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email || 'No user');
        
        // Handle token refresh errors by signing out the user
        if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed successfully');
        } else if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESH_ERROR') {
          if (event === 'TOKEN_REFRESH_ERROR') {
            console.warn('Token refresh failed, signing out user');
          }
          // Clear all auth state
          setSession(null);
          setUser(null);
          setUserProfile(null);
          setLoading(false);
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          console.log('User found, fetching profile...');
          // Add delay for profile fetch to ensure database consistency
          setTimeout(async () => {
            const profile = await fetchUserProfile(session.user.id);
            setUserProfile(profile);
            setLoading(false);
          }, 500);
        } else {
          setUserProfile(null);
          setLoading(false);
        }
      }
    );

    // Get initial session
    getInitialSession();

    return () => {
      console.log('Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Attempting sign in for:', email);
      setLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        setLoading(false);
        return { error };
      }

      if (!data.session) {
        console.error('No session after sign in');
        setLoading(false);
        return { error: new Error('No session created') };
      }

      console.log('Sign in successful');
      // Don't set loading to false here - let the auth state change handler do it
      return { error: null };
    } catch (err) {
      console.error('Sign in exception:', err);
      setLoading(false);
      return { error: err };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      console.log('Attempting sign up for:', email, 'with name:', name);
      setLoading(true);
      
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth?type=signup`,
          data: {
            name: name.trim(),
          }
        }
      });

      if (error) {
        console.error('Sign up error:', error);
        setLoading(false);
        return { error, user: null };
      }

      console.log('Sign up successful:', data.user?.email);
      setLoading(false);
      return { error: null, user: data.user };
    } catch (err) {
      console.error('Sign up exception:', err);
      setLoading(false);
      return { error: err, user: null };
    }
  };

  const updateProfile = async (name: string) => {
    if (!user) {
      return { error: new Error('No user logged in') };
    }

    try {
      console.log('Updating profile for user:', user.id, 'with name:', name);
      const { error } = await supabase
        .from('user_profiles')
        .update({ name: name.trim() })
        .eq('id', user.id);

      if (error) {
        console.error('Update profile error:', error);
        return { error };
      }

      // Refresh the profile
      const updatedProfile = await fetchUserProfile(user.id);
      setUserProfile(updatedProfile);

      console.log('Profile updated successfully');
      return { error: null };
    } catch (err) {
      console.error('Update profile exception:', err);
      return { error: err };
    }
  };

  const value = {
    user,
    userProfile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
  };

  console.log('AuthContext render - Loading:', loading, 'User:', user?.email || 'None', 'Profile:', userProfile?.name || 'None');

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}