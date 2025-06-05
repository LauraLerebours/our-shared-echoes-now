import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const authContext = useAuth();
  
  if (!authContext) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }
  
  const { signIn, signUp, user } = authContext;
  
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');

  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    
    if (error) {
      console.error('Auth error from URL:', error, errorDescription);
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: errorDescription || 'An authentication error occurred.',
      });
    }
  }, [searchParams]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigningIn(true);

    try {
      const { error } = await signIn(signInEmail, signInPassword);

      if (error) {
        let errorMessage = 'Something went wrong.';
        
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. If you just signed up, please check your email for the verification link.';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Please verify your email address before signing in. Check your inbox for the verification link.';
        }

        toast({
          variant: 'destructive',
          title: 'Login failed',
          description: errorMessage,
        });
        return;
      }

      toast({ title: 'Welcome back!' });
      navigate('/');
    } catch (err) {
      console.error('Login error:', err);
      toast({
        variant: 'destructive',
        title: 'Login failed',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (signUpPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Weak password',
        description: 'Password must be at least 6 characters.',
      });
      return;
    }

    setIsSigningUp(true);
    try {
      const { error, user } = await signUp(signUpEmail, signUpPassword);

      if (error) {
        let errorMessage = 'Something went wrong.';
        
        if (error.message.includes('already registered')) {
          errorMessage = 'This email is already registered. Please sign in instead.';
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
    } catch (err) {
      console.error('Sign up error:', err);
      toast({
        variant: 'destructive',
        title: 'Sign up failed',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsSigningUp(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Memory Timeline</h1>
          <p className="text-muted-foreground">Sign in to access your memories</p>
        </div>

        {emailSent && (
          <Alert>
            <AlertDescription>
              Please check your email and click the verification link to complete your registration.
              You may need to check your spam folder.
            </AlertDescription>
          </Alert>
        )}

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
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-memory-purple hover:bg-memory-purple/90"
                disabled={isSigningIn}
              >
                {isSigningIn ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="sign-up">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="Email"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  required
                />
                <Input
                  type="password"
                  placeholder="Password"
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-memory-purple hover:bg-memory-purple/90"
                disabled={isSigningUp}
              >
                {isSigningUp ? 'Signing Up...' : 'Sign Up'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Auth;