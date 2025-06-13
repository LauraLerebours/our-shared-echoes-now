import { supabase } from '@/integrations/supabase/client';
import { ApiResponse, withRetry } from './base';
import { Memory } from '../types';

export const memoriesApi = {
  async fetchMemories(accessCode: string): Promise<ApiResponse<Memory[]>> {
    try {
      console.log('🔄 [memoriesApi.fetchMemories] Starting for access code:', accessCode);
      
      const result = await withRetry(async () => {
        const { data, error } = await supabase
          .from('memories')
          .select('*')
          .eq('access_code', accessCode)
          .order('event_date', { ascending: false })
          .limit(100);
        
        if (error) {
          console.error('❌ [memoriesApi.fetchMemories] Error:', error);
          
          if (error.message?.includes('404') || error.code === 'PGRST116') {
            throw new Error('Memories table not found. Please check your database setup.');
          }
          
          throw new Error(error.message);
        }
        
        return data || [];
      }, 3, 1000);
      
      // Transform database records to Memory type
      const memories: Memory[] = result.map(record => ({
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
      
      console.log('✅ [memoriesApi.fetchMemories] Success:', memories.length);
      return { success: true, data: memories };
    } catch (error) {
      console.error('❌ [memoriesApi.fetchMemories] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch memories' };
    }
  },

  async fetchMemoriesByAccessCodes(accessCodes: string[], limit: number = 100): Promise<ApiResponse<Memory[]>> {
    try {
      console.log('🔄 [memoriesApi.fetchMemoriesByAccessCodes] Starting for', accessCodes.length, 'codes');
      
      if (accessCodes.length === 0) {
        console.log('✅ [memoriesApi.fetchMemoriesByAccessCodes] No access codes, returning empty');
        return { success: true, data: [] };
      }
      
      // Split into chunks to avoid query size limits and enable parallel processing
      const chunkSize = 5;
      const chunks = [];
      for (let i = 0; i < accessCodes.length; i += chunkSize) {
        chunks.push(accessCodes.slice(i, i + chunkSize));
      }
      
      console.log('🔄 [memoriesApi.fetchMemoriesByAccessCodes] Processing', chunks.length, 'chunks');
      
      // Process chunks in parallel with retry logic
      const chunkPromises = chunks.map(async (chunk, index) => {
        try {
          console.log(`🔄 [Chunk ${index + 1}] Processing codes:`, chunk);
          
          const result = await withRetry(async () => {
            const { data, error } = await supabase
              .from('memories')
              .select('*')
              .in('access_code', chunk)
              .order('event_date', { ascending: false })
              .limit(Math.ceil(limit / chunks.length));
            
            if (error) {
              console.error(`❌ [Chunk ${index + 1}] Error:`, error);
              
              if (error.message?.includes('404') || error.code === 'PGRST116') {
                throw new Error('Memories table not found');
              }
              
              throw new Error(error.message);
            }
            
            return data || [];
          }, 2, 1000); // Fewer retries for chunks
          
          console.log(`✅ [Chunk ${index + 1}] Success:`, result.length, 'memories');
          return result;
        } catch (error) {
          console.error(`❌ [Chunk ${index + 1}] Exception:`, error);
          return []; // Return empty array instead of failing
        }
      });
      
      // Wait for all chunks to complete
      const results = await Promise.allSettled(chunkPromises);
      
      // Combine all successful results
      const allData = results
        .filter(result => result.status === 'fulfilled')
        .flatMap(result => result.value);
      
      // Transform database records to Memory type
      const memories: Memory[] = allData.map(record => ({
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
      
      // Sort by date (most recent first) and apply final limit
      const sortedMemories = memories
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, limit);
      
      console.log('✅ [memoriesApi.fetchMemoriesByAccessCodes] Final result:', sortedMemories.length, 'memories');
      return { success: true, data: sortedMemories };
    } catch (error) {
      console.error('❌ [memoriesApi.fetchMemoriesByAccessCodes] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch memories by access codes' };
    }
  },

  async getMemory(id: string): Promise<ApiResponse<Memory>> {
    try {
      console.log('🔄 [memoriesApi.getMemory] Starting for ID:', id);
      
      const result = await withRetry(async () => {
        const { data, error } = await supabase
          .from('memories')
          .select('*')
          .eq('id', id)
          .single();
        
        if (error) {
          console.error('❌ [memoriesApi.getMemory] Error:', error);
          
          if (error.code === 'PGRST116') {
            throw new Error('Memory not found');
          }
          
          throw new Error(error.message);
        }
        
        return data;
      }, 3, 1000);
      
      const memory: Memory = {
        id: result.id,
        image: result.media_url,
        caption: result.caption || undefined,
        date: new Date(result.event_date),
        location: result.location || undefined,
        likes: result.likes,
        isLiked: result.is_liked || false,
        isVideo: result.is_video,
        type: 'memory' as const,
        accessCode: result.access_code || '',
        createdBy: result.created_by || undefined
      };
      
      console.log('✅ [memoriesApi.getMemory] Success');
      return { success: true, data: memory };
    } catch (error) {
      console.error('❌ [memoriesApi.getMemory] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch memory' };
    }
  },

  async createMemory(memory: Memory): Promise<ApiResponse<Memory>> {
    try {
      console.log('🔄 [memoriesApi.createMemory] Starting');
      
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
      
      const result = await withRetry(async () => {
        const { data, error } = await supabase
          .from('memories')
          .insert(dbRecord)
          .select()
          .single();
        
        if (error) {
          console.error('❌ [memoriesApi.createMemory] Error:', error);
          throw new Error(error.message);
        }
        
        return data;
      }, 3, 1000);
      
      const createdMemory: Memory = {
        id: result.id,
        image: result.media_url,
        caption: result.caption || undefined,
        date: new Date(result.event_date),
        location: result.location || undefined,
        likes: result.likes,
        isLiked: result.is_liked || false,
        isVideo: result.is_video,
        type: 'memory' as const,
        accessCode: result.access_code || '',
        createdBy: result.created_by || undefined
      };
      
      console.log('✅ [memoriesApi.createMemory] Success');
      return { success: true, data: createdMemory };
    } catch (error) {
      console.error('❌ [memoriesApi.createMemory] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create memory' };
    }
  },

  async updateMemory(id: string, updates: Partial<Memory>): Promise<ApiResponse<Memory>> {
    try {
      console.log('🔄 [memoriesApi.updateMemory] Starting for ID:', id);
      
      const dbUpdates: any = {};
      if (updates.image !== undefined) dbUpdates.media_url = updates.image;
      if (updates.caption !== undefined) dbUpdates.caption = updates.caption;
      if (updates.date !== undefined) dbUpdates.event_date = updates.date.toISOString();
      if (updates.location !== undefined) dbUpdates.location = updates.location;
      if (updates.likes !== undefined) dbUpdates.likes = updates.likes;
      if (updates.isLiked !== undefined) dbUpdates.is_liked = updates.isLiked;
      if (updates.isVideo !== undefined) dbUpdates.is_video = updates.isVideo;
      
      const result = await withRetry(async () => {
        const { data, error } = await supabase
          .from('memories')
          .update(dbUpdates)
          .eq('id', id)
          .select()
          .single();
        
        if (error) {
          console.error('❌ [memoriesApi.updateMemory] Error:', error);
          throw new Error(error.message);
        }
        
        return data;
      }, 3, 1000);
      
      const updatedMemory: Memory = {
        id: result.id,
        image: result.media_url,
        caption: result.caption || undefined,
        date: new Date(result.event_date),
        location: result.location || undefined,
        likes: result.likes,
        isLiked: result.is_liked || false,
        isVideo: result.is_video,
        type: 'memory' as const,
        accessCode: result.access_code || '',
        createdBy: result.created_by || undefined
      };
      
      console.log('✅ [memoriesApi.updateMemory] Success');
      return { success: true, data: updatedMemory };
    } catch (error) {
      console.error('❌ [memoriesApi.updateMemory] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update memory' };
    }
  },

  async deleteMemory(id: string, accessCode: string): Promise<ApiResponse<Memory>> {
    try {
      console.log('🔄 [memoriesApi.deleteMemory] Starting for ID:', id);
      
      const result = await withRetry(async () => {
        const { data, error } = await supabase
          .from('memories')
          .delete()
          .eq('id', id)
          .eq('access_code', accessCode)
          .select()
          .single();
        
        if (error) {
          console.error('❌ [memoriesApi.deleteMemory] Error:', error);
          throw new Error(error.message);
        }
        
        return data;
      }, 3, 1000);
      
      const deletedMemory: Memory = {
        id: result.id,
        image: result.media_url,
        caption: result.caption || undefined,
        date: new Date(result.event_date),
        location: result.location || undefined,
        likes: result.likes,
        isLiked: result.is_liked || false,
        isVideo: result.is_video,
        type: 'memory' as const,
        accessCode: result.access_code || '',
        createdBy: result.created_by || undefined
      };
      
      console.log('✅ [memoriesApi.deleteMemory] Success');
      return { success: true, data: deletedMemory };
    } catch (error) {
      console.error('❌ [memoriesApi.deleteMemory] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete memory' };
    }
  },

  async toggleMemoryLike(id: string): Promise<ApiResponse<Memory>> {
    try {
      console.log('🔄 [memoriesApi.toggleMemoryLike] Starting for ID:', id);
      
      const result = await withRetry(async () => {
        // First get the current memory
        const { data: currentMemory, error: fetchError } = await supabase
          .from('memories')
          .select('*')
          .eq('id', id)
          .single();
        
        if (fetchError) {
          console.error('❌ [memoriesApi.toggleMemoryLike] Fetch error:', fetchError);
          throw new Error(fetchError.message);
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
          console.error('❌ [memoriesApi.toggleMemoryLike] Update error:', error);
          throw new Error(error.message);
        }
        
        return data;
      }, 3, 1000);
      
      const updatedMemory: Memory = {
        id: result.id,
        image: result.media_url,
        caption: result.caption || undefined,
        date: new Date(result.event_date),
        location: result.location || undefined,
        likes: result.likes,
        isLiked: result.is_liked || false,
        isVideo: result.is_video,
        type: 'memory' as const,
        accessCode: result.access_code || '',
        createdBy: result.created_by || undefined
      };
      
      console.log('✅ [memoriesApi.toggleMemoryLike] Success');
      return { success: true, data: updatedMemory };
    } catch (error) {
      console.error('❌ [memoriesApi.toggleMemoryLike] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to toggle memory like' };
    }
  }
};