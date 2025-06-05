import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '@/components/Header';
import MemoryList from '@/components/MemoryList';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Memory } from '@/components/MemoryList';
import { getSharedBoard, fetchMemories } from '@/lib/db';
import { toast } from '@/hooks/use-toast';

const SharedMemories = () => {
  const { code } = useParams<{ code: string }>();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [boardName, setBoardName] = useState('Shared Memories');

  useEffect(() => {
    const loadSharedMemories = async () => {
      if (!code) {
        setLoading(false);
        return;
      }

      try {
        // Get the shared board by code
        const board = await getSharedBoard(code);
        
        if (!board) {
          toast({
            title: 'Invalid share code',
            description: 'This share code doesn\'t exist or has expired.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
        
        if (board.name) {
          setBoardName(board.name);
        }
        
        // Get memories using the share code
        const sharedMemories = await fetchMemories(code);
        setMemories(sharedMemories);
      } catch (error) {
        console.error('Error loading shared memories:', error);
        toast({
          title: 'Error',
          description: 'Failed to load shared memories.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadSharedMemories();
  }, [code]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        
        <h1 className="text-lg font-medium">{boardName}</h1>
        
        <div className="w-8"></div>
      </header>
      
      <main className="flex-1">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <p>Loading shared memories...</p>
          </div>
        ) : memories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <p>No memories found for this share code.</p>
            <Button asChild className="mt-4">
              <Link to="/">Back to my timeline</Link>
            </Button>
          </div>
        ) : (
          <MemoryList memories={memories} />
        )}
      </main>
    </div>
  );
};

export default SharedMemories;