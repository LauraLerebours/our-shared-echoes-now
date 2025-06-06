import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

const Header = () => {
  const { signOut, user, userProfile } = useAuth();
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
        <Avatar className="h-9 w-9 border-2 border-memory-purple">
          <AvatarFallback className="bg-memory-lightpurple text-memory-purple">
            {getInitials()}
          </AvatarFallback>
          <AvatarImage src="/placeholder.svg" />
        </Avatar>
        <div className="flex flex-col">
          <span className="text-sm font-medium">{getDisplayName()}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="text-muted-foreground hover:text-destructive"
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
      
      <h1 className="text-xl font-semibold text-center bg-gradient-to-r from-memory-pink to-memory-purple bg-clip-text text-transparent">
        This Is Us
      </h1>
      
      <Button variant="ghost" size="icon" asChild className="text-memory-purple hover:text-memory-pink hover:bg-memory-lightpurple">
        <Link to="/add">
          <Plus className="h-5 w-5" />
        </Link>
      </Button>
    </header>
  );
};

export default Header;