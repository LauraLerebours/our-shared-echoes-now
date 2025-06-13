import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Board, createBoard, removeUserFromBoard, renameBoard, fetchBoards } from '@/lib/db';
import { useAsyncOperation } from './useAsyncOperation';

export function useBoards() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const { execute: executeCreateBoard, loading: creating } = useAsyncOperation(
    async (name: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      const result = await createBoard(name, user.id);
      if (!result.success || !result.data) throw new Error(result.error || 'Failed to create board');
      setBoards(prev => [...prev, result.data!]);
      return result.data;
    },
    { successMessage: 'Board created successfully' }
  );

  const { execute: executeRemoveFromBoard, loading: removing } = useAsyncOperation(
    async (boardId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      const result = await removeUserFromBoard(boardId, user.id);
      if (!result.success) throw new Error(result.message);
      setBoards(prev => prev.filter(board => board.id !== boardId));
      return result;
    },
    { successMessage: 'Successfully removed from board' }
  );

  const { execute: executeRenameBoard, loading: renaming } = useAsyncOperation(
    async (boardId: string, newName: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      const result = await renameBoard(boardId, newName, user.id);
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
        const result = await fetchBoards(user.id);
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
        fetchBoards(user.id).then(result => {
          if (result.success && result.data) {
            setBoards(result.data);
          }
        });
      }
    }
  };
}