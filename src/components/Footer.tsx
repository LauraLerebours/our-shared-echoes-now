
import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Heart, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FooterProps {
  activeTab?: 'timeline' | 'favorites' | 'messages';
}

const Footer: React.FC<FooterProps> = ({ activeTab = 'timeline' }) => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-white border-t py-2 z-10">
      <div className="flex justify-around items-center">
        <Link 
          to="/" 
          className={cn(
            "flex flex-col items-center px-4 py-1", 
            activeTab === 'timeline' ? "text-memory-purple" : "text-muted-foreground"
          )}
        >
          <Home className="h-6 w-6" />
          <span className="text-xs mt-1">Timeline</span>
        </Link>
        
        <Link 
          to="/favorites" 
          className={cn(
            "flex flex-col items-center px-4 py-1", 
            activeTab === 'favorites' ? "text-memory-purple" : "text-muted-foreground"
          )}
        >
          <Heart className="h-6 w-6" />
          <span className="text-xs mt-1">Favorites</span>
        </Link>
        
        <Link 
          to="/messages" 
          className={cn(
            "flex flex-col items-center px-4 py-1", 
            activeTab === 'messages' ? "text-memory-purple" : "text-muted-foreground"
          )}
        >
          <MessageCircle className="h-6 w-6" />
          <span className="text-xs mt-1">Messages</span>
        </Link>
      </div>
    </footer>
  );
};

export default Footer;
