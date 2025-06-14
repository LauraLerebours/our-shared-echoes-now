import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Board, boardsApi } from '@/lib/api/boards';
import { useAsyncOperation } from './useAsyncOperation';

// Create a cache key for boards
const BOARDS_CACHE_KEY = 'thisisus_boards';

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
      if (!user?.id) throw new Error('User not authenticated');
      const result = await boardsApi.createBoard(name, user.id);
      if (!result.success || !result.data) throw new Error(result.error || 'Failed to create board');
      if (mountedRef.current) {
        const updatedBoards = [...boards, result.data!];
        setBoards(updatedBoards);
        
        // Update cache with new board
        updateBoardsCache(updatedBoards);
      }
      return result.data;
    },
    { successMessage: 'Board created successfully' }
  );

  const { execute: executeRemoveFromBoard, loading: removing } = useAsyncOperation(
    async (boardId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      const result = await boardsApi.removeUserFromBoard(boardId, user.id);
      if (!result.success) throw new Error(result.message);
      if (mountedRef.current) {
        const updatedBoards = boards.filter(board => board.id !== boardId);
        setBoards(updatedBoards);
        
        // Update cache with updated boards list
        updateBoardsCache(updatedBoards);
      }
      return result;
    },
    { successMessage: 'Successfully removed from board' }
  );

  const { execute: executeRenameBoard, loading: renaming } = useAsyncOperation(
    async (boardId: string, newName: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      const result = await boardsApi.renameBoard(boardId, newName, user.id);
      if (!result.success) throw new Error(result.message);
      if (mountedRef.current) {
        const updatedBoards = boards.map(board => 
          board.id === boardId ? { ...board, name: result.newName || newName } : board
        );
        setBoards(updatedBoards);
        
        // Update cache with renamed board
        updateBoardsCache(updatedBoards);
      }
      return result;
    },
    { successMessage: 'Board renamed successfully' }
  );

  // Function to get cached boards
  const getBoardsFromCache = (): Board[] | null => {
    try {
      const cachedData = localStorage.getItem(BOARDS_CACHE_KEY);
      if (cachedData) {
        const { boards, userId, timestamp } = JSON.parse(cachedData);
        
        // Only use cache if it's for the current user
        if (userId === user?.id) {
          // Check if cache is still valid (less than 5 minutes old)
          const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
          if (Date.now() - timestamp < CACHE_TTL) {
            console.log('📋 [useBoards] Using cached boards for user:', userId);
            return boards;
          } else {
            console.log('⏰ [useBoards] Cache expired for user:', userId);
          }
        }
      }
    } catch (error) {
      console.error('❌ [useBoards] Error reading from cache:', error);
    }
    return null;
  };

  // Function to update boards cache
  const updateBoardsCache = (boardsData: Board[]) => {
    if (!user?.id) return;
    
    try {
      localStorage.setItem(BOARDS_CACHE_KEY, JSON.stringify({
        boards: boardsData,
        userId: user.id,
        timestamp: Date.now()
      }));
      console.log('💾 [useBoards] Updated boards cache for user:', user.id);
    } catch (error) {
      console.error('❌ [useBoards] Error updating cache:', error);
    }
  };

  // Optimized load function with better race condition handling and abort support
  const loadBoards = async (isRetry = false) => {
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
      
      // Try to get boards from cache first for immediate UI update
      const cachedBoards = getBoardsFromCache();
      if (cachedBoards) {
        console.log('📋 [useBoards] Setting boards from cache:', cachedBoards.length);
        setBoards(cachedBoards);
        setError(null);
        
        // Don't set loading to false yet, as we're still fetching fresh data
        // But we can set hasLoaded to true to prevent unnecessary loading states
        hasLoadedRef.current = true;
      }
    }
    
    try {
      const signal = abortControllerRef.current.signal;
      console.log('🔄 [useBoards] Fetching fresh boards data from API');
      const result = await boardsApi.fetchBoards(user.id, signal);
      
      // Check if request was aborted or component unmounted
      if (signal.aborted || !mountedRef.current || isSigningOut) {
        console.log('🛑 [useBoards] Request aborted or component unmounted, skipping state update');
        return;
      }
      
      if (result.success && result.data) {
        console.log('✅ [useBoards] Boards loaded successfully:', result.data.length);
        setBoards(result.data);
        setError(null);
        hasLoadedRef.current = true;
        retryCountRef.current = 0; // Reset retry count on success
        
        // Update cache with fresh data
        updateBoardsCache(result.data);
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
        
        // If we have cached data, keep using it despite the error
        if (!getBoardsFromCache()) {
          setBoards([]);
        }
        
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
      
      // If we have cached data, keep using it despite the error
      if (!getBoardsFromCache()) {
        setBoards([]);
      }
      
      hasLoadedRef.current = false;
    } finally {
      if (mountedRef.current && !isSigningOut) {
        setLoading(false);
        loadingRef.current = false;
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    
    // Don't load boards if user is signing out
    if (!isSigningOut) {
      loadBoards();
    }
    
    return () => {
      mountedRef.current = false;
      
      // Cancel any in-flight requests when component unmounts
      if (abortControllerRef.current) {
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
      }
    }
  };
}