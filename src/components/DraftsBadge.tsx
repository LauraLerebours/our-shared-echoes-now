import React, { useState, useEffect } from 'react';
import { FileEdit } from 'lucide-react';
import { getDraftsCount } from '@/lib/draftsStorage';
import { cn } from '@/lib/utils';

interface DraftsBadgeProps {
  className?: string;
}

const DraftsBadge: React.FC<DraftsBadgeProps> = ({ className }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Initial count
    updateCount();

    // Set up storage event listener to update count when drafts change
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'thisisus_memory_drafts') {
        updateCount();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Custom event for when drafts are updated within the same window
    const handleDraftsUpdated = () => {
      updateCount();
    };
    
    window.addEventListener('draftsUpdated', handleDraftsUpdated);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('draftsUpdated', handleDraftsUpdated);
    };
  }, []);

  const updateCount = () => {
    const draftsCount = getDraftsCount();
    setCount(draftsCount);
  };

  if (count === 0) {
    return null;
  }

  return (
    <div className={cn("relative", className)}>
      <FileEdit className="h-5 w-5 text-memory-purple" />
      <div className="absolute -top-1 -right-1 bg-memory-pink text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
        {count > 9 ? '9+' : count}
      </div>
    </div>
  );
};

export default DraftsBadge;