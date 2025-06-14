import { useState, useEffect, useRef, useCallback } from 'react';
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
  const hasLoadedRef = useRef(false);
  const currentAccessCodeRef = useRef<string | null>(null);

  const { execute: executeDeleteMemory, loading: deleting } = useAsyncOperation(
    async (memoryId: string, memoryAccessCode: string) => {
      console.log('🔄 [useMemories] Deleting memory:', memoryId);
      const result = await memoriesApi.deleteMemory(memoryId, memoryAccessCode);
      if (!result.success || !result.data) throw new Error(result.error || 'Failed to delete memory');
      setMemories(prev => prev.filter(memory => memory.id !== memoryId));
      return result.data;
    },
    { successMessage: 'Memory deleted successfully' }
  );

  const { execute: executeCreateMemory, loading: creating } = useAsyncOperation(
    async (memory: Memory) => {
      console.log('🔄 [useMemories] Creating new memory');
      const result = await memoriesApi.createMemory(memory);
      if (!result.success || !result.data) throw new Error(result.error || 'Failed to create memory');
      setMemories(prev => [result.data!, ...prev]);
      return result.data;
    },
    { successMessage: 'Memory created successfully' }
  );

  const loadMemories = useCallback(async (isRetry = false) => {
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

    // Skip if we've already loaded this access code and not retrying
    if (hasLoadedRef.current && currentAccessCodeRef.current === accessCode && !isRetry) {
      console.log('✅ [useMemories] Data already loaded for current access code');
      return;
    }
    
    try {
      console.log('🔄 [useMemories] Loading memories for access code:', accessCode);
      setLoading(true);
      setError(null);
      currentAccessCodeRef.current = accessCode;
      
      const result = await memoriesApi.fetchMemories(accessCode, abortControllerRef.current.signal);
      
      // Check if request was aborted or component unmounted
      if (abortControllerRef.current.signal.aborted || !mountedRef.current || isSigningOut) {
        console.log('🛑 [useMemories] Request aborted or component unmounted, skipping state update');
        return;
      }
      
      if (result.success && result.data) {
        console.log('✅ [useMemories] Memories loaded successfully:', result.data.length);
        setMemories(result.data);
        hasLoadedRef.current = true;
      } else {
        console.error('❌ [useMemories] Error loading memories:', result.error);
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
        console.log('✅ [useMemories] Finished loading memories');
        setLoading(false);
      }
    }
  }, [accessCode, isSigningOut]);
  
  useEffect(() => {
    mountedRef.current = true;
    hasLoadedRef.current = false;
    
    if (accessCode) {
      console.log('🔄 [useMemories] Access code changed, loading memories');
      loadMemories();
    } else {
      console.log('⚠️ [useMemories] No access code provided');
      setMemories([]);
      setLoading(false);
      setError(null);
    }
    
    return () => {
      mountedRef.current = false;
      
      // Cancel any in-flight requests when component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [accessCode, loadMemories]);

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
        hasLoadedRef.current = false;
        loadMemories(true);
      }
    }
  };
}