import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDrafts, saveDraft, deleteDraft, syncDraftToServer } from '@/lib/draftsStorage';
import { draftsApi } from '@/lib/api/drafts';
import { Draft } from '@/lib/types';

/**
 * Component that handles syncing drafts between localStorage and server
 * This component doesn't render anything, it just runs the sync logic
 */
export const DraftsSyncManager = () => {
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Helper function to check if error is network-related
  const isNetworkError = (error: any): boolean => {
    const errorMessage = error?.message?.toLowerCase() || '';
    return (
      errorMessage.includes('failed to fetch') ||
      errorMessage.includes('network error') ||
      errorMessage.includes('connection') ||
      error?.name === 'TypeError' ||
      error?.code === 'NETWORK_ERROR'
    );
  };

  // Sync drafts when user logs in
  useEffect(() => {
    if (!user) return;

    const syncDrafts = async () => {
      if (isSyncing) return;
      setIsSyncing(true);

      try {
        console.log('🔄 Syncing drafts...');
        
        // Get local drafts
        const localDrafts = getDrafts();
        console.log(`📱 Found ${localDrafts.length} local drafts`);
        
        // Try to get server drafts with better error handling
        let serverDrafts: any[] = [];
        try {
          serverDrafts = await draftsApi.fetchDrafts();
          console.log(`☁️ Fetched ${serverDrafts.length} server drafts`);
          setRetryCount(0); // Reset retry count on success
        } catch (error) {
          console.warn('⚠️ Failed to fetch server drafts:', error);
          
          // If it's a network error and we haven't exceeded retry limit, we'll retry later
          if (isNetworkError(error) && retryCount < maxRetries) {
            console.log(`🔄 Network error detected, will retry later (attempt ${retryCount + 1}/${maxRetries})`);
            setRetryCount(prev => prev + 1);
            setIsSyncing(false);
            return; // Exit early, will retry later
          }
          
          // For non-network errors or after max retries, continue with local drafts only
          console.log('📱 Continuing with local drafts only');
        }
        
        // Create a map of server drafts by ID for quick lookup
        const serverDraftsMap = new Map<string, any>();
        serverDrafts.forEach(draft => {
          serverDraftsMap.set(draft.id, draft);
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
            // Convert server draft to client format
            const clientDraft: Draft = {
              id: serverDraft.id,
              memory: {
                ...serverDraft.content.memory,
                date: new Date(serverDraft.content.memory.date)
              },
              lastUpdated: new Date(serverDraft.updated_at),
              board_id: serverDraft.board_id,
              mediaItems: serverDraft.content.mediaItems
            };
            
            const localDraft = mergedDrafts.get(serverDraft.id);
            
            if (!localDraft || new Date(serverDraft.updated_at) > localDraft.lastUpdated) {
              mergedDrafts.set(serverDraft.id, clientDraft);
            }
          } catch (conversionError) {
            console.warn('⚠️ Failed to convert server draft:', serverDraft.id, conversionError);
          }
        });
        
        // Update localStorage with merged drafts
        try {
          Array.from(mergedDrafts.values()).forEach(draft => {
            saveDraft(draft);
          });
          console.log(`💾 Updated localStorage with ${mergedDrafts.size} merged drafts`);
        } catch (storageError) {
          console.error('❌ Failed to update localStorage:', storageError);
        }
        
        // Try to sync local drafts to server (only if we successfully connected earlier)
        if (serverDrafts.length >= 0) { // We got a response, even if empty
          let syncedCount = 0;
          let failedCount = 0;
          
          for (const draft of localDrafts) {
            try {
              await syncDraftToServer(draft);
              syncedCount++;
            } catch (error) {
              failedCount++;
              if (isNetworkError(error)) {
                console.warn(`⚠️ Network error syncing draft ${draft.id}, will retry later`);
              } else {
                console.error(`❌ Failed to sync draft ${draft.id}:`, error);
              }
            }
          }
          
          if (syncedCount > 0) {
            console.log(`✅ Successfully synced ${syncedCount} drafts to server`);
          }
          if (failedCount > 0) {
            console.log(`⚠️ Failed to sync ${failedCount} drafts`);
          }
        }
        
        console.log('✅ Drafts sync completed');
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new Event('draftsUpdated'));
      } catch (error) {
        console.error('❌ Error during drafts sync:', error);
        
        // If it's a network error, we'll retry later
        if (isNetworkError(error) && retryCount < maxRetries) {
          console.log(`🔄 Will retry sync later due to network error`);
          setRetryCount(prev => prev + 1);
        }
      } finally {
        setIsSyncing(false);
      }
    };

    // Initial sync with a small delay to let auth settle
    const initialSyncTimeout = setTimeout(syncDrafts, 1000);
    
    // Set up interval to sync every 5 minutes, but only if not currently syncing
    const interval = setInterval(() => {
      if (!isSyncing) {
        syncDrafts();
      }
    }, 5 * 60 * 1000);
    
    // Set up event listener for manual sync
    const handleDraftsUpdated = () => {
      if (!isSyncing) {
        syncDrafts();
      }
    };
    
    window.addEventListener('draftsUpdated', handleDraftsUpdated);
    
    return () => {
      clearTimeout(initialSyncTimeout);
      clearInterval(interval);
      window.removeEventListener('draftsUpdated', handleDraftsUpdated);
    };
  }, [user, isSyncing, retryCount]);

  // Retry mechanism for failed syncs
  useEffect(() => {
    if (retryCount > 0 && retryCount <= maxRetries && user && !isSyncing) {
      const retryDelay = Math.min(1000 * Math.pow(2, retryCount - 1), 30000); // Exponential backoff, max 30s
      console.log(`⏳ Scheduling retry in ${retryDelay / 1000}s (attempt ${retryCount}/${maxRetries})`);
      
      const retryTimeout = setTimeout(() => {
        console.log(`🔄 Retrying drafts sync (attempt ${retryCount}/${maxRetries})`);
        window.dispatchEvent(new Event('draftsUpdated'));
      }, retryDelay);
      
      return () => clearTimeout(retryTimeout);
    }
  }, [retryCount, user, isSyncing]);

  // This component doesn't render anything
  return null;
};