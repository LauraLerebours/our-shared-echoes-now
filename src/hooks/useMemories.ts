
import { useState, useEffect } from 'react';
import { Memory } from '@/lib/types';
import { memoriesApi } from '@/lib/api/memories';
import { useAsyncOperation } from './useAsyncOperation';

export function useMemories(accessCode?: string) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  const { execute: executeDeleteMemory, loading: deleting } = useAsyncOperation(
    async (memoryId: string, memoryAccessCode: string) => {
      const result = await memoriesApi.deleteMemory(memoryId, memoryAccessCode);
      if (!result.success || !result.data) throw new Error(result.error || 'Failed to delete memory');
      setMemories(prev => prev.filter(memory => memory.id !== memoryId));
      return result.data;
    },
    { successMessage: 'Memory deleted successfully' }
  );

  const { execute: executeCreateMemory, loading: creating } = useAsyncOperation(
    async (memory: Memory) => {
      const result = await memoriesApi.createMemory(memory);
      if (!result.success || !result.data) throw new Error(result.error || 'Failed to create memory');
      setMemories(prev => [result.data!, ...prev]);
      return result.data;
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
        const result = await memoriesApi.fetchMemories(accessCode);
        if (result.success && result.data) {
          setMemories(result.data);
        } else {
          console.error('Error loading memories:', result.error);
        }
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
        memoriesApi.fetchMemories(accessCode).then(result => {
          if (result.success && result.data) {
            setMemories(result.data);
          }
        });
      }
    }
  };
}
