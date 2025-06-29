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
    
    console.log(`Draft saved: ${draft.id}`);
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
    
    // Delete from server (async, don't wait)
    draftsApi.deleteDraft(id).catch(error => {
      console.warn(`Failed to delete draft ${id} from server:`, error);
    });
    
    console.log(`Draft deleted: ${id}`);
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
    
    // Delete each draft from server
    const deletePromises = drafts.map(draft => 
      draftsApi.deleteDraft(draft.id).catch(error => {
        console.warn(`Failed to delete draft ${draft.id} from server:`, error);
      })
    );
    
    // Wait for all deletions to complete
    await Promise.allSettled(deletePromises);
    
    console.log('All drafts cleared');
  } catch (error) {
    console.error('Error clearing drafts:', error);
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
 */
export const syncDraftToServer = async (draft: Draft): Promise<void> => {
  try {
    // Transform the draft data to match the database schema
    const dbPayload = {
      id: draft.id,
      board_id: draft.board_id || null,
      content: {
        memory: {
          ...draft.memory,
          date: draft.memory.date ? draft.memory.date.toISOString() : new Date().toISOString()
        },
        mediaItems: draft.mediaItems ? draft.mediaItems.map(item => ({
          ...item,
          // Ensure URL is saved for media items
          url: item.url || item.preview
        })) : []
      }
    };
    
    // Check if draft already exists on server
    let existingDrafts: any[] = [];
    try {
      existingDrafts = await draftsApi.fetchDrafts();
    } catch (error) {
      console.error('Error fetching existing drafts:', error);
      // If we can't fetch, assume it doesn't exist and try to create
    }
    
    const existingDraft = existingDrafts.find(d => d.id === draft.id);
    
    if (existingDraft) {
      // Update existing draft on server
      await draftsApi.updateDraft(draft.id, dbPayload);
      console.log(`Draft synced to server (updated): ${draft.id}`);
    } else {
      // Create new draft on server
      await draftsApi.saveDraft(dbPayload);
      console.log(`Draft synced to server (created): ${draft.id}`);
    }
  } catch (error) {
    console.error('Error syncing draft to server:', error);
    throw error;
  }
};