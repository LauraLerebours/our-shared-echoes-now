
import { supabase } from '@/integrations/supabase/client';
import { ApiResponse } from './base';
import { Memory } from '../types';

export const memoriesApi = {
  async fetchMemories(accessCode: string): Promise<ApiResponse<Memory[]>> {
    try {
      console.log('🔄 Fetching memories for access code:', accessCode);
      
      const { data, error } = await supabase
        .from('memories')
        .select('*')
        .eq('access_code', accessCode)
        .order('event_date', { ascending: false });
      
      if (error) {
        console.error('❌ Error fetching memories:', error);
        return { success: false, error: error.message };
      }
      
      console.log('✅ Memories fetched successfully:', data?.length || 0);
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('❌ Error fetching memories:', error);
      return { success: false, error: 'Failed to fetch memories' };
    }
  },

  async getMemory(id: string): Promise<ApiResponse<Memory>> {
    try {
      console.log('🔄 Fetching memory:', id);
      
      const { data, error } = await supabase
        .from('memories')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('❌ Error fetching memory:', error);
        return { success: false, error: error.message };
      }
      
      console.log('✅ Memory fetched successfully');
      return { success: true, data };
    } catch (error) {
      console.error('❌ Error fetching memory:', error);
      return { success: false, error: 'Failed to fetch memory' };
    }
  },

  async createMemory(memory: Memory): Promise<ApiResponse<Memory>> {
    try {
      console.log('🔄 Creating memory');
      
      const { data, error } = await supabase
        .from('memories')
        .insert(memory)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error creating memory:', error);
        return { success: false, error: error.message };
      }
      
      console.log('✅ Memory created successfully');
      return { success: true, data };
    } catch (error) {
      console.error('❌ Error creating memory:', error);
      return { success: false, error: 'Failed to create memory' };
    }
  },

  async updateMemory(id: string, updates: Partial<Memory>): Promise<ApiResponse<Memory>> {
    try {
      console.log('🔄 Updating memory:', id);
      
      const { data, error } = await supabase
        .from('memories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error updating memory:', error);
        return { success: false, error: error.message };
      }
      
      console.log('✅ Memory updated successfully');
      return { success: true, data };
    } catch (error) {
      console.error('❌ Error updating memory:', error);
      return { success: false, error: 'Failed to update memory' };
    }
  },

  async deleteMemory(id: string, accessCode: string): Promise<ApiResponse<Memory>> {
    try {
      console.log('🔄 Deleting memory:', id);
      
      const { data, error } = await supabase
        .from('memories')
        .delete()
        .eq('id', id)
        .eq('access_code', accessCode)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error deleting memory:', error);
        return { success: false, error: error.message };
      }
      
      console.log('✅ Memory deleted successfully');
      return { success: true, data };
    } catch (error) {
      console.error('❌ Error deleting memory:', error);
      return { success: false, error: 'Failed to delete memory' };
    }
  },

  async toggleMemoryLike(id: string): Promise<ApiResponse<Memory>> {
    try {
      console.log('🔄 Toggling memory like:', id);
      
      // First get the current memory
      const { data: currentMemory, error: fetchError } = await supabase
        .from('memories')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) {
        console.error('❌ Error fetching memory for like toggle:', fetchError);
        return { success: false, error: fetchError.message };
      }
      
      // Toggle the like
      const newLikes = currentMemory.is_liked ? currentMemory.likes - 1 : currentMemory.likes + 1;
      const newIsLiked = !currentMemory.is_liked;
      
      const { data, error } = await supabase
        .from('memories')
        .update({ 
          likes: newLikes,
          is_liked: newIsLiked
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error toggling memory like:', error);
        return { success: false, error: error.message };
      }
      
      console.log('✅ Memory like toggled successfully');
      return { success: true, data };
    } catch (error) {
      console.error('❌ Error toggling memory like:', error);
      return { success: false, error: 'Failed to toggle memory like' };
    }
  }
};
