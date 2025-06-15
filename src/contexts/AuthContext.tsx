import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: AuthError | null; user: User | null }>;
  signOut: () => Promise<void>;
  updateProfile: (name: string) => Promise<{ error: Error | null }>;
  isSigningOut: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Fetch user profile function - simplified and more direct
  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      console.log('🔄 Fetching user profile for:', userId);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ Error fetching user profile:', error);
        return null;
      }

      console.log('✅ User profile fetched successfully:', data.name);
      return data;
    } catch (error) {
      console.error('❌ Error fetching user profile:', error);
      return null;
    }
  }, []);

  // Create or update user profile
  const createOrUpdateProfile = useCallback(async (userId: string, name: string) => {
    try {
      console.log('🔄 Creating/updating user profile for:', userId);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          name: name || 'User',
        }, {
          onConflict: 'id',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('❌ Error creating/updating user profile:', error);
        return null;
      }

      // Fetch the profile after upsert
      return await fetchUserProfile(userId);
    } catch (error) {
      console.error('❌ Error creating/updating user profile:', error);
      return null;
    }
  }, [fetchUserProfile]);

  // Update profile function
  const updateProfile = async (name: string) => {
    if (!user) {
      return { error: new Error('No user logged in') };
    }

    try {
      console.log('🔄 Updating user profile:', name);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .update({ name })
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating profile:', error);
        return { error: new Error(error.message) };
      }

      console.log('✅ Profile updated successfully');
      setUserProfile(data);
      return { error: null };
    } catch (error) {
      console.error('❌ Error updating profile:', error);
      return { error: error as Error };
    }
  };

  // Initialize auth state once on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('🔄 Initializing auth state...');
        
        // Get current session
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Error getting session:', error);
          setLoading(false);
          setAuthInitialized(true);
          return;
        }
        
        if (currentSession) {
          console.log('✅ Session found:', currentSession.user.email);
          setSession(currentSession);
          setUser(currentSession.user);
          
          // Fetch user profile
          const profile = await fetchUserProfile(currentSession.user.id);
          
          if (profile) {
            console.log('✅ User profile found:', profile.name);
            setUserProfile(profile);
          } else {
            console.log('⚠️ No user profile found, creating one');
            // Create profile if it doesn't exist
            const newProfile = await createOrUpdateProfile(
              currentSession.user.id, 
              currentSession.user.user_metadata?.name || 'User'
            );
            
            if (newProfile) {
              console.log('✅ User profile created:', newProfile.name);
              setUserProfile(newProfile);
            }
          }
        } else {
          console.log('ℹ️ No active session found');
        }
        
        setLoading(false);
        setAuthInitialized(true);
      } catch (error) {
        console.error('❌ Error initializing auth:', error);
        setLoading(false);
        setAuthInitialized(true);
      }
    };

    initializeAuth();
  }, [fetchUserProfile, createOrUpdateProfile]);

  // Set up auth state change listener after initial load
  useEffect(() => {
    if (!authInitialized) return;
    
    console.log('🔄 Setting up auth state change listener');
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('🔔 Auth state changed:', event, newSession?.user?.email);
        
        if (isSigningOut) {
          console.log('⚠️ Ignoring auth state change during sign out');
          return;
        }
        
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
          setUserProfile(null);
          return;
        }
        
        if (newSession) {
          setSession(newSession);
          setUser(newSession.user);
          
          // Only fetch profile if user changed
          if (newSession.user.id !== userProfile?.id) {
            const profile = await fetchUserProfile(newSession.user.id);
            
            if (profile) {
              setUserProfile(profile);
            } else if (event === 'SIGNED_IN') {
              // Create profile if it doesn't exist and we just signed in
              const newProfile = await createOrUpdateProfile(
                newSession.user.id,
                newSession.user.user_metadata?.name || 'User'
              );
              
              if (newProfile) {
                setUserProfile(newProfile);
              }
            }
          }
        }
      }
    );

    return () => {
      console.log('🧹 Cleaning up auth state change listener');
      subscription.unsubscribe();
    };
  }, [authInitialized, fetchUserProfile, createOrUpdateProfile, isSigningOut, userProfile?.id]);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔄 Signing in user:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Sign in error:', error);
        return { error };
      }

      console.log('✅ Sign in successful');
      return { error: null };
    } catch (error) {
      console.error('❌ Sign in error:', error);
      return { error: error as AuthError };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      console.log('🔄 Signing up user:', email);
      
      // Disable email confirmation for development
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
          },
          // Comment out emailRedirectTo to disable email confirmation
          // emailRedirectTo: `${window.location.origin}/auth?type=signup`,
        },
      });

      if (error) {
        console.error('❌ Sign up error:', error);
        return { error, user: null };
      }

      console.log('✅ Sign up successful');
      
      // If email confirmation is disabled, create user profile immediately
      if (data.user) {
        await createOrUpdateProfile(data.user.id, name);
      }
      
      return { error: null, user: data.user };
    } catch (error) {
      console.error('❌ Sign up error:', error);
      return { error: error as AuthError, user: null };
    }
  };

  const signOut = async () => {
    try {
      console.log('🔄 Signing out user');
      setIsSigningOut(true);
      
      // Clear user state immediately to prevent UI inconsistencies
      setUserProfile(null);
      setUser(null);
      setSession(null);
      
      // Check if there's an active session with Supabase before attempting to sign out
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.warn('⚠️ Error checking session during sign out:', sessionError.message);
        // Continue with sign out attempt even if session check fails
      }
      
      // Only call supabase.auth.signOut() if there's an active session
      if (currentSession) {
        console.log('🔄 Active session found, proceeding with sign out');
        const { error } = await supabase.auth.signOut();
        
        if (error) {
          // Check if the error is related to session not existing
          const isSessionError = error.message?.includes('Session from session_id claim in JWT does not exist') ||
                                error.message?.includes('Auth session missing') ||
                                error.message?.includes('session_not_found');
          
          if (isSessionError) {
            // Log as warning but don't treat as critical failure
            console.warn('⚠️ Session already expired or invalid during sign out:', error.message);
          } else {
            // For other types of errors, log as error and re-throw
            console.error('❌ Sign out error:', error);
            throw error;
          }
        }
      } else {
        console.log('ℹ️ No active session found, skipping server sign out');
      }
      
      console.log('✅ Sign out successful');
    } catch (error) {
      console.error('❌ Sign out error:', error);
      // Re-throw non-session errors so calling components can handle them
      throw error;
    } finally {
      setIsSigningOut(false);
    }
  };

  const value = {
    user,
    session,
    userProfile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    isSigningOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};