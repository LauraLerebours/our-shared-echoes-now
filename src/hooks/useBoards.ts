import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Board, boardsApi } from '@/lib/api/boards';
import { useAsyncOperation } from './useAsyncOperation';
import { supabase } from '@/integrations/supabase/client';

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
    async (name: string, isPublic: boolean = false) => {
      if (!user?.id) throw new Error('User not authenticated');
      const result = await boardsApi.createBoard(name, isPublic, user.id);
      if (!result.success || !result.data) throw new Error(result.error || 'Failed to create board');
      if (mountedRef.current) {
        setBoards(prev => [...prev, result.data!]);
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
        setBoards(prev => prev.filter(board => board.id !== boardId));
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
      // Direct query approach - more reliable than RPC
      const { data: boardsData, error: boardsError } = await supabase
        .from('boards')
        .select('*')
        .or(`owner_id.eq.${user.id},member_ids.cs.{${user.id}}`)
        .order('created_at', { ascending: false });
      
      // Check if request was aborted or component unmounted
      if (abortControllerRef.current?.signal.aborted || !mountedRef.current || isSigningOut) {
        console.log('🛑 [useBoards] Request aborted or component unmounted, skipping state update');
        return;
      }
      
      if (boardsError) {
        console.error('❌ [useBoards] Failed to load boards:', boardsError);
        
        // Implement retry logic for transient errors
        if (retryCountRef.current < maxRetries && 
            (boardsError.message?.includes('timeout') || 
             boardsError.message?.includes('network') || 
             boardsError.message?.includes('connection'))) {
          
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
        
        setError(boardsError.message || 'Failed to load boards');
        setBoards([]);
        hasLoadedRef.current = false;
        return;
      }
      
      if (boardsData) {
        console.log('✅ [useBoards] Boards loaded successfully:', boardsData.length);
        setBoards(boardsData);
        setError(null);
        hasLoadedRef.current = true;
        retryCountRef.current = 0; // Reset retry count on success
      } else {
        console.log('✅ [useBoards] No boards found, setting empty array');
        setBoards([]);
        setError(null);
        hasLoadedRef.current = true;
        retryCountRef.current = 0;
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