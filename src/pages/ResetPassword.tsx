import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import AuthAnimation from '@/components/AuthAnimation';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccessful, setResetSuccessful] = useState(false);

  // Get the access token from URL
  const accessToken = searchParams.get('access_token');

  useEffect(() => {
    if (!accessToken) {
      toast({
        variant: 'destructive',
        title: 'Invalid reset link',
        description: 'This password reset link is invalid or has expired. Please request a new one.',
      });
      navigate('/auth', { replace: true });
    }
  }, [accessToken, navigate]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Password too short',
        description: 'Password must be at least 6 characters long.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Passwords don\'t match',
        description: 'Please make sure your passwords match.',
      });
      return;
    }

    setIsResetting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('❌ Password reset failed:', error);
        toast({
          variant: 'destructive',
          title: 'Password reset failed',
          description: error.message,
        });
      } else {
        console.log('✅ Password reset successful');
        setResetSuccessful(true);
        toast({
          title: 'Password reset successful',
          description: 'Your password has been updated. You can now sign in with your new password.',
        });
        
        // Clear the URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Redirect to auth page after a delay
        setTimeout(() => {
          navigate('/auth', { replace: true });
        }, 3000);
      }
    } catch (error) {
      console.error('❌ Password reset error:', error);
      toast({
        variant: 'destructive',
        title: 'Password reset failed',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsResetting(false);
    }
  };

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
      <AuthAnimation />
      
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
          onClick={() => navigate('/auth')}
          className="flex items-center gap-1 bg-white/80 hover:bg-white/90"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Sign In</span>
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
              Reset Password
            </span>
            {/* Main title with gradient */}
            <span className="relative bg-gradient-to-r from-memory-pink to-memory-purple bg-clip-text text-transparent drop-shadow-md">
              Reset Password
            </span>
          </h1>
          <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full inline-block">
            <p className="text-muted-foreground">Create a new password for your account</p>
          </div>
        </motion.div>

        {resetSuccessful ? (
          <motion.div 
            className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold">Password Reset Successful</h2>
              <p className="text-muted-foreground">
                Your password has been updated successfully. You will be redirected to the sign in page.
              </p>
              <Button
                onClick={() => navigate('/auth')}
                className="w-full bg-memory-purple hover:bg-memory-purple/90"
              >
                Go to Sign In
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="new-password" className="block text-sm font-medium">
                  New Password
                </label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={isResetting}
                  autoComplete="new-password"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="confirm-password" className="block text-sm font-medium">
                  Confirm Password
                </label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={isResetting}
                  autoComplete="new-password"
                />
              </div>
              
              <Button
                type="submit"
                className="w-full bg-memory-purple hover:bg-memory-purple/90"
                disabled={isResetting || !newPassword || !confirmPassword}
              >
                {isResetting ? 'Resetting Password...' : 'Reset Password'}
              </Button>
            </form>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default ResetPassword;