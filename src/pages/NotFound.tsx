
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const NotFound = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-full mb-6 flex items-center justify-center bg-memory-lightpurple">
        <span className="text-3xl">🔍</span>
      </div>
      <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
      <p className="text-muted-foreground mb-6 max-w-xs">
        We couldn't find the page you're looking for.
      </p>
      <Button asChild className="bg-memory-purple hover:bg-memory-purple/90">
        <Link to="/">
          Return to Timeline
        </Link>
      </Button>
    </div>
  );
};

export default NotFound;
