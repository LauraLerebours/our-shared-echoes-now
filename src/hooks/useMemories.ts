import { useState, useEffect, useRef } from 'react';
import { Memory } from '@/lib/types';
import { memoriesApi } from '@/lib/api/memories';
import { useAsyncOperation } from './useAsyncOperation';
import { useAuth } from '@/contexts/AuthContext';

// Create a cache key for memories by access code
const MEMORIES_CACHE_KEY_PREFIX = 'thisisus_memories_';

export function useMemories(accessCode?: string) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isSigningOut, user } = useAuth();
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const lastAccessCodeRef = useRef<string | undefined>(accessCode);
  const hasInitiallyLoadedRef = useRef(false);

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
      
      // Update cache with new memory
      if (memory.accessCode) {
        updateMemoriesCache(memory.accessCode, [...memories, result.data!]);
      }
      
      return result.data;
    },
    { successMessage: 'Memory created successfully' }
  );

  // Function to get cached memories
  const getMemoriesFromCache = (accessCode: string): Memory[] | null => {
    try {
      const cacheKey = `${MEMORIES_CACHE_KEY_PREFIX}${accessCode}`;
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        const { memories, timestamp } = JSON.parse(cachedData);
        
        // Check if cache is still valid (less than 5 minutes old)
        const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
        if (Date.now() - timestamp < CACHE_TTL) {
          console.log('📋 [useMemories] Using cached memories for', accessCode);
          return memories;
        } else {
          console.log('⏰ [useMemories] Cache expired for', accessCode);
        }
      }
    } catch (error) {
      console.error('❌ [useMemories] Error reading from cache:', error);
    }
    return null;
  };

  // Function to update memories cache
  const updateMemoriesCache = (accessCode: string, memoriesData: Memory[]) => {
    try {
      const cacheKey = `${MEMORIES_CACHE_KEY_PREFIX}${accessCode}`;
      localStorage.setItem(cacheKey, JSON.stringify({
        memories: memoriesData,
        timestamp: Date.now()
      }));
      console.log('💾 [useMemories] Updated cache for', accessCode);
    } catch (error) {
      console.error('❌ [useMemories] Error updating cache:', error);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    
    const loadMemories = async () => {
      // Skip if access code hasn't changed and we already loaded
      if (accessCode === lastAccessCodeRef.current && hasInitiallyLoadedRef.current) {
        console.log('🔄 [useMemories] Skipping load, access code unchanged:', accessCode);
        return;
      }
      
      // Update the last access code reference
      lastAccessCodeRef.current = accessCode;
      
      // Cancel any previous in-flight request
      if (abortControllerRef.current) {
        console.log('🛑 [useMemories] Cancelling previous request');
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
        
        // Try to get memories from cache first
        const cachedMemories = getMemoriesFromCache(accessCode);
        if (cachedMemories) {
          console.log('📋 [useMemories] Setting memories from cache:', cachedMemories.length);
          setMemories(cachedMemories);
          setLoading(false);
          
          // Still fetch fresh data in the background
          console.log('🔄 [useMemories] Fetching fresh data in background');
        }
        
        console.log('🔄 [useMemories] Fetching memories for access code:', accessCode);
        const result = await memoriesApi.fetchMemories(accessCode, abortControllerRef.current.signal);
        
        // Check if request was aborted or component unmounted
        if (abortControllerRef.current.signal.aborted || !mountedRef.current || isSigningOut) {
          console.log('🛑 [useMemories] Request aborted or component unmounted, skipping state update');
          return;
        }
        
        if (result.success && result.data) {
          console.log('✅ [useMemories] Memories loaded successfully:', result.data.length);
          setMemories(result.data);
          setError(null);
          hasInitiallyLoadedRef.current = true;
          
          // Update cache with fresh data
          updateMemoriesCache(accessCode, result.data);
        } else {
          console.error('❌ [useMemories] Error loading memories:', result.error);
          setError(result.error || 'Failed to load memories');
          
          // If we have cached data, keep using it despite the error
          if (!cachedMemories) {
            setMemories([]);
          }
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
          
          // If we have cached data, keep using it despite the error
          if (!cachedMemories) {
            setMemories([]);
          }
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
        console.log('🔄 [useMemories] Manual refresh triggered for:', accessCode);
        
        // Cancel any previous in-flight request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        
        // Create a new abort controller for this request
        abortControllerRef.current = new AbortController();
        
        setLoading(true);
        
        memoriesApi.fetchMemories(accessCode, abortControllerRef.current.signal).then(result => {
          // Only update state if not aborted and still mounted
          if (!abortControllerRef.current?.signal.aborted && mountedRef.current && !isSigningOut) {
            if (result.success && result.data) {
              console.log('✅ [useMemories] Refresh successful:', result.data.length);
              setMemories(result.data);
              setError(null);
              
              // Update cache with fresh data
              updateMemoriesCache(accessCode, result.data);
            } else {
              console.error('❌ [useMemories] Refresh failed:', result.error);
              setError(result.error || 'Failed to refresh memories');
            }
            setLoading(false);
          }
        }).catch(error => {
          if (!abortControllerRef.current?.signal.aborted && mountedRef.current && !isSigningOut) {
            console.error('❌ [useMemories] Error refreshing memories:', error);
            setError(error instanceof Error ? error.message : 'Unknown error occurred');
            setLoading(false);
          }
        });
      }
    }
  };
}