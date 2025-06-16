import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import MemoryList from '@/components/MemoryList';
import ScrollToBottom from '@/components/ScrollToBottom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { Memory } from '@/components/MemoryList';
import { fetchMemories, Board } from '@/lib/db';
import { boardsApi } from '@/lib/api/boards';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const SharedMemories = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [board, setBoard] = useState<Board | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const loadSharedMemories = async () => {
      if (!code) {
        setLoading(false);
        return;
      }

      try {
        // Get the board by share code
        const boardResult = await boardsApi.getBoardByShareCode(code);
        
        if (!boardResult.success || !boardResult.data) {
          toast({
            title: 'Invalid share code',
            description: 'This share code doesn\'t exist or has expired.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
        
        setBoard(boardResult.data);
        
        // Get memories using the board's access code
        const sharedMemories = await fetchMemories(boardResult.data.access_code);
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

  const handleJoinBoard = async () => {
    if (!code || !user) {
      if (!user) {
        toast({
          title: 'Sign in required',
          description: 'Please sign in to join this board.',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }
      return;
    }

    setIsJoining(true);
    try {
      console.log('🔄 [SharedMemories] Attempting to join board with code:', code);
      
      const result = await boardsApi.addUserToBoard(code, user.id);
      
      if (result.success) {
        const boardName = result.board?.name || board?.name || 'the board';
        toast({
          title: `Welcome to "${boardName}"! 🎉`,
          description: result.message || 'You have successfully joined the board.',
        });
        
        // Navigate to the user's boards page to see the newly added board
        navigate('/boards');
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to join board. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error joining board:', error);
      toast({
        title: 'Error',
        description: 'Failed to join board. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleUpdateMemory = (id: string, updates: Partial<Memory>) => {
    setMemories(prev => prev.map(memory => 
      memory.id === id ? { ...memory, ...updates } : memory
    ));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white z-10">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <h1 className="text-lg font-medium">
          {board?.name || 'Shared Memories'}
        </h1>
        
        {user && (
          <Button 
            size="sm"
            onClick={handleJoinBoard}
            disabled={isJoining}
            className="bg-memory-purple hover:bg-memory-purple/90"
          >
            <UserPlus className="h-4 w-4 mr-1" />
            {isJoining ? 'Joining...' : 'Join Board'}
          </Button>
        )}
      </header>
      
      <main ref={mainRef} className="flex-1 relative">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <p>Loading shared memories...</p>
          </div>
        ) : !board ? (
          <div className="flex flex-col items-center justify-center h-64">
            <p>Board not found for this share code.</p>
            <Button onClick={() => navigate('/boards')} className="mt-4">
              Back to my boards
            </Button>
          </div>
        ) : (
          <>
            {!user && (
              <div className="bg-memory-lightpurple/20 border-l-4 border-memory-purple p-4 m-4">
                <p className="text-sm">
                  <strong>Sign in to join this board</strong> and collaborate with others!
                </p>
                <Button 
                  size="sm" 
                  className="mt-2 bg-memory-purple hover:bg-memory-purple/90"
                  onClick={() => navigate('/auth')}
                >
                  Sign In
                </Button>
              </div>
            )}
            
            {memories.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64">
                <p>No memories in this board yet.</p>
                {user && (
                  <Button 
                    onClick={handleJoinBoard}
                    disabled={isJoining}
                    className="mt-4 bg-memory-purple hover:bg-memory-purple/90"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    {isJoining ? 'Joining...' : 'Join Board to Add Memories'}
                  </Button>
                )}
              </div>
            ) : (
              <>
                <MemoryList 
                  memories={memories} 
                  onUpdateMemory={handleUpdateMemory}
                />
                <ScrollToBottom containerRef={mainRef} />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default SharedMemories;