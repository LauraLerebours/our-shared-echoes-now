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
    console.log('🔄 [useMemories] Hook initialized with accessCode:', accessCode);
    mountedRef.current = true;
    
    const loadMemories = async () => {
      // Cancel any previous in-flight request
      if (abortControllerRef.current) {
        console.log('🛑 [useMemories] Cancelling previous request');
        abortControllerRef.current.abort();
      }
      
      // Create a new abort controller for this request
      abortControllerRef.current = new AbortController();
      
      if (!accessCode || isSigningOut) {
        console.log('⚠️ [useMemories] No accessCode or user is signing out, skipping load');
        setLoading(false);
        return;
      }
      
      console.log('🔄 [useMemories] Starting to load memories for accessCode:', accessCode);
      
      try {
        setLoading(true);
        setError(null);
        
        console.log('🔄 [useMemories] Calling memoriesApi.fetchMemories');
        const result = await memoriesApi.fetchMemories(accessCode, abortControllerRef.current.signal);
        console.log('🔄 [useMemories] API call completed, success:', result.success);
        
        // Check if request was aborted or component unmounted
        if (abortControllerRef.current.signal.aborted || !mountedRef.current || isSigningOut) {
          console.log('🛑 [useMemories] Request aborted or component unmounted, skipping state update');
          return;
        }
        
        if (result.success && result.data) {
          console.log('✅ [useMemories] Memories loaded successfully:', result.data.length, 'memories');
          console.log('📊 [useMemories] Memory types breakdown:', {
            photos: result.data.filter(m => !m.isVideo).length,
            videos: result.data.filter(m => m.isVideo).length
          });
          setMemories(result.data);
        } else {
          console.error('❌ [useMemories] Failed to load memories:', result.error);
          setError(result.error || 'Failed to load memories');
        }
      } catch (error) {
        // Only update state if not aborted and still mounted
        if (!abortControllerRef.current?.signal.aborted && mountedRef.current && !isSigningOut) {
          console.error('❌ [useMemories] Error loading memories:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          
          // Don't show abort errors to the user
          if (errorMessage !== 'Operation aborted by user' && errorMessage !== 'Request aborted') {
            setError(errorMessage);
          }
        }
      } finally {
        // Only update loading state if not aborted and still mounted
        if (!abortControllerRef.current?.signal.aborted && mountedRef.current && !isSigningOut) {
          console.log('✅ [useMemories] Finished loading memories, setting loading=false');
          setLoading(false);
        }
      }
    };
    
    console.log('🔄 [useMemories] Calling loadMemories function');
    loadMemories();
    
    return () => {
      console.log('🧹 [useMemories] Cleaning up useMemories hook');
      mountedRef.current = false;
      
      // Cancel any in-flight requests when component unmounts
      if (abortControllerRef.current) {
        console.log('🛑 [useMemories] Aborting any in-flight requests during cleanup');
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
        console.log('🔄 [useMemories] Manual refresh triggered for accessCode:', accessCode);
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
              console.log('✅ [useMemories] Refresh successful, loaded', result.data.length, 'memories');
              setMemories(result.data);
            } else {
              console.error('❌ [useMemories] Refresh failed:', result.error);
            }
          }
        });
      } else {
        console.log('⚠️ [useMemories] Refresh skipped - no accessCode or user is signing out');
      }
    }
  };
}