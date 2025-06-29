import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDrafts, saveDraft, deleteDraft } from '@/lib/draftsStorage';
import { draftsApi } from '@/lib/api/drafts';
import { Draft } from '@/lib/types';

/**
 * Component that handles syncing drafts between localStorage and server
 * This component doesn't render anything, it just runs the sync logic
 */
export const DraftsSyncManager = () => {
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
        let serverDrafts: any[] = [];
        try {
          serverDrafts = await draftsApi.fetchDrafts();
          console.log('✅ Fetched server drafts:', serverDrafts.length);
        } catch (error) {
          console.error('Failed to fetch server drafts:', error);
          // Continue with local drafts only
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
          // Convert server draft to client format
          const clientDraft: Draft = {
            id: serverDraft.id,
            memory: serverDraft.content.memory,
            lastUpdated: new Date(serverDraft.updated_at),
            board_id: serverDraft.board_id,
            mediaItems: serverDraft.content.mediaItems
          };
          
          const localDraft = mergedDrafts.get(serverDraft.id);
          
          if (!localDraft || new Date(serverDraft.updated_at) > localDraft.lastUpdated) {
            mergedDrafts.set(serverDraft.id, clientDraft);
          }
        });
        
        // Update localStorage with merged drafts
        Array.from(mergedDrafts.values()).forEach(draft => {
          saveDraft(draft);
        });
        
        // Sync local drafts to server
        for (const draft of localDrafts) {
          try {
            // Prepare draft for server
            const serverDraft = {
              id: draft.id,
              board_id: draft.board_id,
              content: {
                memory: {
                  ...draft.memory,
                  date: draft.memory.date ? draft.memory.date.toISOString() : new Date().toISOString()
                },
                mediaItems: draft.mediaItems || []
              }
            };
            
            // Check if draft already exists on server
            const existingServerDraft = serverDraftsMap.get(draft.id);
            
            if (existingServerDraft) {
              // Draft exists on server, check if local version is newer
              const serverUpdatedAt = new Date(existingServerDraft.updated_at);
              if (draft.lastUpdated > serverUpdatedAt) {
                // Local version is newer, update the server draft
                await draftsApi.updateDraft(draft.id, serverDraft);
                console.log('✅ Updated existing draft on server:', draft.id);
              } else {
                console.log('⏭️ Server draft is newer, skipping sync for:', draft.id);
              }
            } else {
              // Draft doesn't exist on server, create new one
              await draftsApi.saveDraft(serverDraft);
              console.log('✅ Created new draft on server:', draft.id);
            }
          } catch (error) {
            console.error('Failed to sync draft to server:', draft.id, error);
          }
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