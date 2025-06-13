import { supabase } from '@/integrations/supabase/client';
import { ApiResponse } from './base';
import { Memory } from '../types';

export const memoriesApi = {
  async fetchMemories(accessCode: string): Promise<ApiResponse<Memory[]>> {
    try {
      console.log('🔄 Fetching memories for access code:', accessCode);
      
      // Use a more efficient query with proper indexing
      const { data, error } = await supabase
        .from('memories')
        .select('*')
        .eq('access_code', accessCode)
        .order('event_date', { ascending: false })
        .limit(1000); // Add reasonable limit to prevent huge queries
      
      if (error) {
        console.error('❌ Error fetching memories:', error);
        return { success: false, error: error.message };
      }
      
      // Transform database records to Memory type
      const memories: Memory[] = (data || []).map(record => ({
        id: record.id,
        image: record.media_url,
        caption: record.caption || undefined,
        date: new Date(record.event_date),
        location: record.location || undefined,
        likes: record.likes,
        isLiked: record.is_liked || false,
        isVideo: record.is_video,
        type: 'memory' as const,
        accessCode: record.access_code || accessCode,
        createdBy: record.created_by || undefined
      }));
      
      console.log('✅ Memories fetched successfully:', memories.length);
      return { success: true, data: memories };
    } catch (error) {
      console.error('❌ Error fetching memories:', error);
      return { success: false, error: 'Failed to fetch memories' };
    }
  },

  async fetchMemoriesByAccessCodes(accessCodes: string[], limit: number = 100): Promise<ApiResponse<Memory[]>> {
    try {
      console.log('🔄 Fetching memories for access codes:', accessCodes.length, 'with limit:', limit);
      
      if (accessCodes.length === 0) {
        console.log('✅ No access codes provided, returning empty array');
        return { success: true, data: [] };
      }
      
      // Use efficient query with access codes filter and limit
      const { data, error } = await supabase
        .from('memories')
        .select('*')
        .in('access_code', accessCodes)
        .order('event_date', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('❌ Error fetching memories by access codes:', error);
        return { success: false, error: error.message };
      }
      
      // Transform database records to Memory type
      const memories: Memory[] = (data || []).map(record => ({
        id: record.id,
        image: record.media_url,
        caption: record.caption || undefined,
        date: new Date(record.event_date),
        location: record.location || undefined,
        likes: record.likes,
        isLiked: record.is_liked || false,
        isVideo: record.is_video,
        type: 'memory' as const,
        accessCode: record.access_code || '',
        createdBy: record.created_by || undefined
      }));
      
      console.log('✅ Memories fetched by access codes successfully:', memories.length);
      return { success: true, data: memories };
    } catch (error) {
      console.error('❌ Error fetching memories by access codes:', error);
      return { success: false, error: 'Failed to fetch memories by access codes' };
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
      
      const memory: Memory = {
        id: data.id,
        image: data.media_url,
        caption: data.caption || undefined,
        date: new Date(data.event_date),
        location: data.location || undefined,
        likes: data.likes,
        isLiked: data.is_liked || false,
        isVideo: data.is_video,
        type: 'memory' as const,
        accessCode: data.access_code || '',
        createdBy: data.created_by || undefined
      };
      
      console.log('✅ Memory fetched successfully');
      return { success: true, data: memory };
    } catch (error) {
      console.error('❌ Error fetching memory:', error);
      return { success: false, error: 'Failed to fetch memory' };
    }
  },

  async createMemory(memory: Memory): Promise<ApiResponse<Memory>> {
    try {
      console.log('🔄 Creating memory');
      
      const dbRecord = {
        id: memory.id,
        media_url: memory.image,
        caption: memory.caption,
        event_date: memory.date.toISOString(),
        location: memory.location,
        likes: memory.likes,
        is_liked: memory.isLiked,
        is_video: memory.isVideo || false,
        access_code: memory.accessCode,
        created_by: memory.createdBy
      };
      
      const { data, error } = await supabase
        .from('memories')
        .insert(dbRecord)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error creating memory:', error);
        return { success: false, error: error.message };
      }
      
      const createdMemory: Memory = {
        id: data.id,
        image: data.media_url,
        caption: data.caption || undefined,
        date: new Date(data.event_date),
        location: data.location || undefined,
        likes: data.likes,
        isLiked: data.is_liked || false,
        isVideo: data.is_video,
        type: 'memory' as const,
        accessCode: data.access_code || '',
        createdBy: data.created_by || undefined
      };
      
      console.log('✅ Memory created successfully');
      return { success: true, data: createdMemory };
    } catch (error) {
      console.error('❌ Error creating memory:', error);
      return { success: false, error: 'Failed to create memory' };
    }
  },

  async updateMemory(id: string, updates: Partial<Memory>): Promise<ApiResponse<Memory>> {
    try {
      console.log('🔄 Updating memory:', id);
      
      const dbUpdates: any = {};
      if (updates.image !== undefined) dbUpdates.media_url = updates.image;
      if (updates.caption !== undefined) dbUpdates.caption = updates.caption;
      if (updates.date !== undefined) dbUpdates.event_date = updates.date.toISOString();
      if (updates.location !== undefined) dbUpdates.location = updates.location;
      if (updates.likes !== undefined) dbUpdates.likes = updates.likes;
      if (updates.isLiked !== undefined) dbUpdates.is_liked = updates.isLiked;
      if (updates.isVideo !== undefined) dbUpdates.is_video = updates.isVideo;
      
      const { data, error } = await supabase
        .from('memories')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error updating memory:', error);
        return { success: false, error: error.message };
      }
      
      const updatedMemory: Memory = {
        id: data.id,
        image: data.media_url,
        caption: data.caption || undefined,
        date: new Date(data.event_date),
        location: data.location || undefined,
        likes: data.likes,
        isLiked: data.is_liked || false,
        isVideo: data.is_video,
        type: 'memory' as const,
        accessCode: data.access_code || '',
        createdBy: data.created_by || undefined
      };
      
      console.log('✅ Memory updated successfully');
      return { success: true, data: updatedMemory };
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
      
      const deletedMemory: Memory = {
        id: data.id,
        image: data.media_url,
        caption: data.caption || undefined,
        date: new Date(data.event_date),
        location: data.location || undefined,
        likes: data.likes,
        isLiked: data.is_liked || false,
        isVideo: data.is_video,
        type: 'memory' as const,
        accessCode: data.access_code || '',
        createdBy: data.created_by || undefined
      };
      
      console.log('✅ Memory deleted successfully');
      return { success: true, data: deletedMemory };
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
      
      const updatedMemory: Memory = {
        id: data.id,
        image: data.media_url,
        caption: data.caption || undefined,
        date: new Date(data.event_date),
        location: data.location || undefined,
        likes: data.likes,
        isLiked: data.is_liked || false,
        isVideo: data.is_video,
        type: 'memory' as const,
        accessCode: data.access_code || '',
        createdBy: data.created_by || undefined
      };
      
      console.log('✅ Memory like toggled successfully');
      return { success: true, data: updatedMemory };
    } catch (error) {
      console.error('❌ Error toggling memory like:', error);
      return { success: false, error: 'Failed to toggle memory like' };
    }
  }
};