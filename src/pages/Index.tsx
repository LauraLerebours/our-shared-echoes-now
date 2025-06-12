import React, { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import MemoryList from '@/components/MemoryList';
import MemoryGrid from '@/components/MemoryGrid';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import ScrollToBottom from '@/components/ScrollToBottom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Memory } from '@/components/MemoryList';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMemories, deleteMemory, fetchBoards, createBoard, Board } from '@/lib/db';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Grid3X3, List } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');
  const { user, loading: authLoading } = useAuth();
  const mainRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  
  // Load boards and all memories
  useEffect(() => {
    const loadData = async () => {
      if (authLoading || !user?.id) {
        if (!authLoading) setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        // Load boards with timeout
        const boardsPromise = fetchBoards(user.id);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 30000)
        );
        
        const boardsData = await Promise.race([boardsPromise, timeoutPromise]) as Board[];
        setBoards(boardsData);
        
        // If no boards, create a default one
        if (boardsData.length === 0) {
          const defaultBoard = await createBoard('My Memories', user.id);
          if (defaultBoard) {
            setBoards([defaultBoard]);
            const memoriesData = await fetchMemories(defaultBoard.access_code);
            setMemories(memoriesData);
          } else {
            throw new Error('Failed to create default board');
          }
        } else {
          // Load memories from all boards
          const allMemories: Memory[] = [];
          
          for (const board of boardsData) {
            try {
              const boardMemories = await fetchMemories(board.access_code);
              allMemories.push(...boardMemories);
            } catch (error) {
              console.error(`Error loading memories for board ${board.name}:`, error);
            }
          }
          
          setMemories(allMemories);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load your memories';
        setError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [user?.id, authLoading]);

  const handleDeleteMemory = async (id: string) => {
    if (!user?.id) return;
    
    try {
      const memory = memories.find(m => m.id === id);
      if (!memory) return;

      const success = await deleteMemory(id, memory.accessCode);
      
      if (success) {
        setMemories(prev => prev.filter(memory => memory.id !== id));
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

  const handleViewDetail = (id: string, accessCode: string) => {
    navigate(`/memory/${id}`, { state: { accessCode } });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-memory-purple text-white rounded hover:bg-memory-purple/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        
        {/* View Mode Toggle */}
        {memories.length > 0 && (
          <div className="flex justify-center py-3 border-b bg-white sticky top-16 z-10">
            <div className="flex bg-muted rounded-lg p-1">
              <Button
                variant={viewMode === 'timeline' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('timeline')}
                className={viewMode === 'timeline' ? 'bg-memory-purple hover:bg-memory-purple/90' : ''}
              >
                <List className="h-4 w-4 mr-2" />
                Timeline
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'bg-memory-purple hover:bg-memory-purple/90' : ''}
              >
                <Grid3X3 className="h-4 w-4 mr-2" />
                Grid
              </Button>
            </div>
          </div>
        )}
        
        <main ref={mainRef} className="flex-1 relative">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <LoadingSpinner size="lg" text="Loading your memories..." />
            </div>
          ) : memories.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {viewMode === 'timeline' ? (
                <MemoryList 
                  memories={memories} 
                  onDeleteMemory={handleDeleteMemory}
                  onUpdateMemory={handleUpdateMemory}
                />
              ) : (
                <MemoryGrid 
                  memories={memories}
                  onViewDetail={handleViewDetail}
                  onUpdateMemory={handleUpdateMemory}
                />
              )}
              <ScrollToBottom containerRef={mainRef} />
            </>
          )}
        </main>
        
        <Footer activeTab="timeline" />
      </div>
    </ErrorBoundary>
  );
};

export default Index;