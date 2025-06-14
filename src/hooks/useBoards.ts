import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Board, boardsApi } from '@/lib/api/boards';
import { useAsyncOperation } from './useAsyncOperation';

export function useBoards() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isSigningOut } = useAuth();
  
  // Prevent multiple simultaneous loads and race conditions
  const loadingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const currentUserRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { execute: executeCreateBoard, loading: creating } = useAsyncOperation(
    async (name: string) => {
      console.log('🔄 [useBoards] Creating new board:', name);
      if (!user?.id) throw new Error('User not authenticated');
      const result = await boardsApi.createBoard(name, user.id);
      if (!result.success || !result.data) throw new Error(result.error || 'Failed to create board');
      if (mountedRef.current) {
        console.log('✅ [useBoards] Board created successfully:', result.data.name);
        setBoards(prev => [...prev, result.data!]);
      }
      return result.data;
    },
    { successMessage: 'Board created successfully' }
  );

  const { execute: executeRemoveFromBoard, loading: removing } = useAsyncOperation(
    async (boardId: string) => {
      console.log('🔄 [useBoards] Removing user from board:', boardId);
      if (!user?.id) throw new Error('User not authenticated');
      const result = await boardsApi.removeUserFromBoard(boardId, user.id);
      if (!result.success) throw new Error(result.message);
      if (mountedRef.current) {
        console.log('✅ [useBoards] User removed from board successfully');
        setBoards(prev => prev.filter(board => board.id !== boardId));
      }
      return result;
    },
    { successMessage: 'Successfully removed from board' }
  );

  const { execute: executeRenameBoard, loading: renaming } = useAsyncOperation(
    async (boardId: string, newName: string) => {
      console.log('🔄 [useBoards] Renaming board:', boardId, 'to', newName);
      if (!user?.id) throw new Error('User not authenticated');
      const result = await boardsApi.renameBoard(boardId, newName, user.id);
      if (!result.success) throw new Error(result.message);
      if (mountedRef.current) {
        console.log('✅ [useBoards] Board renamed successfully to:', result.newName || newName);
        setBoards(prev => prev.map(board => 
          board.id === boardId ? { ...board, name: result.newName || newName } : board
        ));
      }
      return result;
    },
    { successMessage: 'Board renamed successfully' }
  );

  // Optimized load function with better race condition handling and abort support
  const loadBoards = async (isRetry = false) => {
    console.log('🔄 [useBoards] loadBoards called, isRetry:', isRetry);
    
    // Cancel any previous in-flight request
    if (abortControllerRef.current) {
      console.log('🛑 [useBoards] Cancelling previous request');
      abortControllerRef.current.abort();
    }
    
    // Create a new abort controller for this request
    abortControllerRef.current = new AbortController();
    
    if (!user?.id) {
      console.log('❌ [useBoards] No user ID, resetting state');
      if (mountedRef.current) {
        setLoading(false);
        setError(null);
        setBoards([]);
        hasLoadedRef.current = false;
        currentUserRef.current = null;
        loadingRef.current = false;
        retryCountRef.current = 0;
      }
      return;
    }
    
    // If user is signing out, don't load boards
    if (isSigningOut) {
      console.log('🛑 [useBoards] User is signing out, aborting board load');
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
    
    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }
    
    try {
      console.log('🔄 [useBoards] Calling boardsApi.fetchBoards...');
      const signal = abortControllerRef.current.signal;
      const result = await boardsApi.fetchBoards(user.id, signal);
      
      // Check if request was aborted or component unmounted
      if (signal.aborted || !mountedRef.current || isSigningOut) {
        console.log('🛑 [useBoards] Request aborted or component unmounted, skipping state update');
        return;
      }
      
      if (result.success && result.data) {
        console.log('✅ [useBoards] Boards loaded successfully:', result.data.length);
        console.log('📊 [useBoards] Board details:', result.data.map(b => ({
          id: b.id,
          name: b.name,
          memberCount: b.member_ids?.length || 0
        })));
        
        setBoards(result.data);
        setError(null);
        hasLoadedRef.current = true;
        retryCountRef.current = 0; // Reset retry count on success
      } else {
        console.error('❌ [useBoards] Failed to load boards:', result.error);
        
        // Handle aborted operations silently - don't show error to user
        if (result.error === 'Operation aborted by user') {
          console.log('🛑 [useBoards] Operation was aborted, clearing error state');
          setError(null);
          return;
        }
        
        // Implement retry logic for transient errors
        if (retryCountRef.current < maxRetries && 
            (result.error?.includes('timeout') || 
             result.error?.includes('network') || 
             result.error?.includes('connection'))) {
          
          retryCountRef.current++;
          console.log(`⏳ [useBoards] Retrying in 2 seconds (attempt ${retryCountRef.current}/${maxRetries})`);
          
          setTimeout(() => {
            if (mountedRef.current && !isSigningOut) {
              loadingRef.current = false;
              loadBoards(true);
            }
          }, 2000);
          return;
        }
        
        setError(result.error || 'Failed to load boards');
        setBoards([]);
        hasLoadedRef.current = false;
      }
    } catch (error) {
      // Check if request was aborted or component unmounted
      if (abortControllerRef.current?.signal.aborted || !mountedRef.current || isSigningOut) {
        console.log('🛑 [useBoards] Request aborted or component unmounted during error handling');
        return;
      }
      
      console.error('❌ [useBoards] Error loading boards:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Handle aborted operations silently - don't show error to user
      if (errorMessage === 'Operation aborted by user' || errorMessage === 'Request aborted') {
        console.log('🛑 [useBoards] Operation was aborted, clearing error state');
        setError(null);
        return;
      }
      
      // Implement retry logic for exceptions
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        console.log(`⏳ [useBoards] Retrying in 2 seconds (attempt ${retryCountRef.current}/${maxRetries})`);
        
        setTimeout(() => {
          if (mountedRef.current && !isSigningOut) {
            loadingRef.current = false;
            loadBoards(true);
          }
        }, 2000);
        return;
      }
      
      setError(errorMessage);
      setBoards([]);
      hasLoadedRef.current = false;
    } finally {
      if (mountedRef.current && !isSigningOut) {
        console.log('✅ [useBoards] Finished loading boards, setting loading=false');
        setLoading(false);
        loadingRef.current = false;
      }
    }
  };

  useEffect(() => {
    console.log('🔄 [useBoards] useEffect triggered with user.id:', user?.id);
    mountedRef.current = true;
    
    // Don't load boards if user is signing out
    if (!isSigningOut) {
      console.log('🔄 [useBoards] Calling loadBoards from useEffect');
      loadBoards();
    } else {
      console.log('🛑 [useBoards] User is signing out, skipping board load');
    }
    
    return () => {
      console.log('🧹 [useBoards] Cleaning up useBoards hook');
      mountedRef.current = false;
      
      // Cancel any in-flight requests when component unmounts
      if (abortControllerRef.current) {
        console.log('🛑 [useBoards] Aborting any in-flight requests during cleanup');
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [user?.id, isSigningOut]); // Add isSigningOut to dependencies

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
      if (user?.id && mountedRef.current && !isSigningOut) {
        console.log('🔄 [useBoards] Manual refresh triggered');
        // Reset state to force reload
        hasLoadedRef.current = false;
        currentUserRef.current = null;
        retryCountRef.current = 0;
        setError(null);
        loadBoards(true);
      } else {
        console.log('⚠️ [useBoards] Manual refresh skipped - no user, unmounted, or signing out');
      }
    },
    // Add retry function
    retryLoad: () => {
      if (mountedRef.current && !isSigningOut) {
        console.log('🔄 [useBoards] Retry load triggered');
        hasLoadedRef.current = false;
        currentUserRef.current = null;
        loadingRef.current = false;
        retryCountRef.current = 0;
        setError(null);
        loadBoards(true);
      } else {
        console.log('⚠️ [useBoards] Retry load skipped - unmounted or signing out');
      }
    }
  };
}