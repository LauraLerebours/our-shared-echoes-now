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
import { deleteMemory, createBoard } from '@/lib/db';
import { memoriesApi } from '@/lib/api/memories';
import { useBoards } from '@/hooks/useBoards';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Grid3X3, List, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [memoriesError, setMemoriesError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');
  const { user, loading: authLoading } = useAuth();
  const mainRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  
  // Use the optimized boards hook
  const { 
    boards, 
    loading: boardsLoading, 
    error: boardsError, 
    createBoard: createNewBoard,
    retryLoad: retryBoardsLoad 
  } = useBoards();
  
  // Optimized memories loading with parallel processing
  useEffect(() => {
    const loadMemories = async () => {
      if (!user?.id || boards.length === 0) {
        console.log('🔄 [Index] No user or no boards, clearing memories');
        setMemories([]);
        setMemoriesLoading(false);
        setMemoriesError(null);
        return;
      }

      console.log('🔄 [Index] Loading memories for', boards.length, 'boards');
      setMemoriesLoading(true);
      setMemoriesError(null);

      try {
        // Extract access codes from boards
        const accessCodes = boards
          .map(board => board.access_code)
          .filter((code): code is string => code !== null && code !== undefined);
        
        console.log('🔄 [Index] Access codes:', accessCodes.length);
        
        if (accessCodes.length > 0) {
          // Use the optimized parallel loading
          const result = await memoriesApi.fetchMemoriesByAccessCodes(accessCodes, 100);
          
          if (result.success && result.data) {
            console.log('✅ [Index] Memories loaded:', result.data.length);
            setMemories(result.data);
            setMemoriesError(null);
          } else {
            console.error('❌ [Index] Failed to load memories:', result.error);
            setMemoriesError(result.error || 'Failed to load memories');
            setMemories([]);
          }
        } else {
          console.log('✅ [Index] No access codes, empty memories');
          setMemories([]);
          setMemoriesError(null);
        }
      } catch (error) {
        console.error('❌ [Index] Error loading memories:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load memories';
        setMemoriesError(errorMessage);
        setMemories([]);
      } finally {
        setMemoriesLoading(false);
      }
    };

    loadMemories();
  }, [user?.id, boards]);

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

  const handleRetry = async () => {
    console.log('🔄 [Index] Retry triggered');
    retryBoardsLoad();
    setMemoriesError(null);
  };

  const handleRetryMemories = () => {
    console.log('🔄 [Index] Retry memories triggered');
    setMemoriesError(null);
    // This will trigger the useEffect to reload memories
  };

  const handleCreateDefaultBoard = async () => {
    if (!user?.id) return;
    
    try {
      await createNewBoard('My Memories');
    } catch (error) {
      console.error('❌ Error creating default board:', error);
      toast({
        title: 'Error',
        description: 'Failed to create default board',
        variant: 'destructive',
      });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  // Show error state if boards failed to load
  if (boardsError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <h2 className="text-xl font-semibold text-red-600 mb-4">Unable to Load Boards</h2>
          <p className="text-gray-600 mb-6">{boardsError}</p>
          <div className="space-y-3">
            <Button 
              onClick={handleRetry}
              className="w-full bg-memory-purple text-white hover:bg-memory-purple/90"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
            <Button 
              onClick={() => window.location.reload()}
              variant="outline"
              className="w-full"
            >
              Refresh Page
            </Button>
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
                <p>• Try again in a few minutes</p>
              </div>
            </details>
          </div>
        </div>
      </div>
    );
  }

  // Show memories error if boards loaded but memories failed
  if (memoriesError && !boardsLoading && boards.length > 0) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-background flex flex-col">
          <Header />
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md mx-auto p-6">
              <h2 className="text-xl font-semibold text-red-600 mb-4">Unable to Load Memories</h2>
              <p className="text-gray-600 mb-6">{memoriesError}</p>
              <Button 
                onClick={handleRetryMemories}
                className="bg-memory-purple text-white hover:bg-memory-purple/90"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </main>
          <Footer activeTab="timeline" />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        
        {/* View Mode Toggle */}
        {memories.length > 0 && !boardsLoading && !memoriesLoading && (
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
          {boardsLoading || memoriesLoading ? (
            <div className="flex justify-center items-center h-64">
              <LoadingSpinner size="lg" text={
                boardsLoading ? "Loading your boards..." : "Loading your memories..."
              } />
            </div>
          ) : boards.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <p className="text-muted-foreground mb-4">No boards found</p>
              <Button 
                onClick={handleCreateDefaultBoard}
                className="bg-memory-purple hover:bg-memory-purple/90"
              >
                Create Your First Board
              </Button>
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