import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MemoryList from '@/components/MemoryList';
import ScrollToBottom from '@/components/ScrollToBottom';
import { Memory } from '@/components/MemoryList';
import { fetchMemories, getBoardById, deleteMemory } from '@/lib/db';
import { toast } from '@/hooks/use-toast';
import { Board } from '@/lib/db';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';

const BoardView = () => {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const loadBoard = async () => {
      if (!boardId || !user?.id) return;

      try {
        setLoading(true);
        setError(null);
        
        // First, get the board details
        const boardData = await getBoardById(boardId, user.id);
        
        if (!boardData) {
          setError('Board not found or you do not have access');
          toast({
            title: 'Board not found',
            description: 'The requested board could not be found.',
            variant: 'destructive',
          });
          navigate('/boards');
          return;
        }

        setBoard(boardData);
        
        // Then, load memories for this board using its access code
        if (boardData.access_code) {
          console.log(`Loading memories for board: ${boardData.name} with access code: ${boardData.access_code}`);
          const memoriesData = await fetchMemories(boardData.access_code);
          
          if (Array.isArray(memoriesData)) {
            setMemories(memoriesData);
            console.log(`Loaded ${memoriesData.length} memories for board: ${boardData.name}`);
          } else {
            console.error('Failed to load memories, unexpected data format:', memoriesData);
            setError('Failed to load memories');
          }
        } else {
          console.error('Board has no access code:', boardData);
          setError('Board has no access code');
        }
      } catch (error) {
        console.error('Error loading board:', error);
        setError('Failed to load board content');
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
    if (!board?.access_code) return;
    
    try {
      const success = await deleteMemory(id, board.access_code);
      
      if (success) {
        setMemories(memories.filter(memory => memory.id !== id));
        toast({
          title: "Memory deleted",
          description: "Your memory has been deleted successfully",
        });
      } else {
        throw new Error('Failed to delete memory');
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

  const handleUpdateMemory = (id: string, updates: Partial<Memory>) => {
    setMemories(prev => prev.map(memory => 
      memory.id === id ? { ...memory, ...updates } : memory
    ));
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
          <Button variant="ghost" size="sm" onClick={() => navigate('/boards')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <h1 className="text-lg font-medium">Error</h1>
          
          <div className="w-8"></div>
        </header>
        
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-4">Unable to Load Board</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button 
              onClick={() => navigate('/boards')}
              className="bg-memory-purple hover:bg-memory-purple/90"
            >
              Back to Boards
            </Button>
          </div>
        </main>
      </div>
    );
  }

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
      
      <main ref={mainRef} className="flex-1 relative">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner size="md" text="Loading board content..." />
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
          <>
            <MemoryList 
              memories={memories} 
              onDeleteMemory={handleDeleteMemory}
              onUpdateMemory={handleUpdateMemory}
            />
            <ScrollToBottom containerRef={mainRef} />
          </>
        )}
      </main>
    </div>
  );
};

export default BoardView;