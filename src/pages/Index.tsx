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
import { fetchMemories, deleteMemory, createBoard, Board } from '@/lib/db';
import { boardsApi } from '@/lib/api/boards';
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
      console.log('🔄 Index: Starting data load process');
      console.log('Auth state:', { user: !!user, userId: user?.id, authLoading });
      
      if (authLoading) {
        console.log('⏳ Auth still loading, waiting...');
        return;
      }
      
      if (!user?.id) {
        console.log('❌ No user found, stopping data load');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        console.log('🔄 Loading boards for user:', user.id);
        
        // Use the optimized boards API with longer timeout (30 seconds)
        const boardsResult = await Promise.race([
          boardsApi.fetchBoards(user.id),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000)
          )
        ]);
        
        if (!boardsResult.success) {
          throw new Error(boardsResult.error || 'Failed to load boards');
        }
        
        const boardsData = boardsResult.data || [];
        console.log('✅ Boards loaded successfully:', boardsData.length);
        setBoards(boardsData);
        
        // If no boards, create a default one
        if (boardsData.length === 0) {
          console.log('📝 No boards found, creating default board');
          try {
            const defaultBoard = await createBoard('My Memories', user.id);
            if (defaultBoard) {
              console.log('✅ Default board created:', defaultBoard.name);
              setBoards([defaultBoard]);
              
              // Load memories from the new board
              const memoriesData = await fetchMemories(defaultBoard.access_code);
              console.log('✅ Memories loaded from new board:', memoriesData.length);
              setMemories(memoriesData);
            } else {
              throw new Error('Failed to create default board');
            }
          } catch (boardCreationError) {
            console.error('❌ Failed to create default board:', boardCreationError);
            throw new Error('Failed to create your first board. Please try refreshing the page.');
          }
        } else {
          // Load memories from all boards with better error handling
          console.log('🔄 Loading memories from', boardsData.length, 'boards');
          const allMemories: Memory[] = [];
          const failedBoards: string[] = [];
          
          // Load memories from each board with individual error handling
          await Promise.allSettled(
            boardsData.map(async (board) => {
              try {
                console.log('🔄 Loading memories for board:', board.name, 'with access code:', board.access_code);
                const boardMemories = await fetchMemories(board.access_code);
                console.log('✅ Loaded', boardMemories.length, 'memories from board:', board.name);
                allMemories.push(...boardMemories);
              } catch (error) {
                console.error(`❌ Error loading memories for board ${board.name}:`, error);
                failedBoards.push(board.name);
              }
            })
          );
          
          console.log('✅ Total memories loaded:', allMemories.length);
          setMemories(allMemories);
          
          // Show warning if some boards failed to load
          if (failedBoards.length > 0) {
            toast({
              title: 'Partial Load Warning',
              description: `Could not load memories from ${failedBoards.length} board(s): ${failedBoards.join(', ')}`,
              variant: 'destructive',
            });
          }
        }
      } catch (error) {
        console.error('❌ Error loading data:', error);
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
      console.error('❌ Error deleting memory:', error);
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
        <div className="text-center max-w-md mx-auto p-6">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Unable to Load Data</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-3">
            <button 
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-memory-purple text-white rounded hover:bg-memory-purple/90"
            >
              Retry
            </button>
            <details className="text-left">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                Troubleshooting Tips
              </summary>
              <div className="mt-2 text-xs text-gray-500 space-y-1">
                <p>• Check your internet connection</p>
                <p>• Try refreshing the page</p>
                <p>• Clear your browser cache</p>
                <p>• Check browser console for errors (F12)</p>
                <p>• Database may be experiencing high load</p>
              </div>
            </details>
          </div>
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