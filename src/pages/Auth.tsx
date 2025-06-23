import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import AuthAnimation from '@/components/AuthAnimation';
import FloatingHearts from '@/components/FloatingHearts';
import MemoryParticles from '@/components/MemoryParticles';
import { motion } from 'framer-motion';
import { ArrowLeft, Eye, EyeOff, AlertCircle } from 'lucide-react';

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, user, loading } = useAuth();

  useEffect(() => {
    console.log('🔄 Auth page: checking user state', { user: !!user, loading });
    if (user && !loading) {
      console.log('✅ User already authenticated, redirecting to home');
      navigate('/');
    }
  }, [user, loading, navigate]);

  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('sign-in');
  const [animationVisible, setAnimationVisible] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Try to restore form state from localStorage
  useEffect(() => {
    try {
      const savedState = localStorage.getItem('thisisus_auth_state');
      if (savedState) {
        const { signInEmail, signUpEmail, signUpName, activeTab } = JSON.parse(savedState);
        if (signInEmail) setSignInEmail(signInEmail);
        if (signUpEmail) setSignUpEmail(signUpEmail);
        if (signUpName) setSignUpName(signUpName);
        if (activeTab) setActiveTab(activeTab);
        
        console.log('📋 [Auth] Restored form state from localStorage');
      }
    } catch (error) {
      console.error('❌ [Auth] Error restoring form state:', error);
    }
  }, []);

  // Save form state to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('thisisus_auth_state', JSON.stringify({
        signInEmail,
        signUpEmail,
        signUpName,
        activeTab
      }));
    } catch (error) {
      console.error('❌ [Auth] Error saving form state:', error);
    }
  }, [signInEmail, signUpEmail, signUpName, activeTab]);

  useEffect(() => {
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const type = searchParams.get('type');
    
    console.log('🔄 Auth URL params:', { error, errorDescription, type });
    
    // Handle email confirmation success
    if (type === 'signup') {
      console.log('✅ Email confirmation successful');
      toast.success('Account created!', {
        description: 'Your account has been created successfully. You can now sign in.',
      });
      // Clear the URL parameters
      navigate('/auth', { replace: true });
    }
    
    if (error) {
      console.error('❌ Auth error from URL:', error, errorDescription);
      toast.error('Authentication Error', {
        description: errorDescription || 'An authentication error occurred.',
      });
      // Clear the URL parameters
      navigate('/auth', { replace: true });
    }
  }, [searchParams, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signInEmail.trim() || !signInPassword) {
      toast.error('Missing information', {
        description: 'Please enter both email and password.',
      });
      return;
    }

    console.log('🔄 Attempting sign in for:', signInEmail);
    setIsSigningIn(true);
    setAnimationVisible(false);

    try {
      const { error } = await signIn(signInEmail, signInPassword);

      if (error) {
        console.error('❌ Sign in failed:', error);
        let errorMessage = 'Something went wrong.';
        
        if (error.message?.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
        } else if (error.message?.includes('Email rate limit exceeded')) {
          errorMessage = 'Too many login attempts. Please wait a few minutes before trying again.';
        } else if (error.message?.includes('signup_disabled')) {
          errorMessage = 'New signups are currently disabled. Please contact support.';
        } else {
          errorMessage = error.message || 'Failed to sign in. Please try again.';
        }

        toast.error('Sign in failed', {
          description: errorMessage,
        });
        setAnimationVisible(true);
        return;
      }

      console.log('✅ Sign in successful');
      toast.success('Welcome back!');
      
      // Clear auth state from localStorage
      localStorage.removeItem('thisisus_auth_state');
      
      // Navigation will be handled by the useEffect when user state changes
    } catch (error) {
      console.error('❌ Sign in error:', error);
      toast.error('Sign in failed', {
        description: 'An unexpected error occurred. Please try again.',
      });
      setAnimationVisible(true);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signUpName.trim()) {
      toast.error('Name required', {
        description: 'Please enter your name.',
      });
      return;
    }

    if (!signUpEmail.trim()) {
      toast.error('Email required', {
        description: 'Please enter your email address.',
      });
      return;
    }

    if (signUpPassword.length < 6) {
      toast.error('Weak password', {
        description: 'Password must be at least 6 characters long.',
      });
      return;
    }

    console.log('🔄 Attempting sign up for:', signUpEmail);
    setIsSigningUp(true);
    setAnimationVisible(false);

    try {
      const { error, user } = await signUp(signUpEmail, signUpPassword, signUpName.trim());

      if (error) {
        console.error('❌ Sign up failed:', error);
        let errorMessage = 'Something went wrong.';
        
        if (error.message?.includes('User already registered')) {
          errorMessage = 'An account with this email already exists. Please sign in instead.';
        } else if (error.message?.includes('signup_disabled')) {
          errorMessage = 'New signups are currently disabled. Please contact support.';
        } else if (error.message?.includes('Password should be at least')) {
          errorMessage = 'Password must be at least 6 characters long.';
        } else {
          errorMessage = error.message || 'Failed to create account. Please try again.';
        }

        toast.error('Sign up failed', {
          description: errorMessage,
        });
        setAnimationVisible(true);
        return;
      }

      console.log('✅ Sign up successful');
      toast.success('Account created!', {
        description: 'Your account has been created successfully. You are now signed in.',
      });
      
      // Clear auth state from localStorage
      localStorage.removeItem('thisisus_auth_state');
      
      // Navigation will be handled by the useEffect when user state changes
      
    } catch (error) {
      console.error('❌ Sign up error:', error);
      toast.error('Sign up failed', {
        description: 'An unexpected error occurred. Please try again.',
      });
      setAnimationVisible(true);
    } finally {
      setIsSigningUp(false);
    }
  };

  // Show loading while checking auth state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-memory-purple mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundImage: `url('/best2 copy.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Animated background */}
      {animationVisible && <AuthAnimation />}
      {animationVisible && <FloatingHearts count={10} />}
      {animationVisible && <MemoryParticles />}
      
      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-white/50 backdrop-blur-sm"></div>
      
      {/* Back button */}
      <motion.div 
        className="absolute top-4 left-4 z-20"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/welcome')}
          className="flex items-center gap-1 bg-white/80 hover:bg-white/90"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </Button>
      </motion.div>
      
      <motion.div 
        className="w-full max-w-md space-y-4 relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div 
          className="text-center"
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ 
            duration: 0.5, 
            type: "spring", 
            stiffness: 200, 
            damping: 15 
          }}
        >
          <h1 className="text-4xl font-bold mb-2 relative">
            {/* Shadow effect for better contrast */}
            <span className="absolute inset-0 text-black/10 blur-[2px] transform translate-x-[2px] translate-y-[2px]">
              This Is Us
            </span>
            {/* Main title with gradient */}
            <span className="relative bg-gradient-to-r from-memory-pink to-memory-purple bg-clip-text text-transparent drop-shadow-md">
              This Is Us
            </span>
          </h1>
          <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full inline-block">
            <p className="text-muted-foreground">
              Sign in to access your memories
            </p>
          </div>
        </motion.div>

        {/* Beta notice */}
        <Alert className="bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Beta Testing Notice:</strong> This Is Us is currently in beta testing. Email confirmation has been disabled for easier testing. Your account will be created immediately upon signup.
          </AlertDescription>
        </Alert>

        <motion.div 
          className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Tabs 
            defaultValue="sign-in" 
            value={activeTab} 
            onValueChange={setActiveTab} 
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sign-in">Sign In</TabsTrigger>
              <TabsTrigger value="sign-up">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="sign-in">
              <div className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-muted-foreground">Sign in with email</span>
                  </div>
                </div>

                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Input
                      type="email"
                      placeholder="Email"
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      required
                      disabled={isSigningIn}
                      autoComplete="email"
                    />
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        required
                        disabled={isSigningIn}
                        autoComplete="current-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <Button
                    type="submit"
                    className="w-full bg-memory-purple hover:bg-memory-purple/90"
                    disabled={isSigningIn || !signInEmail.trim() || !signInPassword}
                  >
                    {isSigningIn ? 'Signing In...' : 'Sign In'}
                  </Button>
                </form>
              </div>
            </TabsContent>

            <TabsContent value="sign-up">
              <div className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-muted-foreground">Sign up with email</span>
                  </div>
                </div>

                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Input
                      type="text"
                      placeholder="Your Name"
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                      required
                      disabled={isSigningUp}
                      autoComplete="name"
                    />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      required
                      disabled={isSigningUp}
                      autoComplete="email"
                    />
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Password (min 6 characters)"
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                        required
                        disabled={isSigningUp}
                        minLength={6}
                        autoComplete="new-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-memory-purple hover:bg-memory-purple/90"
                    disabled={isSigningUp || !signUpName.trim() || !signUpEmail.trim() || signUpPassword.length < 6}
                  >
                    {isSigningUp ? 'Signing Up...' : 'Sign Up'}
                  </Button>
                </form>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Auth;