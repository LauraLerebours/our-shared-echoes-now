
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Board, boardsApi } from '@/lib/api/boards';
import { useAsyncOperation } from './useAsyncOperation';

export function useBoards() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

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
      if (!user?.id) {
        setLoading(false);
        return;
      }
      
      try {
        const result = await boardsApi.fetchBoards(user.id);
        if (result.success && result.data) {
          setBoards(result.data);
        } else {
          console.error('Error loading boards:', result.error);
        }
      } catch (error) {
        console.error('Error loading boards:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadBoards();
  }, [user?.id]);

  return {
    boards,
    loading,
    creating,
    removing,
    renaming,
    createBoard: executeCreateBoard,
    removeFromBoard: executeRemoveFromBoard,
    renameBoard: executeRenameBoard,
    refreshBoards: () => {
      if (user?.id) {
        boardsApi.fetchBoards(user.id).then(result => {
          if (result.success && result.data) {
            setBoards(result.data);
          }
        });
      }
    }
  };
}
