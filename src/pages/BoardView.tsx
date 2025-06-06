import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MemoryList from '@/components/MemoryList';
import { Memory } from '@/components/MemoryList';
import { fetchMemories, getBoardById, deleteMemory } from '@/lib/db';
import { toast } from '@/hooks/use-toast';
import { Board } from '@/lib/db';
import { useAuth } from '@/contexts/AuthContext';

const BoardView = () => {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBoard = async () => {
      if (!boardId || !user?.id) return;

      try {
        setLoading(true);
        const boardData = await getBoardById(boardId, user.id);
        
        if (!boardData) {
          toast({
            title: 'Board not found',
            description: 'The requested board could not be found.',
            variant: 'destructive',
          });
          navigate('/boards');
          return;
        }

        setBoard(boardData);
        
        // Load memories for this board
        const memoriesData = await fetchMemories(boardData.access_code);
        setMemories(memoriesData);
      } catch (error) {
        console.error('Error loading board:', error);
        toast({
          title: 'Error',
          description: 'Failed to load board content',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadBoard();
  }, [boardId, user?.id, navigate]);

  const handleDeleteMemory = async (id: string) => {
    if (!board) return;
    
    try {
      const success = await deleteMemory(id, board.access_code);
      
      if (success) {
        setMemories(memories.filter(memory => memory.id !== id));
        toast({
          title: "Memory deleted",
          description: "Your memory has been deleted successfully",
        });
      }
    } catch (error) {
      console.error('Error deleting memory:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete memory',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
        <Button variant="ghost" size="sm" onClick={() => navigate('/boards')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <h1 className="text-lg font-medium">{board?.name || 'Loading...'}</h1>
        
        <Button 
          size="sm"
          onClick={() => navigate('/add', { state: { boardId: boardId } })}
          className="bg-memory-purple hover:bg-memory-purple/90"
        >
          Add Memory
        </Button>
      </header>
      
      <main className="flex-1">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <p>Loading board content...</p>
          </div>
        ) : memories.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <p className="text-muted-foreground mb-4">No memories in this board yet</p>
            <Button 
              onClick={() => navigate('/add', { state: { boardId: boardId } })}
              className="bg-memory-purple hover:bg-memory-purple/90"
            >
              Add Your First Memory
            </Button>
          </div>
        ) : (
          <MemoryList 
            memories={memories} 
            onDeleteMemory={handleDeleteMemory}
          />
        )}
      </main>
    </div>
  );
};

export default BoardView;