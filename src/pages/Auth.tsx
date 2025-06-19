import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import AuthAnimation from '@/components/AuthAnimation';
import FloatingHearts from '@/components/FloatingHearts';
import MemoryParticles from '@/components/MemoryParticles';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail } from 'lucide-react';

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, signInWithGoogle, user, loading } = useAuth();

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
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isSigningInWithGoogle, setIsSigningInWithGoogle] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [showEmailNotConfirmed, setShowEmailNotConfirmed] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('');
  const [activeTab, setActiveTab] = useState<string>('sign-in');
  const [animationVisible, setAnimationVisible] = useState(true);

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
      toast({
        title: 'Email confirmed!',
        description: 'Your email has been verified. Please sign in to your account.',
      });
      // Clear the URL parameters
      navigate('/auth', { replace: true });
    }
    
    // Handle Google OAuth success
    if (type === 'google') {
      console.log('✅ Google OAuth successful');
      toast({
        title: 'Welcome!',
        description: 'You have successfully signed in with Google.',
      });
      // Clear the URL parameters and redirect to home
      navigate('/', { replace: true });
    }

    // Handle password reset success
    if (type === 'recovery') {
      console.log('✅ Password reset link accessed');
      toast({
        title: 'Password reset',
        description: 'You can now set a new password.',
      });
      // Redirect to reset password page
      navigate('/reset-password', { replace: true });
    }
    
    if (error) {
      console.error('❌ Auth error from URL:', error, errorDescription);
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: errorDescription || 'An authentication error occurred.',
      });
      // Clear the URL parameters
      navigate('/auth', { replace: true });
    }
  }, [searchParams, navigate]);

  const handleResendConfirmation = async () => {
    if (!unconfirmedEmail) return;

    console.log('🔄 Resending confirmation email to:', unconfirmedEmail);
    setIsResendingEmail(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: unconfirmedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth?type=signup`,
        }
      });

      if (error) {
        console.error('❌ Failed to resend confirmation email:', error);
        toast({
          variant: 'destructive',
          title: 'Failed to resend email',
          description: error.message,
        });
      } else {
        console.log('✅ Confirmation email resent successfully');
        toast({
          title: 'Confirmation email sent',
          description: 'Please check your email (including spam folder) for the verification link.',
        });
      }
    } catch (error) {
      console.error('❌ Resend confirmation error:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to resend email',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsResendingEmail(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!forgotPasswordEmail.trim()) {
      toast({
        variant: 'destructive',
        title: 'Email required',
        description: 'Please enter your email address.',
      });
      return;
    }

    console.log('🔄 Sending password reset email to:', forgotPasswordEmail);
    setIsSendingResetEmail(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        console.error('❌ Failed to send password reset email:', error);
        toast({
          variant: 'destructive',
          title: 'Failed to send reset email',
          description: error.message,
        });
      } else {
        console.log('✅ Password reset email sent successfully');
        setResetEmailSent(true);
        toast({
          title: 'Password reset email sent',
          description: 'Please check your email for instructions to reset your password.',
        });
      }
    } catch (error) {
      console.error('❌ Password reset error:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to send reset email',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signInEmail.trim() || !signInPassword) {
      toast({
        variant: 'destructive',
        title: 'Missing information',
        description: 'Please enter both email and password.',
      });
      return;
    }

    console.log('🔄 Attempting sign in for:', signInEmail);
    setIsSigningIn(true);
    setShowEmailNotConfirmed(false);
    setAnimationVisible(false);

    try {
      const { error } = await signIn(signInEmail, signInPassword);

      if (error) {
        console.error('❌ Sign in failed:', error);
        let errorMessage = 'Something went wrong.';
        
        if (error.message?.includes('Email not confirmed')) {
          setUnconfirmedEmail(signInEmail);
          setShowEmailNotConfirmed(true);
          errorMessage = 'Please verify your email address before signing in. Check your inbox and spam folder for the verification link.';
        } else if (error.message?.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
        } else if (error.message?.includes('Email rate limit exceeded')) {
          errorMessage = 'Too many login attempts. Please wait a few minutes before trying again.';
        } else if (error.message?.includes('signup_disabled')) {
          errorMessage = 'New signups are currently disabled. Please contact support.';
        } else {
          errorMessage = error.message || 'Failed to sign in. Please try again.';
        }

        toast({
          variant: 'destructive',
          title: 'Sign in failed',
          description: errorMessage,
        });
        setAnimationVisible(true);
        return;
      }

      console.log('✅ Sign in successful');
      toast({ title: 'Welcome back!' });
      
      // Clear auth state from localStorage
      localStorage.removeItem('thisisus_auth_state');
      
      // Navigation will be handled by the useEffect when user state changes
    } catch (error) {
      console.error('❌ Sign in error:', error);
      toast({
        variant: 'destructive',
        title: 'Sign in failed',
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
      toast({
        variant: 'destructive',
        title: 'Name required',
        description: 'Please enter your name.',
      });
      return;
    }

    if (!signUpEmail.trim()) {
      toast({
        variant: 'destructive',
        title: 'Email required',
        description: 'Please enter your email address.',
      });
      return;
    }

    if (signUpPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Weak password',
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

        toast({
          variant: 'destructive',
          title: 'Sign up failed',
          description: errorMessage,
        });
        setAnimationVisible(true);
        return;
      }

      if (user) {
        console.log('✅ Sign up successful');
        // Since email confirmation is disabled, we can directly sign in the user
        toast({
          title: 'Account created',
          description: 'Your account has been created successfully. You are now signed in.',
        });
        
        // Clear the form
        setSignUpEmail('');
        setSignUpPassword('');
        setSignUpName('');
        
        // Clear auth state from localStorage
        localStorage.removeItem('thisisus_auth_state');
        
        // Navigate to home page
        navigate('/');
      }
    } catch (error) {
      console.error('❌ Sign up error:', error);
      toast({
        variant: 'destructive',
        title: 'Sign up failed',
        description: 'An unexpected error occurred. Please try again.',
      });
      setAnimationVisible(true);
    } finally {
      setIsSigningUp(false);
    }
  };

  const handleGoogleSignIn = async () => {
    console.log('🔄 Attempting Google sign in');
    setIsSigningInWithGoogle(true);
    setAnimationVisible(false);

    try {
      const { error } = await signInWithGoogle();

      if (error) {
        console.error('❌ Google sign in failed:', error);
        let errorMessage = 'Something went wrong with Google sign in.';
        
        if (error.message?.includes('popup_closed_by_user')) {
          errorMessage = 'Sign in was cancelled. Please try again.';
        } else if (error.message?.includes('access_denied')) {
          errorMessage = 'Access was denied. Please try again and allow the required permissions.';
        } else {
          errorMessage = error.message || 'Failed to sign in with Google. Please try again.';
        }

        toast({
          variant: 'destructive',
          title: 'Google sign in failed',
          description: errorMessage,
        });
        setAnimationVisible(true);
        setIsSigningInWithGoogle(false);
        return;
      }

      console.log('✅ Google sign in initiated');
      // Don't set loading to false here as the user will be redirected
      // The loading state will be cleared when they return from Google
    } catch (error) {
      console.error('❌ Google sign in error:', error);
      toast({
        variant: 'destructive',
        title: 'Google sign in failed',
        description: 'An unexpected error occurred. Please try again.',
      });
      setAnimationVisible(true);
      setIsSigningInWithGoogle(false);
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
              {showForgotPassword ? 'Reset your password' : 'Sign in to access your memories'}
            </p>
          </div>
        </motion.div>

        {emailSent && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Alert>
              <AlertDescription>
                Please check your email and click the verification link to complete your registration.
                After verification, return here to sign in with your credentials.
                You may need to check your spam folder.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {resetEmailSent && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Alert className="border-green-200 bg-green-50">
              <Mail className="h-4 w-4" />
              <AlertDescription className="text-green-800">
                <strong>Password reset email sent!</strong>
                <br />
                Please check your email for instructions to reset your password. 
                The link will expire in 1 hour.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {showEmailNotConfirmed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Alert className="border-amber-200 bg-amber-50">
              <AlertDescription className="space-y-3">
                <div>
                  <strong>Email verification required</strong>
                </div>
                <p className="text-sm">
                  Your email address <strong>{unconfirmedEmail}</strong> needs to be verified before you can sign in.
                  Please check your inbox (and spam folder) for the verification email.
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResendConfirmation}
                    disabled={isResendingEmail}
                    className="w-full"
                  >
                    {isResendingEmail ? 'Sending...' : 'Resend verification email'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Didn't receive the email? Check your spam folder or try resending.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        <motion.div 
          className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          {showForgotPassword ? (
            /* Forgot Password Form */
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="text-xl font-semibold">Reset Password</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="email"
                    placeholder="Enter your email address"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    required
                    disabled={isSendingResetEmail}
                    autoComplete="email"
                  />
                </div>
                
                <Button
                  type="submit"
                  className="w-full bg-memory-purple hover:bg-memory-purple/90"
                  disabled={isSendingResetEmail || !forgotPasswordEmail.trim()}
                >
                  {isSendingResetEmail ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </form>

              <div className="text-center">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetEmailSent(false);
                    setForgotPasswordEmail('');
                  }}
                  className="text-sm"
                >
                  Back to Sign In
                </Button>
              </div>
            </div>
          ) : (
            /* Regular Auth Forms */
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
                  {/* Google Sign In Button */}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full flex items-center justify-center gap-3 py-6 border-gray-300 hover:bg-gray-50"
                    onClick={handleGoogleSignIn}
                    disabled={isSigningInWithGoogle || isSigningIn}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    {isSigningInWithGoogle ? 'Signing in...' : 'Continue with Google'}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-muted-foreground">Or continue with email</span>
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
                        disabled={isSigningIn || isSigningInWithGoogle}
                        autoComplete="email"
                      />
                      <Input
                        type="password"
                        placeholder="Password"
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        required
                        disabled={isSigningIn || isSigningInWithGoogle}
                        autoComplete="current-password"
                      />
                    </div>
                    
                    <div className="flex justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowForgotPassword(true);
                          setForgotPasswordEmail(signInEmail);
                        }}
                        className="text-xs text-memory-purple hover:text-memory-purple/80"
                      >
                        Forgot password?
                      </Button>
                    </div>
                    
                    <Button
                      type="submit"
                      className="w-full bg-memory-purple hover:bg-memory-purple/90"
                      disabled={isSigningIn || isSigningInWithGoogle || !signInEmail.trim() || !signInPassword}
                    >
                      {isSigningIn ? 'Signing In...' : 'Sign In'}
                    </Button>
                  </form>
                </div>
              </TabsContent>

              <TabsContent value="sign-up">
                <div className="space-y-4">
                  {/* Google Sign Up Button */}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full flex items-center justify-center gap-3 py-6 border-gray-300 hover:bg-gray-50"
                    onClick={handleGoogleSignIn}
                    disabled={isSigningInWithGoogle || isSigningUp}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    {isSigningInWithGoogle ? 'Signing up...' : 'Continue with Google'}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-muted-foreground">Or continue with email</span>
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
                        disabled={isSigningUp || isSigningInWithGoogle}
                        autoComplete="name"
                      />
                      <Input
                        type="email"
                        placeholder="Email"
                        value={signUpEmail}
                        onChange={(e) => setSignUpEmail(e.target.value)}
                        required
                        disabled={isSigningUp || isSigningInWithGoogle}
                        autoComplete="email"
                      />
                      <Input
                        type="password"
                        placeholder="Password (min 6 characters)"
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                        required
                        disabled={isSigningUp || isSigningInWithGoogle}
                        minLength={6}
                        autoComplete="new-password"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-memory-purple hover:bg-memory-purple/90"
                      disabled={isSigningUp || isSigningInWithGoogle || !signUpName.trim() || !signUpEmail.trim() || signUpPassword.length < 6}
                    >
                      {isSigningUp ? 'Signing Up...' : 'Sign Up'}
                    </Button>
                  </form>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Auth;