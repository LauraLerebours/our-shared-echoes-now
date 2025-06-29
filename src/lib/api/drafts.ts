import { supabase } from '@/integrations/supabase/client';
import { ApiResponse, withErrorHandling } from './base';
import { Draft } from '../types';

export const draftsApi = {
  async fetchDrafts(): Promise<ApiResponse<Draft[]>> {
    return withErrorHandling(async () => {
      console.log('🔄 [draftsApi.fetchDrafts] Starting');
      
      // Check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('❌ [draftsApi.fetchDrafts] Auth error:', authError);
        throw authError;
      }
      
      if (!user) {
        console.log('ℹ️ [draftsApi.fetchDrafts] No authenticated user');
        return [];
      }
      
      const { data, error } = await supabase
        .from('memory_drafts')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) {
        console.error('❌ [draftsApi.fetchDrafts] Error:', error);
        throw error;
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
          board_id: record.board_id,
          mediaItems: content.mediaItems || []
        };
      });
      
      console.log('✅ [draftsApi.fetchDrafts] Success:', drafts.length);
      return drafts;
    }, 'fetchDrafts');
  },

  async saveDraft(draft: Draft): Promise<ApiResponse<string>> {
    return withErrorHandling(async () => {
      console.log('🔄 [draftsApi.saveDraft] Starting');
      
      // Check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('❌ [draftsApi.saveDraft] Auth error:', authError);
        throw authError;
      }
      
      if (!user) {
        throw new Error('User must be authenticated to save drafts');
      }
      
      // Prepare content object
      const content = {
        memory: {
          ...draft.memory,
          date: draft.memory.date?.toISOString()
        },
        mediaItems: draft.mediaItems ? draft.mediaItems.map(item => ({
          ...item,
          url: item.url || item.preview
        })) : []
      };
      
      // Check if draft already exists
      const { data: existingDraft, error: checkError } = await supabase
        .from('memory_drafts')
        .select('id')
        .eq('id', draft.id)
        .maybeSingle();
      
      if (checkError) {
        console.warn('⚠️ [draftsApi.saveDraft] Error checking existing draft:', checkError);
        // Continue anyway, we'll try to insert
      }
      
      let result;
      
      if (existingDraft) {
        // Update existing draft
        const { data, error } = await supabase
          .from('memory_drafts')
          .update({
            content,
            board_id: draft.board_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', draft.id)
          .eq('user_id', user.id)
          .select('id')
          .single();
        
        if (error) {
          console.error('❌ [draftsApi.saveDraft] Error updating draft:', error);
          throw error;
        }
        
        result = data.id;
        console.log('✅ [draftsApi.saveDraft] Draft updated:', result);
      } else {
        // Insert new draft
        const { data, error } = await supabase
          .from('memory_drafts')
          .insert({
            id: draft.id,
            user_id: user.id,
            board_id: draft.board_id,
            content,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('id')
          .single();
        
        if (error) {
          console.error('❌ [draftsApi.saveDraft] Error inserting draft:', error);
          throw error;
        }
        
        result = data.id;
        console.log('✅ [draftsApi.saveDraft] Draft created:', result);
      }
      
      return result;
    }, 'saveDraft');
  },

  async deleteDraft(id: string): Promise<ApiResponse<boolean>> {
    return withErrorHandling(async () => {
      console.log('🔄 [draftsApi.deleteDraft] Starting for ID:', id);
      
      // Check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('❌ [draftsApi.deleteDraft] Auth error:', authError);
        throw authError;
      }
      
      if (!user) {
        throw new Error('User must be authenticated to delete drafts');
      }
      
      const { error } = await supabase
        .from('memory_drafts')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) {
        console.error('❌ [draftsApi.deleteDraft] Error:', error);
        throw error;
      }
      
      console.log('✅ [draftsApi.deleteDraft] Success:', id);
      return true;
    }, 'deleteDraft');
  },

  async getDraftById(id: string): Promise<ApiResponse<Draft>> {
    return withErrorHandling(async () => {
      console.log('🔄 [draftsApi.getDraftById] Starting for ID:', id);
      
      const { data, error } = await supabase
        .from('memory_drafts')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('❌ [draftsApi.getDraftById] Error:', error);
        throw error;
      }
      
      // Transform database record to Draft type
      const draft: Draft = {
        id: data.id,
        memory: {
          ...data.content.memory,
          date: new Date(data.content.memory.date)
        },
        lastUpdated: new Date(data.updated_at),
        board_id: data.board_id,
        mediaItems: data.content.mediaItems || []
      };
      
      console.log('✅ [draftsApi.getDraftById] Success');
      return draft;
    }, 'getDraftById');
  }
};