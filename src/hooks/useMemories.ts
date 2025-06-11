import { useState, useEffect } from 'react';
import { Memory } from '@/components/MemoryList';
import { fetchMemories, deleteMemory, createMemory } from '@/lib/db';
import { useAsyncOperation } from './useAsyncOperation';

export function useMemories(accessCode?: string) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  const { execute: executeDeleteMemory, loading: deleting } = useAsyncOperation(
    async (memoryId: string, memoryAccessCode: string) => {
      const success = await deleteMemory(memoryId, memoryAccessCode);
      if (!success) throw new Error('Failed to delete memory');
      setMemories(prev => prev.filter(memory => memory.id !== memoryId));
      return success;
    },
    { successMessage: 'Memory deleted successfully' }
  );

  const { execute: executeCreateMemory, loading: creating } = useAsyncOperation(
    async (memory: Memory) => {
      const newMemory = await createMemory(memory);
      if (!newMemory) throw new Error('Failed to create memory');
      setMemories(prev => [newMemory, ...prev]);
      return newMemory;
    },
    { successMessage: 'Memory created successfully' }
  );

  useEffect(() => {
    const loadMemories = async () => {
      if (!accessCode) {
        setLoading(false);
        return;
      }
      
      try {
        const memoriesData = await fetchMemories(accessCode);
        setMemories(memoriesData);
      } catch (error) {
        console.error('Error loading memories:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadMemories();
  }, [accessCode]);

  return {
    memories,
    loading,
    deleting,
    creating,
    deleteMemory: executeDeleteMemory,
    createMemory: executeCreateMemory,
    refreshMemories: () => {
      if (accessCode) {
        fetchMemories(accessCode).then(setMemories);
      }
    }
  };
}