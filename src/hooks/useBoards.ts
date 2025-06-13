import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Board, boardsApi } from '@/lib/api/boards';
import { useAsyncOperation } from './useAsyncOperation';

export function useBoards() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  
  // Prevent multiple simultaneous loads
  const loadingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const currentUserRef = useRef<string | null>(null);

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

  useEffect(() => {
    const loadBoards = async () => {
      // Skip if no user
      if (!user?.id) {
        console.log('❌ [useBoards] No user ID, resetting state');
        setLoading(false);
        setError(null);
        setBoards([]);
        hasLoadedRef.current = false;
        currentUserRef.current = null;
        loadingRef.current = false;
        return;
      }

      // Skip if already loading for the same user
      if (loadingRef.current && currentUserRef.current === user.id) {
        console.log('⏳ [useBoards] Load already in progress for current user');
        return;
      }

      // Skip if we've already loaded successfully for this user
      if (hasLoadedRef.current && currentUserRef.current === user.id && !error) {
        console.log('✅ [useBoards] Data already loaded for current user');
        return;
      }

      // Start loading
      loadingRef.current = true;
      currentUserRef.current = user.id;
      
      console.log('🔄 [useBoards] Starting board load for user:', user.id);
      setLoading(true);
      setError(null);
      
      try {
        const result = await boardsApi.fetchBoards(user.id);
        
        if (result.success && result.data) {
          console.log('✅ [useBoards] Boards loaded successfully:', result.data.length);
          setBoards(result.data);
          setError(null);
          hasLoadedRef.current = true;
        } else {
          console.error('❌ [useBoards] Failed to load boards:', result.error);
          setError(result.error || 'Failed to load boards');
          setBoards([]);
          hasLoadedRef.current = false;
        }
      } catch (error) {
        console.error('❌ [useBoards] Error loading boards:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        setError(errorMessage);
        setBoards([]);
        hasLoadedRef.current = false;
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    };
    
    loadBoards();
  }, [user?.id, error]); // Include error in dependencies to allow retry

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
        setError(null);
        
        boardsApi.fetchBoards(user.id).then(result => {
          if (result.success && result.data) {
            setBoards(result.data);
            setError(null);
            hasLoadedRef.current = true;
          } else {
            setError(result.error || 'Failed to refresh boards');
            hasLoadedRef.current = false;
          }
        });
      }
    },
    // Add retry function
    retryLoad: () => {
      console.log('🔄 [useBoards] Retry load triggered');
      hasLoadedRef.current = false;
      currentUserRef.current = null;
      loadingRef.current = false;
      setError(null);
    }
  };
}