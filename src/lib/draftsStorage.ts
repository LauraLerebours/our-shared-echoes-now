import { Draft } from './types';
import { draftsApi } from './api/drafts';

// Key for storing drafts in localStorage
const DRAFTS_STORAGE_KEY = 'thisisus_memory_drafts';

/**
 * Save a draft to localStorage
 */
export const saveDraft = (draft: Draft): void => {
  try {
    // Get existing drafts
    const existingDrafts = getDrafts();
    
    // Find if this draft already exists
    const existingIndex = existingDrafts.findIndex(d => d.id === draft.id);
    
    if (existingIndex >= 0) {
      // Update existing draft
      existingDrafts[existingIndex] = draft;
    } else {
      // Add new draft
      existingDrafts.push(draft);
    }
    
    // Sort drafts by lastUpdated (newest first)
    existingDrafts.sort((a, b) => 
      new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
    );
    
    // Save back to localStorage
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(existingDrafts));
    
    console.log(`Draft saved locally: ${draft.id}`);
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new Event('draftsUpdated'));
  } catch (error) {
    console.error('Error saving draft:', error);
  }
};

/**
 * Get all drafts from localStorage
 */
export const getDrafts = (): Draft[] => {
  try {
    const draftsJson = localStorage.getItem(DRAFTS_STORAGE_KEY);
    if (!draftsJson) return [];
    
    const drafts = JSON.parse(draftsJson) as Draft[];
    
    // Convert string dates to Date objects
    return drafts.map(draft => ({
      ...draft,
      lastUpdated: new Date(draft.lastUpdated),
      memory: {
        ...draft.memory,
        date: draft.memory.date ? new Date(draft.memory.date) : new Date()
      }
    }));
  } catch (error) {
    console.error('Error getting drafts:', error);
    return [];
  }
};

/**
 * Get a specific draft by ID
 */
export const getDraftById = (id: string): Draft | null => {
  try {
    const drafts = getDrafts();
    return drafts.find(draft => draft.id === id) || null;
  } catch (error) {
    console.error('Error getting draft by ID:', error);
    return null;
  }
};

/**
 * Delete a draft by ID from both localStorage and server
 */
export const deleteDraft = (id: string): void => {
  try {
    // Delete from localStorage
    const drafts = getDrafts();
    const filteredDrafts = drafts.filter(draft => draft.id !== id);
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(filteredDrafts));
    console.log(`Draft deleted from localStorage: ${id}`);
    
    // Try to delete from server (don't wait for result)
    try {
      draftsApi.deleteDraft(id)
        .then(result => {
          if (result.success) {
            console.log(`Draft deleted from server: ${id}`);
          } else {
            console.warn(`Failed to delete draft ${id} from server:`, result.error);
          }
        })
        .catch(error => {
          console.warn(`Failed to delete draft ${id} from server:`, error);
        });
    } catch (error) {
      console.warn(`Failed to initiate server deletion for draft ${id}:`, error);
    }
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new Event('draftsUpdated'));
  } catch (error) {
    console.error('Error deleting draft:', error);
  }
};

/**
 * Delete all drafts from both localStorage and server
 */
export const clearAllDrafts = async (): Promise<void> => {
  try {
    // Get all drafts first to know their IDs
    const drafts = getDrafts();
    
    // Clear localStorage
    localStorage.removeItem(DRAFTS_STORAGE_KEY);
    console.log('All drafts cleared from localStorage');
    
    // Try to delete each draft from server
    if (drafts.length > 0) {
      const deletePromises = drafts.map(draft => 
        draftsApi.deleteDraft(draft.id)
          .catch(error => {
            console.warn(`Failed to delete draft ${draft.id} from server:`, error);
            return { success: false, error };
          })
      );
      
      // Wait for all deletions to complete
      await Promise.allSettled(deletePromises);
      console.log('Server draft deletion requests completed');
    }
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new Event('draftsUpdated'));
  } catch (error) {
    console.error('Error clearing drafts:', error);
    throw error;
  }
};

/**
 * Get the count of drafts
 */
export const getDraftsCount = (): number => {
  try {
    return getDrafts().length;
  } catch (error) {
    console.error('Error getting drafts count:', error);
    return 0;
  }
};

/**
 * Sync a draft to the server
 * This function is used by DraftsSyncManager
 */
export const syncDraftToServer = async (draft: Draft): Promise<void> => {
  try {
    await draftsApi.saveDraft(draft);
    console.log(`Draft synced to server: ${draft.id}`);
  } catch (error) {
    console.error(`Error syncing draft to server: ${draft.id}`, error);
    throw error;
  }
};