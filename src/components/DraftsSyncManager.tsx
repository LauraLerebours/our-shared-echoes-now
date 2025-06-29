import React, { useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { draftsApi } from '@/lib/api/drafts';
import { getDrafts, clearDrafts, syncDraftToServer } from '@/lib/draftsStorage';

export const DraftsSyncManager: React.FC = () => {
  const { user } = useAuth();

  const syncDrafts = useCallback(async () => {
    if (!user) {
      console.log('ℹ️ [DraftsSyncManager] No user authenticated, skipping sync');
      return;
    }

    try {
      console.log('🔄 [DraftsSyncManager] Starting draft sync...');
      
      // Get local drafts
      const localDrafts = getDrafts();
      console.log('📱 [DraftsSyncManager] Local drafts found:', localDrafts.length);

      if (localDrafts.length === 0) {
        console.log('ℹ️ [DraftsSyncManager] No local drafts to sync');
        return;
      }

      // Try to fetch server drafts to check connectivity
      let serverDrafts;
      try {
        serverDrafts = await draftsApi.fetchDrafts();
        console.log('☁️ [DraftsSyncManager] Server drafts found:', serverDrafts.length);
      } catch (error) {
        console.warn('⚠️ [DraftsSyncManager] Failed to fetch server drafts, will retry sync later:', error);
        return; // Don't sync if we can't connect to server
      }

      // Sync each local draft to server
      let syncedCount = 0;
      for (const localDraft of localDrafts) {
        try {
          await syncDraftToServer(localDraft);
          syncedCount++;
          console.log('✅ [DraftsSyncManager] Synced draft:', localDraft.id);
        } catch (error) {
          console.error('❌ [DraftsSyncManager] Failed to sync draft:', localDraft.id, error);
          // Continue with other drafts even if one fails
        }
      }

      if (syncedCount > 0) {
        console.log(`✅ [DraftsSyncManager] Successfully synced ${syncedCount}/${localDrafts.length} drafts`);
        
        // Clear local drafts only if all were synced successfully
        if (syncedCount === localDrafts.length) {
          clearDrafts();
          console.log('🧹 [DraftsSyncManager] Cleared local drafts after successful sync');
        }
      }
    } catch (error) {
      console.error('❌ [DraftsSyncManager] Sync error:', error);
      // Don't throw the error to prevent breaking the component
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      console.log('👤 [DraftsSyncManager] User authenticated, starting sync process');
      
      // Initial sync
      syncDrafts();

      // Set up periodic sync every 30 seconds
      const syncInterval = setInterval(syncDrafts, 30000);

      return () => {
        console.log('🛑 [DraftsSyncManager] Cleaning up sync interval');
        clearInterval(syncInterval);
      };
    } else {
      console.log('👤 [DraftsSyncManager] No user authenticated, sync disabled');
    }
  }, [user, syncDrafts]);

  // This component doesn't render anything
  return null;
};