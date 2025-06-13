import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Board, boardsApi } from '@/lib/api/boards';
import { useAsyncOperation } from './useAsyncOperation';

export function useBoards() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  
  // Prevent multiple simultaneous loads and race conditions
  const loadingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const currentUserRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  const { execute: executeCreateBoard, loading: creating } = useAsyncOperation(
    async (name: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      const result = await boardsApi.createBoard(name, user.id);
      if (!result.success || !result.data) throw new Error(result.error || 'Failed to create board');
      setBoards(prev => [...prev, result.data!]);
      return result.data;
    },
    { successMessage: 'Board created successfully' }
  );

  const { execute: executeRemoveFromBoard, loading: removing } = useAsyncOperation(
    async (boardId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      const result = await boardsApi.removeUserFromBoard(boardId, user.id);
      if (!result.success) throw new Error(result.message);
      setBoards(prev => prev.filter(board => board.id !== boardId));
      return result;
    },
    { successMessage: 'Successfully removed from board' }
  );

  const { execute: executeRenameBoard, loading: renaming } = useAsyncOperation(
    async (boardId: string, newName: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      const result = await boardsApi.renameBoard(boardId, newName, user.id);
      if (!result.success) throw new Error(result.message);
      setBoards(prev => prev.map(board => 
        board.id === boardId ? { ...board, name: result.newName || newName } : board
      ));
      return result;
    },
    { successMessage: 'Board renamed successfully' }
  );

  // Optimized load function with resilience
  const loadBoards = async (isRetry = false) => {
    if (!user?.id) {
      console.log('❌ [useBoards] No user ID, resetting state');
      setLoading(false);
      setError(null);
      setBoards([]);
      hasLoadedRef.current = false;
      currentUserRef.current = null;
      loadingRef.current = false;
      retryCountRef.current = 0;
      return;
    }

    // Skip if already loading for the same user (unless it's a retry)
    if (loadingRef.current && currentUserRef.current === user.id && !isRetry) {
      console.log('⏳ [useBoards] Load already in progress for current user');
      return;
    }

    // Skip if we've already loaded successfully for this user (unless it's a retry)
    if (hasLoadedRef.current && currentUserRef.current === user.id && !error && !isRetry) {
      console.log('✅ [useBoards] Data already loaded for current user');
      return;
    }

    // Start loading
    loadingRef.current = true;
    currentUserRef.current = user.id;
    
    console.log(`🔄 [useBoards] Starting board load for user: ${user.id} (attempt ${retryCountRef.current + 1})`);
    setLoading(true);
    setError(null);
    
    try {
      const result = await boardsApi.fetchBoards(user.id);
      
      if (result.success && result.data) {
        console.log('✅ [useBoards] Boards loaded successfully:', result.data.length);
        setBoards(result.data);
        setError(null);
        hasLoadedRef.current = true;
        retryCountRef.current = 0; // Reset retry count on success
      } else {
        console.error('❌ [useBoards] Failed to load boards:', result.error);
        
        // Implement retry logic for transient errors
        if (retryCountRef.current < maxRetries && 
            (result.error?.includes('timeout') || 
             result.error?.includes('network') || 
             result.error?.includes('connection'))) {
          
          retryCountRef.current++;
          console.log(`⏳ [useBoards] Retrying in 2 seconds (attempt ${retryCountRef.current}/${maxRetries})`);
          
          setTimeout(() => {
            loadingRef.current = false;
            loadBoards(true);
          }, 2000);
          return;
        }
        
        setError(result.error || 'Failed to load boards');
        setBoards([]);
        hasLoadedRef.current = false;
      }
    } catch (error) {
      console.error('❌ [useBoards] Error loading boards:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Implement retry logic for exceptions
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        console.log(`⏳ [useBoards] Retrying in 2 seconds (attempt ${retryCountRef.current}/${maxRetries})`);
        
        setTimeout(() => {
          loadingRef.current = false;
          loadBoards(true);
        }, 2000);
        return;
      }
      
      setError(errorMessage);
      setBoards([]);
      hasLoadedRef.current = false;
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    loadBoards();
  }, [user?.id]); // Only depend on user ID

  return {
    boards,
    loading,
    error,
    creating,
    removing,
    renaming,
    createBoard: executeCreateBoard,
    removeFromBoard: executeRemoveFromBoard,
    renameBoard: executeRenameBoard,
    refreshBoards: () => {
      if (user?.id) {
        console.log('🔄 [useBoards] Manual refresh triggered');
        // Reset state to force reload
        hasLoadedRef.current = false;
        currentUserRef.current = null;
        retryCountRef.current = 0;
        setError(null);
        loadBoards(true);
      }
    },
    // Add retry function
    retryLoad: () => {
      console.log('🔄 [useBoards] Retry load triggered');
      hasLoadedRef.current = false;
      currentUserRef.current = null;
      loadingRef.current = false;
      retryCountRef.current = 0;
      setError(null);
      loadBoards(true);
    }
  };
}