import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, user, loading } = useAuth();

  useEffect(() => {
    if (user && !loading) {
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
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [showEmailNotConfirmed, setShowEmailNotConfirmed] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('');

  useEffect(() => {
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const type = searchParams.get('type');
    
    // Handle email confirmation success
    if (type === 'signup') {
      toast({
        title: 'Email confirmed!',
        description: 'Your email has been verified. You can now sign in to your account.',
      });
    }
    
    if (error) {
      console.error('Auth error from URL:', error, errorDescription);
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: errorDescription || 'An authentication error occurred.',
      });
    }
  }, [searchParams]);

  const handleResendConfirmation = async () => {
    if (!unconfirmedEmail) return;

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
        toast({
          variant: 'destructive',
          title: 'Failed to resend email',
          description: error.message,
        });
      } else {
        toast({
          title: 'Confirmation email sent',
          description: 'Please check your email (including spam folder) for the verification link.',
        });
      }
    } catch (error) {
      console.error('Resend confirmation error:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to resend email',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsResendingEmail(false);
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

    setIsSigningIn(true);
    setShowEmailNotConfirmed(false);

    try {
      const { error } = await signIn(signInEmail, signInPassword);

      if (error) {
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
        return;
      }

      toast({ title: 'Welcome back!' });
      // Navigation will be handled by the useEffect when user state changes
    } catch (error) {
      console.error('Sign in error:', error);
      toast({
        variant: 'destructive',
        title: 'Sign in failed',
        description: 'An unexpected error occurred. Please try again.',
      });
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

    setIsSigningUp(true);

    try {
      const { error, user } = await signUp(signUpEmail, signUpPassword, signUpName.trim());

      if (error) {
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
        return;
      }

      if (user) {
        setEmailSent(true);
        toast({
          title: 'Account created',
          description: 'Please check your email to verify your account. Check your spam folder if you don\'t see it.',
        });
      }
    } catch (error) {
      console.error('Sign up error:', error);
      toast({
        variant: 'destructive',
        title: 'Sign up failed',
        description: 'An unexpected error occurred. Please try again.',
      });
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
      className="flex min-h-screen items-center justify-center p-4 relative"
      style={{
        backgroundImage: 'url(/best2.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm"></div>
      
      <div className="w-full max-w-md space-y-4 relative z-10">
        <div className="text-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-memory-pink to-memory-purple bg-clip-text text-transparent">
            This Is Us
          </h1>
          <p className="text-muted-foreground mt-2">Sign in to access your memories</p>
        </div>

        {emailSent && (
          <Alert>
            <AlertDescription>
              Please check your email and click the verification link to complete your registration.
              You may need to check your spam folder.
            </AlertDescription>
          </Alert>
        )}

        {showEmailNotConfirmed && (
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
        )}

        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
          <Tabs defaultValue="sign-in" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sign-in">Sign In</TabsTrigger>
              <TabsTrigger value="sign-up">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="sign-in">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="email"
                    placeholder="Email"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    required
                    disabled={isSigningIn}
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    required
                    disabled={isSigningIn}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-memory-purple hover:bg-memory-purple/90"
                  disabled={isSigningIn || !signInEmail.trim() || !signInPassword}
                >
                  {isSigningIn ? 'Signing In...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="sign-up">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="Your Name"
                    value={signUpName}
                    onChange={(e) => setSignUpName(e.target.value)}
                    required
                    disabled={isSigningUp}
                  />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    required
                    disabled={isSigningUp}
                  />
                  <Input
                    type="password"
                    placeholder="Password (min 6 characters)"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    required
                    disabled={isSigningUp}
                    minLength={6}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-memory-purple hover:bg-memory-purple/90"
                  disabled={isSigningUp || !signUpName.trim() || !signUpEmail.trim() || signUpPassword.length < 6}
                >
                  {isSigningUp ? 'Signing Up...' : 'Sign Up'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Auth;