import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDrafts, saveDraft } from '@/lib/draftsStorage';
import { draftsApi } from '@/lib/api/drafts';
import { Draft } from '@/lib/types';
import { toast } from 'sonner';

/**
 * Component that handles syncing drafts between localStorage and server
 * This component doesn't render anything, it just runs the sync logic
 */
export const DraftsSyncManager = () => {
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxRetries = 3;

  // Helper function to check if error is network-related
  const isNetworkError = (error: any): boolean => {
    if (!error) return false;
    
    const errorMessage = String(error.message || '').toLowerCase();
    return (
      errorMessage.includes('failed to fetch') ||
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      error.name === 'TypeError' ||
      error.code === 'NETWORK_ERROR' ||
      error.code === 'ECONNREFUSED'
    );
  };

  // Sync drafts function with retry logic and better error handling
  const syncDrafts = useCallback(async (isRetry = false) => {
    if (isSyncing) {
      console.log('🔄 Sync already in progress, skipping');
      return;
    }

    if (!user) {
      console.log('ℹ️ No user logged in, skipping sync');
      return;
    }

    setIsSyncing(true);
    console.log(`🔄 Starting drafts sync${isRetry ? ` (retry ${retryCount}/${maxRetries})` : ''}`);

    try {
      // Get local drafts
      const localDrafts = getDrafts();
      console.log(`📱 Found ${localDrafts.length} local drafts`);
      
      // Try to get server drafts - initialize as empty array
      let serverDrafts: Draft[] = [];
      let serverFetchSuccessful = false;
      
      try {
        // Only attempt to fetch from server if user is authenticated
        if (user) {
          const response = await draftsApi.fetchDrafts();
          console.log(`☁️ Server response:`, response);
          
          // Check if response has the expected structure
          if (response && typeof response === 'object') {
            if (Array.isArray(response)) {
              // Direct array response
              serverDrafts = response;
              serverFetchSuccessful = true;
            } else if (response.success && Array.isArray(response.data)) {
              // Wrapped response with success flag
              serverDrafts = response.data;
              serverFetchSuccessful = true;
            } else if (response.data && Array.isArray(response.data)) {
              // Response with data property
              serverDrafts = response.data;
              serverFetchSuccessful = true;
            } else {
              console.warn('⚠️ Unexpected server response format:', response);
              serverDrafts = [];
            }
          } else {
            console.warn('⚠️ Invalid server response:', response);
            serverDrafts = [];
          }
          
          console.log(`☁️ Processed ${serverDrafts.length} server drafts`);
          
          // Reset retry count on success
          if (retryCount > 0) {
            setRetryCount(0);
          }
        } else {
          console.log('ℹ️ No authenticated user, skipping server fetch');
        }
      } catch (error) {
        console.warn('⚠️ Failed to fetch server drafts:', error);
        serverDrafts = []; // Ensure it's always an array
        
        // If it's a network error and we haven't exceeded retry limit, schedule a retry
        if (isNetworkError(error) && retryCount < maxRetries) {
          const nextRetryCount = retryCount + 1;
          setRetryCount(nextRetryCount);
          
          // Schedule retry with exponential backoff
          const retryDelay = Math.min(1000 * Math.pow(2, nextRetryCount), 30000); // Max 30 seconds
          console.log(`⏳ Will retry in ${retryDelay/1000}s (attempt ${nextRetryCount}/${maxRetries})`);
          
          if (syncTimeoutRef.current) {
            clearTimeout(syncTimeoutRef.current);
          }
          
          syncTimeoutRef.current = setTimeout(() => {
            syncDrafts(true);
          }, retryDelay);
          
          setIsSyncing(false);
          return;
        }
        
        // For non-network errors or after max retries, continue with local drafts only
        console.log('📱 Continuing with local drafts only');
        
        // If we've reached max retries, reset counter for future attempts
        if (retryCount >= maxRetries) {
          console.log('⚠️ Max retries reached, resetting retry counter');
          setRetryCount(0);
        }
      }
      
      // Ensure serverDrafts is always an array before proceeding
      if (!Array.isArray(serverDrafts)) {
        console.warn('⚠️ serverDrafts is not an array, resetting to empty array:', serverDrafts);
        serverDrafts = [];
      }
      
      // Create a map of server drafts by ID for quick lookup
      const serverDraftsMap = new Map<string, Draft>();
      serverDrafts.forEach(draft => {
        if (draft && draft.id) {
          serverDraftsMap.set(draft.id, draft);
        }
      });
      
      // Merge drafts (prefer newer versions)
      const mergedDrafts = new Map<string, Draft>();
      
      // First add all local drafts
      localDrafts.forEach(draft => {
        mergedDrafts.set(draft.id, draft);
      });
      
      // Then add server drafts, overwriting local ones if server version is newer
      serverDrafts.forEach(serverDraft => {
        try {
          // Validate server draft structure
          if (!serverDraft || !serverDraft.id) {
            console.warn('⚠️ Invalid server draft structure:', serverDraft);
            return;
          }
          
          const localDraft = mergedDrafts.get(serverDraft.id);
          
          if (!localDraft || serverDraft.lastUpdated > localDraft.lastUpdated) {
            mergedDrafts.set(serverDraft.id, serverDraft);
          }
        } catch (conversionError) {
          console.warn(`⚠️ Failed to process server draft ${serverDraft.id}:`, conversionError);
        }
      });
      
      // Update localStorage with merged drafts
      Array.from(mergedDrafts.values()).forEach(draft => {
        saveDraft(draft);
      });
      
      // Sync local drafts to server (only if we successfully fetched from server and user is authenticated)
      if (serverFetchSuccessful && user) {
        // Only sync drafts that don't exist on server or have been updated locally
        for (const draft of localDrafts) {
          const serverDraft = serverDraftsMap.get(draft.id);
          
          // Skip if server has newer version
          if (serverDraft && serverDraft.lastUpdated >= draft.lastUpdated) {
            continue;
          }
          
          try {
            await draftsApi.saveDraft(draft);
            console.log(`✅ Synced draft to server: ${draft.id}`);
          } catch (error) {
            console.error(`❌ Failed to sync draft to server: ${draft.id}`, error);
            
            // Don't retry immediately - the next scheduled sync will handle it
            if (!isNetworkError(error)) {
              // For non-network errors, show a toast
              toast.error(`Failed to sync draft: ${error.message}`);
            }
          }
        }
      } else {
        console.log('⚠️ Skipping server sync due to failed server fetch or no authenticated user');
      }
      
      console.log('✅ Drafts sync completed successfully');
      setLastSyncTime(new Date());
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new Event('draftsUpdated'));
    } catch (error) {
      console.error('❌ Error during drafts sync:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [user, isSyncing, retryCount]);

  // Initial sync when user logs in
  useEffect(() => {
    if (!user) return;
    
    // Initial sync with a delay to let auth settle
    const initialSyncTimeout = setTimeout(() => {
      syncDrafts();
    }, 1000);
    
    // Set up interval for periodic syncs
    const syncInterval = setInterval(() => {
      syncDrafts();
    }, 5 * 60 * 1000); // Every 5 minutes
    
    // Set up event listener for manual sync
    const handleDraftsUpdated = () => {
      if (!isSyncing) {
        syncDrafts();
      }
    };
    
    window.addEventListener('draftsUpdated', handleDraftsUpdated);
    
    return () => {
      clearTimeout(initialSyncTimeout);
      clearInterval(syncInterval);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      window.removeEventListener('draftsUpdated', handleDraftsUpdated);
    };
  }, [user, isSyncing, syncDrafts]);

  // This component doesn't render anything
  return null;
};

export default DraftsSyncManager;