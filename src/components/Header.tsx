import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import UserProfileDialog from './UserProfileDialog';
import { LoadingSpinner } from './LoadingSpinner';

const Header = () => {
  const { signOut, user, userProfile, isSigningOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: 'Logged out successfully',
        description: 'You have been signed out of your account.',
      });
      navigate('/auth');
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: 'Logout failed',
        description: 'There was an error signing you out.',
        variant: 'destructive',
      });
    }
  };

  const getInitials = () => {
    if (userProfile?.name) {
      return userProfile.name
        .split(' ')
        .map(word => word.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user?.email?.charAt(0).toUpperCase() || 'US';
  };

  const getDisplayName = () => {
    if (userProfile?.name) {
      return userProfile.name.split(' ')[0]; // First name only
    }
    return user?.email?.split('@')[0] || 'User';
  };

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
      <div className="flex items-center gap-3">
        <UserProfileDialog>
          <Button variant="ghost" className="p-0 h-auto">
            <Avatar className="h-9 w-9 border-2 border-memory-purple">
              <AvatarFallback className="bg-memory-lightpurple text-memory-purple">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
          </Button>
        </UserProfileDialog>
        <div className="flex flex-col">
          <span className="text-sm font-medium">{getDisplayName()}</span>
          <UserProfileDialog>
            <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-muted-foreground hover:text-memory-purple">
              <Settings className="h-3 w-3 mr-1" />
              Edit Profile
            </Button>
          </UserProfileDialog>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="text-muted-foreground hover:text-destructive"
          title="Logout"
          disabled={isSigningOut}
        >
          {isSigningOut ? (
            <LoadingSpinner size="sm" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {/* App Title - No logo reference */}
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold text-center bg-gradient-to-r from-memory-pink to-memory-purple bg-clip-text text-transparent">
          This Is Us
        </h1>
      </div>
      
      <Button variant="ghost" size="icon" asChild className="text-memory-purple hover:text-memory-pink hover:bg-memory-lightpurple">
        <Link to="/add">
          <Plus className="h-5 w-5" />
        </Link>
      </Button>
    </header>
  );
};

export default Header;