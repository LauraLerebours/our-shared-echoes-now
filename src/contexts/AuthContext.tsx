import React, { createContext, useContext, useEffect, useState } from 'react';
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

  const fetchUserProfile = async (userId: string) => {
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
          setSession(session);
          setUser(session?.user ?? null);
          
          // Fetch user profile if user exists
          if (session?.user) {
            const profile = await fetchUserProfile(session.user.id);
            setUserProfile(profile);
          }
        }
      } catch (error) {
        console.error('❌ Error getting initial session:', error);
        
        // Handle any other authentication errors by clearing session
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setUserProfile(null);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event, session?.user?.email);
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (session?.user) {
          // Fetch user profile
          const profile = await fetchUserProfile(session.user.id);
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
                setUserProfile(newProfile);
                console.log('✅ User profile created successfully');
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

    return () => subscription.unsubscribe();
  }, []);

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
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('❌ Sign out error:', error);
      }
      // Clear user profile state
      setUserProfile(null);
      console.log('✅ Sign out successful');
    } catch (error) {
      console.error('❌ Sign out error:', error);
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};