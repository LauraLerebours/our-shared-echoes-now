import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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
  const authStateRef = useRef<{ isActive: boolean }>({ isActive: true });

  const fetchUserProfile = async (userId: string) => {
    try {
      console.log('🔄 Fetching user profile for:', userId);
      
      // Check if component is still mounted and auth is active
      if (!authStateRef.current.isActive) {
        console.log('⚠️ Auth state no longer active, aborting profile fetch');
        return null;
      }
      
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
  };

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

  useEffect(() => {
    // Reset the auth state ref when component mounts
    authStateRef.current.isActive = true;
    
    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('🔄 Getting initial session...');
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Error getting initial session:', error);
          
          // Check if the error is related to invalid refresh token
          if (error.message?.includes('Invalid Refresh Token') || 
              error.message?.includes('Refresh Token Not Found')) {
            console.log('⚠️ Invalid refresh token detected, clearing session...');
            // Clear any stale session data
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setUserProfile(null);
          }
        } else {
          console.log('✅ Initial session retrieved:', !!session);
          
          // Check if component is still mounted and auth is active
          if (!authStateRef.current.isActive) {
            console.log('⚠️ Auth state no longer active, aborting session setup');
            return;
          }
          
          setSession(session);
          setUser(session?.user ?? null);
          
          // Fetch user profile if user exists
          if (session?.user) {
            const profile = await fetchUserProfile(session.user.id);
            
            // Check again if component is still mounted and auth is active
            if (authStateRef.current.isActive) {
              setUserProfile(profile);
            }
          }
        }
      } catch (error) {
        console.error('❌ Error getting initial session:', error);
        
        // Handle any other authentication errors by clearing session
        try {
          await supabase.auth.signOut();
        } catch (signOutError) {
          console.error('❌ Error during signOut cleanup:', signOutError);
        }
        
        setSession(null);
        setUser(null);
        setUserProfile(null);
      } finally {
        // Only update loading state if component is still mounted and auth is active
        if (authStateRef.current.isActive) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event, session?.user?.email);
        
        // Check if component is still mounted and auth is active
        if (!authStateRef.current.isActive) {
          console.log('⚠️ Auth state no longer active, aborting auth state change handling');
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (session?.user) {
          // Fetch user profile
          const profile = await fetchUserProfile(session.user.id);
          
          // Check again if component is still mounted and auth is active
          if (!authStateRef.current.isActive) {
            console.log('⚠️ Auth state no longer active, aborting profile update');
            return;
          }
          
          setUserProfile(profile);

          // Create user profile if it doesn't exist
          if (event === 'SIGNED_IN' && !profile) {
            try {
              console.log('🔄 Creating user profile for new user');
              
              const { error: insertError } = await supabase
                .from('user_profiles')
                .insert({
                  id: session.user.id,
                  name: session.user.user_metadata?.name || 'User',
                });

              if (insertError) {
                console.error('❌ Error creating user profile:', insertError);
              } else {
                // Fetch the newly created profile
                const newProfile = await fetchUserProfile(session.user.id);
                
                // Check again if component is still mounted and auth is active
                if (authStateRef.current.isActive) {
                  setUserProfile(newProfile);
                  console.log('✅ User profile created successfully');
                }
              }
            } catch (error) {
              console.error('❌ Error handling user profile:', error);
            }
          }
        } else {
          // Clear user profile when user signs out
          setUserProfile(null);
        }
      }
    );

    return () => {
      // Mark auth state as inactive when component unmounts
      authStateRef.current.isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔄 Signing in user:', email);
      
      // Clear any existing session first to prevent token conflicts
      await supabase.auth.signOut();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Sign in error:', error);
        return { error };
      }

      console.log('✅ Sign in successful');
      
      // Explicitly set the user and session
      setUser(data.user);
      setSession(data.session);
      
      // Fetch user profile
      if (data.user) {
        const profile = await fetchUserProfile(data.user.id);
        setUserProfile(profile);
      }
      
      return { error: null };
    } catch (error) {
      console.error('❌ Sign in error:', error);
      return { error: error as AuthError };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      console.log('🔄 Signing up user:', email);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
          },
          emailRedirectTo: `${window.location.origin}/auth?type=signup`,
        },
      });

      if (error) {
        console.error('❌ Sign up error:', error);
        return { error, user: null };
      }

      console.log('✅ Sign up successful');
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
      
      // Mark auth state as inactive to cancel any ongoing operations
      authStateRef.current.isActive = false;
      
      // Cancel any in-flight requests
      // This is handled in the hooks by checking isSigningOut
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('❌ Sign out error:', error);
      }
      
      // Clear user profile state
      setUserProfile(null);
      setUser(null);
      setSession(null);
      
      console.log('✅ Sign out successful');
    } catch (error) {
      console.error('❌ Sign out error:', error);
    } finally {
      setIsSigningOut(false);
      
      // Reset auth state to active after signout completes
      // This is important for when the user signs in again
      authStateRef.current.isActive = true;
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