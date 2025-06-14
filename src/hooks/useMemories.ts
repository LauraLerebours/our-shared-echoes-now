import { useState, useEffect, useRef } from 'react';
import { Memory } from '@/lib/types';
import { memoriesApi } from '@/lib/api/memories';
import { useAsyncOperation } from './useAsyncOperation';
import { useAuth } from '@/contexts/AuthContext';

export function useMemories(accessCode?: string) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isSigningOut, user } = useAuth();
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const loadAttemptRef = useRef(0);

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
        console.log('🛑 [useMemories] Cancelling previous request');
        abortControllerRef.current.abort();
      }
      
      // Create a new abort controller for this request
      abortControllerRef.current = new AbortController();
      
      if (!accessCode || isSigningOut) {
        console.log('⚠️ [useMemories] No access code or user is signing out, skipping load');
        setLoading(false);
        return;
      }
      
      // Increment load attempt counter
      loadAttemptRef.current++;
      const currentAttempt = loadAttemptRef.current;
      
      try {
        console.log(`🔄 [useMemories] Starting memory load for access code: ${accessCode} (attempt ${currentAttempt})`);
        setLoading(true);
        setError(null);
        
        console.log('🔄 [useMemories] Calling memoriesApi.fetchMemories');
        const result = await memoriesApi.fetchMemories(accessCode, abortControllerRef.current.signal);
        
        // Check if request was aborted or component unmounted
        if (abortControllerRef.current.signal.aborted || !mountedRef.current || isSigningOut) {
          console.log('🛑 [useMemories] Request aborted or component unmounted, skipping state update');
          return;
        }
        
        // Check if this is still the most recent load attempt
        if (currentAttempt !== loadAttemptRef.current) {
          console.log('🛑 [useMemories] Newer load attempt in progress, skipping state update');
          return;
        }
        
        if (result.success && result.data) {
          console.log('✅ [useMemories] Memories loaded successfully:', result.data.length);
          setMemories(result.data);
        } else {
          console.error('❌ [useMemories] Error loading memories:', result.error);
          setError(result.error || 'Failed to load memories');
        }
      } catch (error) {
        // Only update state if not aborted and still mounted
        if (!abortControllerRef.current?.signal.aborted && mountedRef.current && !isSigningOut) {
          console.error('❌ [useMemories] Exception loading memories:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          
          // Don't show abort errors to the user
          if (errorMessage !== 'Operation aborted by user' && errorMessage !== 'Request aborted') {
            setError(errorMessage);
          }
        }
      } finally {
        // Only update loading state if not aborted and still mounted
        if (!abortControllerRef.current?.signal.aborted && mountedRef.current && !isSigningOut) {
          console.log('✅ [useMemories] Finished loading attempt, setting loading=false');
          setLoading(false);
        }
      }
    };
    
    console.log('🔄 [useMemories] useEffect triggered with accessCode:', accessCode);
    loadMemories();
    
    return () => {
      console.log('🧹 [useMemories] Cleanup: component unmounting');
      mountedRef.current = false;
      
      // Cancel any in-flight requests when component unmounts
      if (abortControllerRef.current) {
        console.log('🛑 [useMemories] Cleanup: aborting any in-flight requests');
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [accessCode, isSigningOut, user?.id]);

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
        console.log('🔄 [useMemories] Manual refresh triggered');
        // Cancel any previous in-flight request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        
        // Create a new abort controller for this request
        abortControllerRef.current = new AbortController();
        
        // Increment load attempt counter
        loadAttemptRef.current++;
        
        memoriesApi.fetchMemories(accessCode, abortControllerRef.current.signal).then(result => {
          // Only update state if not aborted and still mounted
          if (!abortControllerRef.current?.signal.aborted && mountedRef.current && !isSigningOut) {
            if (result.success && result.data) {
              console.log('✅ [useMemories] Refresh successful, updating memories');
              setMemories(result.data);
            } else {
              console.error('❌ [useMemories] Refresh failed:', result.error);
            }
          }
        }).catch(error => {
          console.error('❌ [useMemories] Refresh exception:', error);
        });
      } else {
        console.log('⚠️ [useMemories] Refresh skipped - no access code or user is signing out');
      }
    }
  };
}