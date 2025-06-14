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
      console.log('🔄 [AuthContext] Fetching user profile for:', userId);
      
      // Check if component is still mounted and auth is active
      if (!authStateRef.current.isActive) {
        console.log('⚠️ [AuthContext] Auth state no longer active, aborting profile fetch');
        return null;
      }
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ [AuthContext] Error fetching user profile:', error);
        
        // Check if this is a "not found" error, which might indicate we need to create the profile
        if (error.code === 'PGRST116') {
          console.log('⚠️ [AuthContext] User profile not found, will attempt to create it');
          return null;
        }
        
        return null;
      }

      console.log('✅ [AuthContext] User profile fetched successfully:', data.name);
      return data;
    } catch (error) {
      console.error('❌ [AuthContext] Error fetching user profile:', error);
      return null;
    }
  };

  const updateProfile = async (name: string) => {
    if (!user) {
      return { error: new Error('No user logged in') };
    }

    try {
      console.log('🔄 [AuthContext] Updating user profile:', name);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .update({ name })
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error('❌ [AuthContext] Error updating profile:', error);
        return { error: new Error(error.message) };
      }

      console.log('✅ [AuthContext] Profile updated successfully');
      setUserProfile(data);
      return { error: null };
    } catch (error) {
      console.error('❌ [AuthContext] Error updating profile:', error);
      return { error: error as Error };
    }
  };

  const createUserProfile = async (userId: string, name: string = 'User') => {
    try {
      console.log('🔄 [AuthContext] Creating user profile for:', userId);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .insert([{ id: userId, name }])
        .select()
        .single();
        
      if (error) {
        console.error('❌ [AuthContext] Error creating user profile:', error);
        return null;
      }
      
      console.log('✅ [AuthContext] User profile created successfully');
      return data;
    } catch (error) {
      console.error('❌ [AuthContext] Error creating user profile:', error);
      return null;
    }
  };

  useEffect(() => {
    // Reset the auth state ref when component mounts
    authStateRef.current.isActive = true;
    
    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('🔄 [AuthContext] Getting initial session...');
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ [AuthContext] Error getting initial session:', error);
          
          // Check if the error is related to invalid refresh token
          if (error.message?.includes('Invalid Refresh Token') || 
              error.message?.includes('Refresh Token Not Found')) {
            console.log('⚠️ [AuthContext] Invalid refresh token detected, clearing session...');
            // Clear any stale session data
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setUserProfile(null);
          }
        } else {
          console.log('✅ [AuthContext] Initial session retrieved:', !!session);
          
          // Check if component is still mounted and auth is active
          if (!authStateRef.current.isActive) {
            console.log('⚠️ [AuthContext] Auth state no longer active, aborting session setup');
            return;
          }
          
          setSession(session);
          setUser(session?.user ?? null);
          
          // Fetch user profile if user exists
          if (session?.user) {
            console.log('🔄 [AuthContext] User found in session, fetching profile');
            const profile = await fetchUserProfile(session.user.id);
            
            // If profile doesn't exist, create it
            if (!profile && authStateRef.current.isActive) {
              console.log('🔄 [AuthContext] Profile not found, creating new profile');
              const name = session.user.user_metadata?.name || 'User';
              const newProfile = await createUserProfile(session.user.id, name);
              
              if (authStateRef.current.isActive) {
                setUserProfile(newProfile);
              }
            } else if (authStateRef.current.isActive) {
              setUserProfile(profile);
            }
          }
        }
      } catch (error) {
        console.error('❌ [AuthContext] Error getting initial session:', error);
        
        // Handle any other authentication errors by clearing session
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setUserProfile(null);
      } finally {
        // Only update loading state if component is still mounted and auth is active
        if (authStateRef.current.isActive) {
          console.log('✅ [AuthContext] Initial auth check complete, setting loading=false');
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 [AuthContext] Auth state changed:', event, session?.user?.email);
        
        // Check if component is still mounted and auth is active
        if (!authStateRef.current.isActive) {
          console.log('⚠️ [AuthContext] Auth state no longer active, aborting auth state change handling');
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (event === 'SIGNED_OUT') {
          console.log('🔄 [AuthContext] User signed out, clearing profile');
          setUserProfile(null);
          setLoading(false);
          return;
        }

        if (session?.user) {
          console.log('🔄 [AuthContext] User authenticated, fetching profile');
          // Fetch user profile
          const profile = await fetchUserProfile(session.user.id);
          
          // Check again if component is still mounted and auth is active
          if (!authStateRef.current.isActive) {
            console.log('⚠️ [AuthContext] Auth state no longer active, aborting profile update');
            return;
          }
          
          // Create user profile if it doesn't exist
          if (event === 'SIGNED_IN' && !profile) {
            try {
              console.log('🔄 [AuthContext] Creating user profile for new user');
              
              const { error: insertError } = await supabase
                .from('user_profiles')
                .insert({
                  id: session.user.id,
                  name: session.user.user_metadata?.name || 'User',
                });

              if (insertError) {
                console.error('❌ [AuthContext] Error creating user profile:', insertError);
              } else {
                // Fetch the newly created profile
                const newProfile = await fetchUserProfile(session.user.id);
                
                // Check again if component is still mounted and auth is active
                if (authStateRef.current.isActive) {
                  setUserProfile(newProfile);
                  console.log('✅ [AuthContext] User profile created successfully');
                }
              }
            } catch (error) {
              console.error('❌ [AuthContext] Error handling user profile:', error);
            }
          } else {
            setUserProfile(profile);
          }
        } else {
          // Clear user profile when user signs out
          setUserProfile(null);
        }
        
        setLoading(false);
      }
    );

    return () => {
      // Mark auth state as inactive when component unmounts
      console.log('🧹 [AuthContext] Cleanup: component unmounting');
      authStateRef.current.isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔄 [AuthContext] Signing in user:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ [AuthContext] Sign in error:', error);
        return { error };
      }

      console.log('✅ [AuthContext] Sign in successful');
      return { error: null };
    } catch (error) {
      console.error('❌ [AuthContext] Sign in error:', error);
      return { error: error as AuthError };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      console.log('🔄 [AuthContext] Signing up user:', email);
      
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
        console.error('❌ [AuthContext] Sign up error:', error);
        return { error, user: null };
      }

      console.log('✅ [AuthContext] Sign up successful');
      return { error: null, user: data.user };
    } catch (error) {
      console.error('❌ [AuthContext] Sign up error:', error);
      return { error: error as AuthError, user: null };
    }
  };

  const signOut = async () => {
    try {
      console.log('🔄 [AuthContext] Signing out user');
      setIsSigningOut(true);
      
      // Mark auth state as inactive to cancel any ongoing operations
      authStateRef.current.isActive = false;
      
      // Cancel any in-flight requests
      // This is handled in the hooks by checking isSigningOut
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('❌ [AuthContext] Sign out error:', error);
      }
      
      // Clear user profile state
      setUserProfile(null);
      setUser(null);
      setSession(null);
      
      console.log('✅ [AuthContext] Sign out successful');
    } catch (error) {
      console.error('❌ [AuthContext] Sign out error:', error);
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