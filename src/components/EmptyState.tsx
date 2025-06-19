import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

const EmptyState = () => {
  return (
    <div className="flex flex-col items-center justify-center h-[80vh] p-6 text-center">
      <div className="w-20 h-20 rounded-full mb-6 flex items-center justify-center bg-memory-lightpurple">
        <img src="/placeholder.svg" alt="Empty memories" className="w-12 h-12 opacity-50" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No memories yet</h2>
      <p className="text-muted-foreground mb-6 max-w-xs">
        Start capturing your special moments together and build your shared story.
      </p>
      <Button asChild className="bg-gradient-to-r from-memory-pink to-memory-purple hover:opacity-90">
        <Link to="/add">
          <Plus className="h-5 w-5 mr-2" />
          Create Your First Memory
        </Link>
      </Button>
    </div>
  );
};

export default EmptyState;