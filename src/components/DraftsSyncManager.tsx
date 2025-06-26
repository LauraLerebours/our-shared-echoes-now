import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDrafts, saveDraft, deleteDraft } from '@/lib/draftsStorage';
import { draftsApi } from '@/lib/api/drafts';
import { Draft } from '@/lib/types';

/**
 * Component that handles syncing drafts between localStorage and server
 * This component doesn't render anything, it just runs the sync logic
 */
const DraftsSyncManager = () => {
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);

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
        
        // Get server drafts
        const { success, data: serverDrafts, error } = await draftsApi.fetchDrafts();
        
        if (!success || !serverDrafts) {
          console.error('Failed to fetch server drafts:', error);
          return;
        }
        
        // Merge drafts (prefer newer versions)
        const mergedDrafts = new Map<string, Draft>();
        
        // First add all local drafts
        localDrafts.forEach(draft => {
          mergedDrafts.set(draft.id, draft);
        });
        
        // Then add server drafts, overwriting local ones if server version is newer
        serverDrafts.forEach(serverDraft => {
          const localDraft = mergedDrafts.get(serverDraft.id);
          
          if (!localDraft || serverDraft.lastUpdated > localDraft.lastUpdated) {
            mergedDrafts.set(serverDraft.id, serverDraft);
          }
        });
        
        // Update localStorage with merged drafts
        Array.from(mergedDrafts.values()).forEach(draft => {
          saveDraft(draft);
        });
        
        // Sync local drafts to server
        for (const draft of localDrafts) {
          await draftsApi.saveDraft(draft);
        }
        
        console.log('✅ Drafts synced successfully');
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new Event('draftsUpdated'));
      } catch (error) {
        console.error('Error syncing drafts:', error);
      } finally {
        setIsSyncing(false);
      }
    };

    // Sync on initial load
    syncDrafts();
    
    // Set up interval to sync every 5 minutes
    const interval = setInterval(syncDrafts, 5 * 60 * 1000);
    
    // Set up event listener for manual sync
    const handleDraftsUpdated = () => {
      syncDrafts();
    };
    
    window.addEventListener('draftsUpdated', handleDraftsUpdated);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('draftsUpdated', handleDraftsUpdated);
    };
  }, [user, isSyncing]);

  // This component doesn't render anything
  return null;
};

export default DraftsSyncManager;