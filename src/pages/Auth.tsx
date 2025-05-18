import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';

const Auth = () => {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();

  // Separate form state
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');

  // Separate loading state
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigningIn(true);

    const { error } = await signIn(signInEmail, signInPassword);
    setIsSigningIn(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Login failed',
        description: error.message || 'Something went wrong.',
      });
      return;
    }

    toast({ title: 'Welcome back!' });
    navigate('/');
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
    const { error } = await signUp(signUpEmail, signUpPassword);
    setIsSigningUp(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Sign up failed',
        description: error.message || 'Something went wrong.',
      });
      return;
    }

    toast({
      title: 'Account created',
      description: 'Please check your email to verify your account.',
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Memory Timeline</h1>
          <p className="text-muted-foreground">Sign in to access your memories</p>
        </div>

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
