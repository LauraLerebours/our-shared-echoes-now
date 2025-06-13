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
import { deleteMemory, createBoard, Board, fetchMemoriesByAccessCodes } from '@/lib/db';
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
  
  // Prevent multiple simultaneous loads and track loading state
  const loadingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const currentUserRef = useRef<string | null>(null);
  
  // Load data effect - only runs when user changes or on mount
  useEffect(() => {
    // Skip if auth is still loading
    if (authLoading) {
      console.log('⏳ Auth still loading, waiting...');
      return;
    }
    
    // Skip if no user
    if (!user?.id) {
      console.log('❌ No user found, stopping data load');
      setLoading(false);
      setError(null);
      setMemories([]);
      setBoards([]);
      hasLoadedRef.current = false;
      currentUserRef.current = null;
      return;
    }

    // Skip if already loading for the same user
    if (loadingRef.current && currentUserRef.current === user.id) {
      console.log('⏳ Load already in progress for current user, skipping...');
      return;
    }

    // Skip if we've already loaded successfully for this user
    if (hasLoadedRef.current && currentUserRef.current === user.id && !error) {
      console.log('✅ Data already loaded successfully for current user, skipping reload');
      return;
    }

    // Start loading
    const loadData = async () => {
      loadingRef.current = true;
      currentUserRef.current = user.id;
      
      console.log('🔄 Index: Starting data load for user:', user.id);
      
      try {
        setLoading(true);
        setError(null);
        
        // First load boards with timeout
        console.log('🔄 Loading boards...');
        const boardsResult = await Promise.race([
          boardsApi.fetchBoards(user.id),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Boards request timeout after 30 seconds')), 30000)
          )
        ]);

        let loadedBoards: Board[] = [];
        
        // Handle boards result
        if ((boardsResult as any).success && (boardsResult as any).data) {
          console.log('✅ Boards loaded successfully:', (boardsResult as any).data.length);
          loadedBoards = (boardsResult as any).data;
          setBoards(loadedBoards);
        } else {
          console.warn('⚠️ Boards loading failed, creating default board');
          try {
            const defaultBoard = await createBoard('My Memories', user.id);
            if (defaultBoard) {
              console.log('✅ Default board created:', defaultBoard.name);
              loadedBoards = [defaultBoard];
              setBoards(loadedBoards);
            } else {
              setBoards([]);
            }
          } catch (boardCreationError) {
            console.error('❌ Failed to create default board:', boardCreationError);
            setBoards([]);
          }
        }

        // Extract access codes from boards
        const accessCodes = loadedBoards
          .map(board => board.access_code)
          .filter((code): code is string => code !== null && code !== undefined);
        
        console.log('🔄 Loading memories for access codes:', accessCodes.length);
        
        // Load memories using access codes with limit
        if (accessCodes.length > 0) {
          const memoriesData = await fetchMemoriesByAccessCodes(accessCodes, 100);
          console.log('✅ Memories loaded successfully:', memoriesData.length);
          setMemories(memoriesData);
        } else {
          console.log('✅ No access codes available, setting empty memories');
          setMemories([]);
        }

        console.log('✅ Data loading completed successfully');
        hasLoadedRef.current = true;
        
      } catch (error) {
        console.error('❌ Error in data loading process:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load your data';
        setError(errorMessage);
        hasLoadedRef.current = false;
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    };

    loadData();
  }, [user?.id, authLoading]); // Only depend on user ID and auth loading state

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

  const handleRetry = () => {
    // Reset state to force reload
    hasLoadedRef.current = false;
    currentUserRef.current = null;
    setError(null);
    
    // Trigger reload by updating a dependency
    if (user?.id) {
      // Force re-run of the effect by clearing the loaded state
      const userId = user.id;
      setTimeout(() => {
        if (currentUserRef.current !== userId) {
          currentUserRef.current = userId;
        }
      }, 0);
    }
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
              onClick={handleRetry}
              className="w-full px-4 py-2 bg-memory-purple text-white rounded hover:bg-memory-purple/90"
            >
              Retry
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            >
              Refresh Page
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
                <p>• Try again in a few minutes</p>
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