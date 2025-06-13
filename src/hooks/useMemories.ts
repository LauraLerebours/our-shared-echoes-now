import { useState, useEffect, useRef } from 'react';
import { Memory } from '@/lib/types';
import { memoriesApi } from '@/lib/api/memories';
import { useAsyncOperation } from './useAsyncOperation';
import { useAuth } from '@/contexts/AuthContext';

export function useMemories(accessCode?: string) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isSigningOut } = useAuth();
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

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
    mountedRef.current = true;
    
    const loadMemories = async () => {
      // Cancel any previous in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Create a new abort controller for this request
      abortControllerRef.current = new AbortController();
      
      if (!accessCode || isSigningOut) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        const result = await memoriesApi.fetchMemories(accessCode, abortControllerRef.current.signal);
        
        // Check if request was aborted or component unmounted
        if (abortControllerRef.current.signal.aborted || !mountedRef.current || isSigningOut) {
          console.log('🛑 [useMemories] Request aborted or component unmounted, skipping state update');
          return;
        }
        
        if (result.success && result.data) {
          setMemories(result.data);
        } else {
          console.error('Error loading memories:', result.error);
          setError(result.error || 'Failed to load memories');
        }
      } catch (error) {
        // Only update state if not aborted and still mounted
        if (!abortControllerRef.current?.signal.aborted && mountedRef.current && !isSigningOut) {
          console.error('Error loading memories:', error);
          setError(error instanceof Error ? error.message : 'Unknown error occurred');
        }
      } finally {
        // Only update loading state if not aborted and still mounted
        if (!abortControllerRef.current?.signal.aborted && mountedRef.current && !isSigningOut) {
          setLoading(false);
        }
      }
    };
    
    loadMemories();
    
    return () => {
      mountedRef.current = false;
      
      // Cancel any in-flight requests when component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [accessCode, isSigningOut]);

  return {
    memories,
    loading,
    error,
    deleting,
    creating,
    deleteMemory: executeDeleteMemory,
    createMemory: executeCreateMemory,
    refreshMemories: () => {
      if (accessCode && !isSigningOut) {
        // Cancel any previous in-flight request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        
        // Create a new abort controller for this request
        abortControllerRef.current = new AbortController();
        
        memoriesApi.fetchMemories(accessCode, abortControllerRef.current.signal).then(result => {
          // Only update state if not aborted and still mounted
          if (!abortControllerRef.current?.signal.aborted && mountedRef.current && !isSigningOut) {
            if (result.success && result.data) {
              setMemories(result.data);
            }
          }
        });
      }
    }
  };
}