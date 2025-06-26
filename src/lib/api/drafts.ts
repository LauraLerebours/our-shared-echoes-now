import { supabase } from '@/integrations/supabase/client';
import { ApiResponse, withRetry } from './base';
import { Draft } from '../types';

export const draftsApi = {
  async fetchDrafts(): Promise<ApiResponse<Draft[]>> {
    try {
      console.log('🔄 [draftsApi.fetchDrafts] Starting');
      
      const { data, error } = await supabase
        .rpc('get_user_drafts');
      
      if (error) {
        console.error('❌ [draftsApi.fetchDrafts] Error:', error);
        return { success: false, error: error.message };
      }
      
      // Transform database records to Draft type
      const drafts: Draft[] = (data || []).map(record => {
        const content = record.content;
        
        return {
          id: record.id,
          memory: {
            ...content.memory,
            date: new Date(content.memory.date)
          },
          lastUpdated: new Date(record.updated_at),
          boardId: record.board_id,
          mediaItems: content.mediaItems
        };
      });
      
      console.log('✅ [draftsApi.fetchDrafts] Success:', drafts.length);
      return { success: true, data: drafts };
    } catch (error) {
      console.error('❌ [draftsApi.fetchDrafts] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch drafts' };
    }
  },

  async saveDraft(draft: Draft): Promise<ApiResponse<string>> {
    try {
      console.log('🔄 [draftsApi.saveDraft] Starting');
      
      // Prepare content object
      const content = {
        memory: {
          ...draft.memory,
          date: draft.memory.date?.toISOString()
        },
        mediaItems: draft.mediaItems
      };
      
      const { data, error } = await supabase
        .rpc('save_memory_draft', {
          draft_id: draft.id,
          board_id: draft.boardId,
          content
        });
      
      if (error) {
        console.error('❌ [draftsApi.saveDraft] Error:', error);
        return { success: false, error: error.message };
      }
      
      console.log('✅ [draftsApi.saveDraft] Success:', data);
      return { success: true, data };
    } catch (error) {
      console.error('❌ [draftsApi.saveDraft] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to save draft' };
    }
  },

  async deleteDraft(id: string): Promise<ApiResponse<boolean>> {
    try {
      console.log('🔄 [draftsApi.deleteDraft] Starting for ID:', id);
      
      const { data, error } = await supabase
        .rpc('delete_memory_draft', {
          draft_id: id
        });
      
      if (error) {
        console.error('❌ [draftsApi.deleteDraft] Error:', error);
        return { success: false, error: error.message };
      }
      
      console.log('✅ [draftsApi.deleteDraft] Success:', data);
      return { success: true, data };
    } catch (error) {
      console.error('❌ [draftsApi.deleteDraft] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete draft' };
    }
  },

  async getDraftById(id: string): Promise<ApiResponse<Draft>> {
    try {
      console.log('🔄 [draftsApi.getDraftById] Starting for ID:', id);
      
      const { data, error } = await supabase
        .from('memory_drafts')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('❌ [draftsApi.getDraftById] Error:', error);
        return { success: false, error: error.message };
      }
      
      // Transform database record to Draft type
      const draft: Draft = {
        id: data.id,
        memory: {
          ...data.content.memory,
          date: new Date(data.content.memory.date)
        },
        lastUpdated: new Date(data.updated_at),
        boardId: data.board_id,
        mediaItems: data.content.mediaItems
      };
      
      console.log('✅ [draftsApi.getDraftById] Success');
      return { success: true, data: draft };
    } catch (error) {
      console.error('❌ [draftsApi.getDraftById] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get draft' };
    }
  }
};