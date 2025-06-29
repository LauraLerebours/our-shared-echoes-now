import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type MemoryDraft = Database['public']['Tables']['memory_drafts']['Row'];
type MemoryDraftInsert = Database['public']['Tables']['memory_drafts']['Insert'];
type MemoryDraftUpdate = Database['public']['Tables']['memory_drafts']['Update'];

export const draftsApi = {
  async fetchDrafts(): Promise<MemoryDraft[]> {
    try {
      console.log('🔄 [draftsApi.fetchDrafts] Starting fetch...');
      
      // First check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('❌ [draftsApi.fetchDrafts] Auth error:', authError);
        throw authError;
      }
      
      if (!user) {
        console.log('ℹ️ [draftsApi.fetchDrafts] No authenticated user, returning empty array');
        return [];
      }
      
      console.log('✅ [draftsApi.fetchDrafts] User authenticated:', user.id);
      
      const { data, error } = await supabase
        .from('memory_drafts')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('❌ [draftsApi.fetchDrafts] Database error:', error);
        throw error;
      }

      console.log('✅ [draftsApi.fetchDrafts] Success:', data?.length || 0, 'drafts found');
      return data || [];
    } catch (error) {
      console.error('❌ [draftsApi.fetchDrafts] Error:', error);
      
      // If it's a network error or connection issue, return empty array instead of throwing
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        console.warn('⚠️ [draftsApi.fetchDrafts] Network error detected, returning empty array');
        return [];
      }
      
      // For other errors, still throw to maintain error handling
      throw error;
    }
  },

  async saveDraft(draft: Omit<MemoryDraftInsert, 'user_id'>): Promise<MemoryDraft> {
    try {
      console.log('🔄 [draftsApi.saveDraft] Starting save...');
      
      // Check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('❌ [draftsApi.saveDraft] Auth error:', authError);
        throw authError;
      }
      
      if (!user) {
        throw new Error('User must be authenticated to save drafts');
      }
      
      const draftWithUser: MemoryDraftInsert = {
        ...draft,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from('memory_drafts')
        .insert(draftWithUser)
        .select()
        .single();

      if (error) {
        console.error('❌ [draftsApi.saveDraft] Database error:', error);
        throw error;
      }

      console.log('✅ [draftsApi.saveDraft] Success:', data.id);
      return data;
    } catch (error) {
      console.error('❌ [draftsApi.saveDraft] Error:', error);
      throw error;
    }
  },

  async updateDraft(id: string, updates: Partial<Omit<MemoryDraftUpdate, 'user_id'>>): Promise<MemoryDraft> {
    try {
      console.log('🔄 [draftsApi.updateDraft] Starting update for:', id);
      
      const { data, error } = await supabase
        .from('memory_drafts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ [draftsApi.updateDraft] Database error:', error);
        throw error;
      }

      console.log('✅ [draftsApi.updateDraft] Success:', data.id);
      return data;
    } catch (error) {
      console.error('❌ [draftsApi.updateDraft] Error:', error);
      throw error;
    }
  },

  async deleteDraft(id: string): Promise<void> {
    try {
      console.log('🔄 [draftsApi.deleteDraft] Starting delete for:', id);
      
      const { error } = await supabase
        .from('memory_drafts')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ [draftsApi.deleteDraft] Database error:', error);
        throw error;
      }

      console.log('✅ [draftsApi.deleteDraft] Success:', id);
    } catch (error) {
      console.error('❌ [draftsApi.deleteDraft] Error:', error);
      throw error;
    }
  },

  async deleteDraftsByBoardId(boardId: string): Promise<void> {
    try {
      console.log('🔄 [draftsApi.deleteDraftsByBoardId] Starting delete for board:', boardId);
      
      const { error } = await supabase
        .from('memory_drafts')
        .delete()
        .eq('board_id', boardId);

      if (error) {
        console.error('❌ [draftsApi.deleteDraftsByBoardId] Database error:', error);
        throw error;
      }

      console.log('✅ [draftsApi.deleteDraftsByBoardId] Success for board:', boardId);
    } catch (error) {
      console.error('❌ [draftsApi.deleteDraftsByBoardId] Error:', error);
      throw error;
    }
  }
};