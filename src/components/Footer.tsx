import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Share2, Grid } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FooterProps {
  activeTab?: 'timeline' | 'share' | 'boards';
}

const Footer: React.FC<FooterProps> = ({ activeTab = 'timeline' }) => {
  // Check if the app is running in standalone mode (PWA)
  const isPWA = window.matchMedia('(display-mode: standalone)').matches;

  return (
    <footer className={`fixed safari-footer-safe left-0 right-0 bg-white border-t py-2 z-40 ${isPWA ? 'pb-safe' : ''}`}>
      <div className="flex justify-around items-center ios-bottom-spacing">
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