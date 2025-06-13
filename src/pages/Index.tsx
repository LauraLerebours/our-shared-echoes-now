import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { deleteMemory, createBoard, Board } from '@/lib/db';
import { boardsApi } from '@/lib/api/boards';
import { memoriesApi } from '@/lib/api/memories';
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
  const loadingRef = useRef(false); // Prevent multiple simultaneous loads
  const hasLoadedRef = useRef(false); // Track if we've successfully loaded once
  
  // Memoized load function to prevent infinite recursion
  const loadData = useCallback(async () => {
    // Prevent multiple simultaneous loads
    if (loadingRef.current) {
      console.log('⏳ Load already in progress, skipping...');
      return;
    }

    // Skip if auth is still loading
    if (authLoading) {
      console.log('⏳ Auth still loading, waiting...');
      return;
    }
    
    // Skip if no user
    if (!user?.id) {
      console.log('❌ No user found, stopping data load');
      setLoading(false);
      return;
    }

    // If we've already loaded successfully and user hasn't changed, skip
    if (hasLoadedRef.current && !error) {
      console.log('✅ Data already loaded successfully, skipping reload');
      return;
    }
    
    loadingRef.current = true;
    console.log('🔄 Index: Starting optimized data load process');
    console.log('Auth state:', { user: !!user, userId: user?.id, authLoading });
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Loading data with optimized approach for user:', user.id);
      
      // Use Promise.allSettled to load boards and memories in parallel with individual timeouts
      const [boardsResult, memoriesResult] = await Promise.allSettled([
        // Load boards with timeout
        Promise.race([
          boardsApi.fetchBoards(user.id),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Boards request timeout after 30 seconds')), 30000)
          )
        ]),
        // Load all user memories directly with timeout - increased to 120 seconds
        Promise.race([
          memoriesApi.fetchUserMemories(user.id),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Memories request timeout after 120 seconds')), 120000)
          )
        ])
      ]);

      // Handle boards result
      if (boardsResult.status === 'fulfilled') {
        const boardsResponse = boardsResult.value as any;
        if (boardsResponse.success && boardsResponse.data) {
          console.log('✅ Boards loaded successfully:', boardsResponse.data.length);
          setBoards(boardsResponse.data);
        } else {
          console.warn('⚠️ Boards loading failed:', boardsResponse.error);
          // Try to create a default board if no boards exist
          try {
            const defaultBoard = await createBoard('My Memories', user.id);
            if (defaultBoard) {
              console.log('✅ Default board created:', defaultBoard.name);
              setBoards([defaultBoard]);
            }
          } catch (boardCreationError) {
            console.error('❌ Failed to create default board:', boardCreationError);
          }
        }
      } else {
        console.error('❌ Boards loading failed:', boardsResult.reason);
        // Don't show toast here to prevent potential re-renders
        console.warn('Could not load boards. Some features may be limited.');
      }

      // Handle memories result
      if (memoriesResult.status === 'fulfilled') {
        const memoriesResponse = memoriesResult.value as any;
        if (memoriesResponse.success && memoriesResponse.data) {
          console.log('✅ Memories loaded successfully:', memoriesResponse.data.length);
          setMemories(memoriesResponse.data);
        } else {
          console.warn('⚠️ Memories loading failed:', memoriesResponse.error);
          setMemories([]);
        }
      } else {
        console.error('❌ Memories loading failed:', memoriesResult.reason);
        setMemories([]);
        // Don't show toast here to prevent potential re-renders
        console.warn('Could not load memories. Please try refreshing.');
      }

      console.log('✅ Data loading completed');
      hasLoadedRef.current = true; // Mark as successfully loaded
      
    } catch (error) {
      console.error('❌ Error in data loading process:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load your data';
      setError(errorMessage);
      // Don't show toast here to prevent potential re-renders during error state
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [user?.id, authLoading, error]); // Only depend on essential values

  // Load data with proper dependency management
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset loading state when user changes
  useEffect(() => {
    if (user?.id) {
      hasLoadedRef.current = false; // Reset loaded flag when user changes
    }
  }, [user?.id]);

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

  const handleRetry = useCallback(() => {
    hasLoadedRef.current = false; // Reset loaded flag to force reload
    setError(null);
    loadData();
  }, [loadData]);

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