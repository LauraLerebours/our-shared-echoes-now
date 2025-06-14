import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
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

// Create a local storage key for caching the user profile
const USER_PROFILE_CACHE_KEY = 'thisisus_user_profile';
// Flag to track if this is an initial page load or a refresh
const isPageRefresh = window.performance && window.performance.navigation && 
                     (window.performance.navigation.type === 1 || 
                      document.referrer.includes(window.location.host));

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
  const profileFetchAttempts = useRef<number>(0);
  const MAX_PROFILE_FETCH_ATTEMPTS = 3;

  // Load cached profile from localStorage
  const loadCachedProfile = useCallback(() => {
    // Only load from cache on page refresh, not initial login
    if (!isPageRefresh) {
      console.log('🔄 [AuthContext] Initial page load, not using cached profile');
      return null;
    }
    
    try {
      const cachedProfileJson = localStorage.getItem(USER_PROFILE_CACHE_KEY);
      if (cachedProfileJson) {
        const cachedProfile = JSON.parse(cachedProfileJson);
        console.log('📋 [AuthContext] Loaded cached profile:', cachedProfile.name);
        return cachedProfile;
      }
    } catch (error) {
      console.error('❌ [AuthContext] Error loading cached profile:', error);
    }
    return null;
  }, []);

  // Save profile to localStorage
  const cacheUserProfile = useCallback((profile: UserProfile) => {
    try {
      localStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(profile));
      console.log('💾 [AuthContext] Cached user profile for:', profile.name);
    } catch (error) {
      console.error('❌ [AuthContext] Error caching user profile:', error);
    }
  }, []);

  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      console.log('🔄 [AuthContext] Fetching user profile for:', userId);
      profileFetchAttempts.current += 1;
      
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
        
        // If we've tried a few times and still failed, use cached profile as fallback
        if (profileFetchAttempts.current >= MAX_PROFILE_FETCH_ATTEMPTS) {
          const cachedProfile = loadCachedProfile();
          if (cachedProfile && cachedProfile.id === userId) {
            console.log('⚠️ [AuthContext] Using cached profile after failed fetch attempts');
            return cachedProfile;
          }
        }
        
        return null;
      }

      console.log('✅ [AuthContext] User profile fetched successfully:', data.name);
      
      // Cache the profile for future use
      cacheUserProfile(data);
      
      return data;
    } catch (error) {
      console.error('❌ [AuthContext] Error fetching user profile:', error);
      return null;
    }
  }, [cacheUserProfile, loadCachedProfile]);

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
      
      // Update the cached profile
      cacheUserProfile(data);
      
      return { error: null };
    } catch (error) {
      console.error('❌ [AuthContext] Error updating profile:', error);
      return { error: error as Error };
    }
  };

  useEffect(() => {
    console.log('🔄 [AuthContext] AuthProvider mounted');
    
    // Reset the auth state ref when component mounts
    authStateRef.current.isActive = true;
    
    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('🔄 [AuthContext] Getting initial session...');
        setLoading(true);
        
        // Try to load cached profile first for immediate UI display
        // But only if this is a page refresh, not an initial login
        if (isPageRefresh) {
          const cachedProfile = loadCachedProfile();
          if (cachedProfile) {
            console.log('📋 [AuthContext] Using cached profile while session loads:', cachedProfile.name);
            setUserProfile(cachedProfile);
          }
        }
        
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
            localStorage.removeItem(USER_PROFILE_CACHE_KEY);
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
            // If we already have a cached profile, keep using it while we fetch the latest
            if (isPageRefresh && !userProfile) {
              const cachedProfile = loadCachedProfile();
              if (cachedProfile && cachedProfile.id === session.user.id) {
                setUserProfile(cachedProfile);
              }
            }
            
            const profile = await fetchUserProfile(session.user.id);
            
            // Check again if component is still mounted and auth is active
            if (authStateRef.current.isActive) {
              if (profile) {
                setUserProfile(profile);
              } else if (isPageRefresh) {
                // If fetch failed but we have a cached profile, keep using it
                const cachedProfile = loadCachedProfile();
                if (cachedProfile && cachedProfile.id === session.user.id) {
                  console.log('⚠️ [AuthContext] Using cached profile after failed fetch');
                  setUserProfile(cachedProfile);
                }
              }
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
        localStorage.removeItem(USER_PROFILE_CACHE_KEY);
      } finally {
        // Only update loading state if component is still mounted and auth is active
        if (authStateRef.current.isActive) {
          console.log('✅ [AuthContext] Initial auth setup complete');
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

        if (session?.user) {
          // Try to use cached profile first for immediate UI update
          // But only if this is a page refresh, not during normal auth flow
          if (isPageRefresh) {
            const cachedProfile = loadCachedProfile();
            if (cachedProfile && cachedProfile.id === session.user.id) {
              console.log('📋 [AuthContext] Using cached profile during auth change:', cachedProfile.name);
              setUserProfile(cachedProfile);
            }
          }
          
          // Reset profile fetch attempts counter
          profileFetchAttempts.current = 0;
          
          // Fetch user profile
          const profile = await fetchUserProfile(session.user.id);
          
          // Check again if component is still mounted and auth is active
          if (!authStateRef.current.isActive) {
            console.log('⚠️ [AuthContext] Auth state no longer active, aborting profile update');
            return;
          }
          
          if (profile) {
            setUserProfile(profile);
          } else if (isPageRefresh) {
            // If fetch failed but we have a cached profile, keep using it
            const cachedProfile = loadCachedProfile();
            if (cachedProfile && cachedProfile.id === session.user.id) {
              console.log('⚠️ [AuthContext] Keeping cached profile after failed fetch');
              setUserProfile(cachedProfile);
            }
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
                if (authStateRef.current.isActive && newProfile) {
                  setUserProfile(newProfile);
                  cacheUserProfile(newProfile);
                  console.log('✅ [AuthContext] User profile created successfully');
                }
              }
            } catch (error) {
              console.error('❌ [AuthContext] Error handling user profile:', error);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          // Clear user profile when user signs out
          setUserProfile(null);
          localStorage.removeItem(USER_PROFILE_CACHE_KEY);
          console.log('🧹 [AuthContext] Cleared user profile cache on sign out');
        }
        
        // Update loading state
        setLoading(false);
      }
    );

    return () => {
      // Mark auth state as inactive when component unmounts
      console.log('🔄 [AuthContext] AuthProvider unmounting, cleaning up');
      authStateRef.current.isActive = false;
      subscription.unsubscribe();
    };
  }, [fetchUserProfile, loadCachedProfile, cacheUserProfile, userProfile]);

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
      
      // Clear cached profile
      localStorage.removeItem(USER_PROFILE_CACHE_KEY);
      
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