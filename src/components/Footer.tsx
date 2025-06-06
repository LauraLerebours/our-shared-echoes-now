import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Share2, Grid } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FooterProps {
  activeTab?: 'timeline' | 'share' | 'boards';
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
          to="/boards" 
          className={cn(
            "flex flex-col items-center px-4 py-1", 
            activeTab === 'boards' ? "text-memory-purple" : "text-muted-foreground"
          )}
        >
          <Grid className="h-6 w-6" />
          <span className="text-xs mt-1">Boards</span>
        </Link>
        
        <Link 
          to="/share" 
          className={cn(
            "flex flex-col items-center px-4 py-1", 
            activeTab === 'share' ? "text-memory-purple" : "text-muted-foreground"
          )}
        >
          <Share2 className="h-6 w-6" />
          <span className="text-xs mt-1">Share</span>
        </Link>
      </div>
    </footer>
  );
};

export default Footer;