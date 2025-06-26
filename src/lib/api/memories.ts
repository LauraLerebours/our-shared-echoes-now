import { supabase } from '@/integrations/supabase/client';
import { ApiResponse, withRetry } from './base';
import { Memory, MediaItem } from '../types';

export const memoriesApi = {
  async fetchMemories(accessCode: string, signal?: AbortSignal): Promise<ApiResponse<Memory[]>> {
    try {
      console.log('🔄 [memoriesApi.fetchMemories] Starting for access code:', accessCode);
      
      // Check if the request has been aborted
      if (signal?.aborted) {
        console.log('🛑 [memoriesApi.fetchMemories] Request aborted');
        return { success: false, error: 'Request aborted by user' };
      }
      
      // Use the new safe function to avoid recursion
      console.log('🔄 [memoriesApi.fetchMemories] Fetching memories using safe function');
      const { data, error } = await supabase
        .rpc('get_memories_by_access_code_safe', { access_code_param: accessCode });
      
      if (error) {
        console.error('❌ [memoriesApi.fetchMemories] Error:', error);
        return { success: false, error: error.message };
      }
      
      // Check if the request has been aborted after fetching data
      if (signal?.aborted) {
        console.log('🛑 [memoriesApi.fetchMemories] Request aborted after data fetch');
        return { success: false, error: 'Request aborted by user' };
      }
      
      // Transform database records to Memory type
      const memories: Memory[] = await Promise.all((data || []).map(async (record) => {
        // Get current user's like status for this memory
        let isLiked = false;
        try {
          const { data: likeStatus } = await supabase.rpc('get_memory_like_status', {
            memory_id_param: record.id
          });
          isLiked = likeStatus?.isLiked || false;
        } catch (error) {
          console.warn('Could not get like status for memory:', record.id, error);
        }

        // Determine memory type and set appropriate fields
        const memoryType = record.memory_type || (record.is_video ? 'video' : 'photo');
        const isNote = memoryType === 'note';
        const isCarousel = memoryType === 'carousel';

        // For carousel memories, fetch the media items
        let mediaItems: MediaItem[] = [];
        if (isCarousel) {
          try {
            const { data: items, error: itemsError } = await supabase
              .from('memory_media_items')
              .select('*')
              .eq('memory_id', record.id)
              .order('order', { ascending: true });
            
            if (!itemsError && items) {
              mediaItems = items as MediaItem[];
            }
          } catch (error) {
            console.warn('Could not fetch media items for carousel memory:', record.id, error);
          }
        }

        return {
          id: record.id,
          image: isNote ? undefined : (isCarousel ? mediaItems[0]?.url : record.media_url),
          caption: record.caption || undefined,
          date: new Date(record.event_date),
          location: record.location || undefined,
          likes: record.total_likes || 0,
          isLiked: isLiked,
          isVideo: memoryType === 'video',
          type: isNote ? 'note' : 'memory',
          memoryType: memoryType,
          accessCode: record.access_code || accessCode,
          createdBy: record.created_by || undefined,
          mediaItems: isCarousel ? mediaItems : undefined
        };
      }));
      
      console.log('✅ [memoriesApi.fetchMemories] Success:', memories.length);
      return { success: true, data: memories };
    } catch (error) {
      // Check if this is an abort error
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('🛑 [memoriesApi.fetchMemories] Request aborted');
        return { success: false, error: 'Request aborted by user' };
      }
      
      console.error('❌ [memoriesApi.fetchMemories] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch memories' };
    }
  },

  async fetchMemoriesByAccessCodes(accessCodes: string[], limit: number = 100, signal?: AbortSignal): Promise<ApiResponse<Memory[]>> {
    try {
      console.log('🔄 [memoriesApi.fetchMemoriesByAccessCodes] Starting for', accessCodes.length, 'codes');
      
      // Check if the request has been aborted
      if (signal?.aborted) {
        console.log('🛑 [memoriesApi.fetchMemoriesByAccessCodes] Request aborted');
        return { success: false, error: 'Request aborted by user' };
      }
      
      if (accessCodes.length === 0) {
        console.log('✅ [memoriesApi.fetchMemoriesByAccessCodes] No access codes, returning empty');
        return { success: true, data: [] };
      }
      
      // Test database connection first
      console.log('🔄 [memoriesApi.fetchMemoriesByAccessCodes] Testing database connection');
      const { error: connectionError } = await supabase
        .from('user_profiles')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (connectionError) {
        console.error('❌ [memoriesApi.fetchMemoriesByAccessCodes] Connection test failed:', connectionError);
        return { success: false, error: `Database connection failed: ${connectionError.message}` };
      }
      
      // Check if the request has been aborted after connection test
      if (signal?.aborted) {
        console.log('🛑 [memoriesApi.fetchMemoriesByAccessCodes] Request aborted after connection test');
        return { success: false, error: 'Request aborted by user' };
      }
      
      // Use the new safe function to avoid recursion
      console.log('🔄 [memoriesApi.fetchMemoriesByAccessCodes] Fetching memories using safe function');
      const { data, error } = await supabase
        .rpc('get_memories_by_access_codes_safe', { access_codes: accessCodes });
      
      if (error) {
        console.error('❌ [memoriesApi.fetchMemoriesByAccessCodes] Error:', error);
        return { success: false, error: error.message };
      }
      
      // Check if the request has been aborted after fetching data
      if (signal?.aborted) {
        console.log('🛑 [memoriesApi.fetchMemoriesByAccessCodes] Request aborted after data fetch');
        return { success: false, error: 'Request aborted by user' };
      }
      
      // Transform database records to Memory type
      const memories: Memory[] = await Promise.all((data || []).map(async (record) => {
        // Get current user's like status for this memory
        let isLiked = false;
        try {
          const { data: likeStatus } = await supabase.rpc('get_memory_like_status', {
            memory_id_param: record.id
          });
          isLiked = likeStatus?.isLiked || false;
        } catch (error) {
          console.warn('Could not get like status for memory:', record.id, error);
        }

        // Determine memory type and set appropriate fields
        const memoryType = record.memory_type || (record.is_video ? 'video' : 'photo');
        const isNote = memoryType === 'note';
        const isCarousel = memoryType === 'carousel';

        // For carousel memories, fetch the media items
        let mediaItems: MediaItem[] = [];
        if (isCarousel) {
          try {
            const { data: items, error: itemsError } = await supabase
              .from('memory_media_items')
              .select('*')
              .eq('memory_id', record.id)
              .order('order', { ascending: true });
            
            if (!itemsError && items) {
              mediaItems = items as MediaItem[];
            }
          } catch (error) {
            console.warn('Could not fetch media items for carousel memory:', record.id, error);
          }
        }

        return {
          id: record.id,
          image: isNote ? undefined : (isCarousel ? mediaItems[0]?.url : record.media_url),
          caption: record.caption || undefined,
          date: new Date(record.event_date),
          location: record.location || undefined,
          likes: record.total_likes || 0,
          isLiked: isLiked,
          isVideo: memoryType === 'video',
          type: isNote ? 'note' : 'memory',
          memoryType: memoryType,
          accessCode: record.access_code || '',
          createdBy: record.created_by || undefined,
          mediaItems: isCarousel ? mediaItems : undefined
        };
      }));
      
      // Sort by date (most recent first) and apply final limit
      const sortedMemories = memories
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, limit);
      
      console.log('✅ [memoriesApi.fetchMemoriesByAccessCodes] Final result:', sortedMemories.length, 'memories');
      return { success: true, data: sortedMemories };
    } catch (error) {
      // Check if this is an abort error
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('🛑 [memoriesApi.fetchMemoriesByAccessCodes] Request aborted');
        return { success: false, error: 'Request aborted by user' };
      }
      
      console.error('❌ [memoriesApi.fetchMemoriesByAccessCodes] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch memories by access codes' };
    }
  },

  async getMemory(id: string): Promise<ApiResponse<Memory>> {
    try {
      console.log('🔄 [memoriesApi.getMemory] Starting for ID:', id);
      
      const result = await withRetry(async () => {
        console.log('🔄 [memoriesApi.getMemory] Fetching memory from database');
        const { data, error } = await supabase
          .from('memories_with_likes')
          .select('*')
          .eq('id', id)
          .eq('moderation_status', 'approved') // Only fetch approved content
          .single();
        
        if (error) {
          console.error('❌ [memoriesApi.getMemory] Error:', error);
          
          if (error.code === 'PGRST116') {
            throw new Error('Memory not found');
          }
          
          if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
            throw new Error('Database tables are missing. Please run database migrations.');
          }
          
          throw new Error(error.message);
        }
        
        console.log('✅ [memoriesApi.getMemory] Memory found');
        return data;
      }, 3, 1000);
      
      // Get current user's like status for this memory
      let isLiked = false;
      try {
        const { data: likeStatus } = await supabase.rpc('get_memory_like_status', {
          memory_id_param: result.id
        });
        isLiked = likeStatus?.isLiked || false;
      } catch (error) {
        console.warn('Could not get like status for memory:', result.id, error);
      }

      // Determine memory type and set appropriate fields
      const memoryType = result.memory_type || (result.is_video ? 'video' : 'photo');
      const isNote = memoryType === 'note';
      const isCarousel = memoryType === 'carousel';

      // For carousel memories, fetch the media items
      let mediaItems: MediaItem[] = [];
      if (isCarousel) {
        try {
          const { data: items, error: itemsError } = await supabase
            .from('memory_media_items')
            .select('*')
            .eq('memory_id', result.id)
            .order('order', { ascending: true });
          
          if (!itemsError && items) {
            mediaItems = items as MediaItem[];
          }
        } catch (error) {
          console.warn('Could not fetch media items for carousel memory:', result.id, error);
        }
      }

      const memory: Memory = {
        id: result.id,
        image: isNote ? undefined : (isCarousel ? mediaItems[0]?.url : result.media_url),
        caption: result.caption || undefined,
        date: new Date(result.event_date),
        location: result.location || undefined,
        likes: result.total_likes || 0,
        isLiked: isLiked,
        isVideo: memoryType === 'video',
        type: isNote ? 'note' : 'memory',
        memoryType: memoryType,
        accessCode: result.access_code || '',
        createdBy: result.created_by || undefined,
        mediaItems: isCarousel ? mediaItems : undefined
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
      
      const isCarousel = memory.memoryType === 'carousel';
      const mediaItems = memory.mediaItems || [];
      
      const dbRecord = {
        id: memory.id,
        media_url: isCarousel ? null : memory.image || null,
        caption: memory.caption,
        event_date: memory.date.toISOString(),
        location: memory.location,
        is_video: !isCarousel && (memory.isVideo || false),
        memory_type: memory.memoryType || (memory.type === 'note' ? 'note' : (memory.isVideo ? 'video' : 'photo')),
        access_code: memory.accessCode,
        created_by: memory.createdBy,
        moderation_status: 'approved', // Set as approved since we moderate on client-side
        moderation_score: 1.0 // High confidence since it passed client-side moderation
      };
      
      console.log('🔄 [memoriesApi.createMemory] Inserting memory into database');
      const result = await withRetry(async () => {
        const { data, error } = await supabase
          .from('memories')
          .insert(dbRecord)
          .select()
          .single();
        
        if (error) {
          console.error('❌ [memoriesApi.createMemory] Error:', error);
          
          if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
            throw new Error('Database tables are missing. Please run database migrations.');
          }
          
          throw new Error(error.message);
        }
        
        console.log('✅ [memoriesApi.createMemory] Memory inserted successfully');
        return data;
      }, 3, 1000);
      
      // If this is a carousel memory, insert the media items
      if (isCarousel && mediaItems.length > 0) {
        console.log('🔄 [memoriesApi.createMemory] Inserting carousel media items');
        
        const mediaItemsToInsert = mediaItems.map((item, index) => ({
          memory_id: result.id,
          url: item.url,
          is_video: item.isVideo,
          order: index
        }));
        
        const { error: mediaItemsError } = await supabase
          .from('memory_media_items')
          .insert(mediaItemsToInsert);
        
        if (mediaItemsError) {
          console.error('❌ [memoriesApi.createMemory] Error inserting media items:', mediaItemsError);
          // Continue anyway, we've already created the memory
        } else {
          console.log('✅ [memoriesApi.createMemory] Media items inserted successfully');
        }
      }
      
      // Determine memory type and set appropriate fields
      const memoryType = result.memory_type || (result.is_video ? 'video' : 'photo');
      const isNote = memoryType === 'note';

      const createdMemory: Memory = {
        id: result.id,
        image: isNote ? undefined : (isCarousel ? mediaItems[0]?.url : result.media_url),
        caption: result.caption || undefined,
        date: new Date(result.event_date),
        location: result.location || undefined,
        likes: 0, // New memories start with 0 likes
        isLiked: false,
        isVideo: memoryType === 'video',
        type: isNote ? 'note' : 'memory',
        memoryType: memoryType,
        accessCode: result.access_code || '',
        createdBy: result.created_by || undefined,
        mediaItems: isCarousel ? mediaItems : undefined
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
      if (updates.isVideo !== undefined) dbUpdates.is_video = updates.isVideo;
      if (updates.memoryType !== undefined) dbUpdates.memory_type = updates.memoryType;
      
      console.log('🔄 [memoriesApi.updateMemory] Updating memory in database');
      const result = await withRetry(async () => {
        const { data, error } = await supabase
          .from('memories')
          .update(dbUpdates)
          .eq('id', id)
          .eq('moderation_status', 'approved') // Only update approved content
          .select()
          .single();
        
        if (error) {
          console.error('❌ [memoriesApi.updateMemory] Error:', error);
          
          if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
            throw new Error('Database tables are missing. Please run database migrations.');
          }
          
          throw new Error(error.message);
        }
        
        console.log('✅ [memoriesApi.updateMemory] Memory updated successfully');
        return data;
      }, 3, 1000);
      
      // If this is a carousel memory and mediaItems are being updated
      if (updates.memoryType === 'carousel' && updates.mediaItems) {
        console.log('🔄 [memoriesApi.updateMemory] Updating carousel media items');
        
        // First delete existing media items
        const { error: deleteError } = await supabase
          .from('memory_media_items')
          .delete()
          .eq('memory_id', id);
        
        if (deleteError) {
          console.error('❌ [memoriesApi.updateMemory] Error deleting existing media items:', deleteError);
        } else {
          // Then insert the new media items
          const mediaItemsToInsert = updates.mediaItems.map((item, index) => ({
            memory_id: id,
            url: item.url,
            is_video: item.isVideo,
            order: index
          }));
          
          const { error: insertError } = await supabase
            .from('memory_media_items')
            .insert(mediaItemsToInsert);
          
          if (insertError) {
            console.error('❌ [memoriesApi.updateMemory] Error inserting media items:', insertError);
          } else {
            console.log('✅ [memoriesApi.updateMemory] Media items updated successfully');
          }
        }
      }
      
      // Get current like count and status
      let likes = 0;
      let isLiked = false;
      try {
        const { data: likeStatus } = await supabase.rpc('get_memory_like_status', {
          memory_id_param: result.id
        });
        likes = likeStatus?.likes || 0;
        isLiked = likeStatus?.isLiked || false;
      } catch (error) {
        console.warn('Could not get like status for memory:', result.id, error);
      }

      // Determine memory type and set appropriate fields
      const memoryType = result.memory_type || (result.is_video ? 'video' : 'photo');
      const isNote = memoryType === 'note';
      const isCarousel = memoryType === 'carousel';

      // For carousel memories, fetch the media items
      let mediaItems: MediaItem[] = [];
      if (isCarousel) {
        try {
          const { data: items, error: itemsError } = await supabase
            .from('memory_media_items')
            .select('*')
            .eq('memory_id', result.id)
            .order('order', { ascending: true });
          
          if (!itemsError && items) {
            mediaItems = items as MediaItem[];
          }
        } catch (error) {
          console.warn('Could not fetch media items for carousel memory:', result.id, error);
        }
      }

      const updatedMemory: Memory = {
        id: result.id,
        image: isNote ? undefined : (isCarousel ? mediaItems[0]?.url : result.media_url),
        caption: result.caption || undefined,
        date: new Date(result.event_date),
        location: result.location || undefined,
        likes: likes,
        isLiked: isLiked,
        isVideo: memoryType === 'video',
        type: isNote ? 'note' : 'memory',
        memoryType: memoryType,
        accessCode: result.access_code || '',
        createdBy: result.created_by || undefined,
        mediaItems: isCarousel ? mediaItems : undefined
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
      
      console.log('🔄 [memoriesApi.deleteMemory] Deleting memory from database');
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
          
          if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
            throw new Error('Database tables are missing. Please run database migrations.');
          }
          
          throw new Error(error.message);
        }
        
        console.log('✅ [memoriesApi.deleteMemory] Memory deleted successfully');
        return data;
      }, 3, 1000);
      
      // Determine memory type and set appropriate fields
      const memoryType = result.memory_type || (result.is_video ? 'video' : 'photo');
      const isNote = memoryType === 'note';
      const isCarousel = memoryType === 'carousel';

      const deletedMemory: Memory = {
        id: result.id,
        image: isNote ? undefined : (isCarousel ? undefined : result.media_url),
        caption: result.caption || undefined,
        date: new Date(result.event_date),
        location: result.location || undefined,
        likes: 0, // Deleted memories have no likes
        isLiked: false,
        isVideo: memoryType === 'video',
        type: isNote ? 'note' : 'memory',
        memoryType: memoryType,
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

  async toggleMemoryLike(id: string, accessCode: string): Promise<ApiResponse<{ likes: number, isLiked: boolean }>> {
    try {
      console.log('🔄 [memoriesApi.toggleMemoryLike] Starting for ID:', id);
      
      console.log('🔄 [memoriesApi.toggleMemoryLike] Using new like system');
      const result = await withRetry(async () => {
        const { data, error } = await supabase.rpc('toggle_memory_like_v2', {
          memory_id_param: id
        });
        
        if (error) {
          console.error('❌ [memoriesApi.toggleMemoryLike] RPC error:', error);
          throw new Error(error.message);
        }
        
        console.log('✅ [memoriesApi.toggleMemoryLike] RPC successful:', data);
        return data;
      }, 3, 1000);
      
      console.log('✅ [memoriesApi.toggleMemoryLike] Success');
      return { success: true, data: { likes: result.likes, isLiked: result.isLiked } };
    } catch (error) {
      console.error('❌ [memoriesApi.toggleMemoryLike] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to toggle memory like' };
    }
  },

  async updateMemoryDetails(
    id: string, 
    accessCode: string, 
    updates: { caption?: string; location?: string; date?: Date }
  ): Promise<ApiResponse<Memory>> {
    try {
      console.log('🔄 [memoriesApi.updateMemoryDetails] Starting for ID:', id);
      
      // Fall back to direct update
      const dbUpdates: any = {};
      if (updates.caption !== undefined) dbUpdates.caption = updates.caption;
      if (updates.location !== undefined) dbUpdates.location = updates.location;
      if (updates.date !== undefined) dbUpdates.event_date = updates.date.toISOString();
      
      const { data, error } = await supabase
        .from('memories')
        .update(dbUpdates)
        .eq('id', id)
        .eq('access_code', accessCode)
        .eq('moderation_status', 'approved') // Only update approved content
        .select()
        .single();
      
      if (error) {
        console.error('❌ [memoriesApi.updateMemoryDetails] Update error:', error);
        throw new Error(error.message);
      }
      
      // Get current like count and status
      let likes = 0;
      let isLiked = false;
      try {
        const { data: likeStatus } = await supabase.rpc('get_memory_like_status', {
          memory_id_param: data.id
        });
        likes = likeStatus?.likes || 0;
        isLiked = likeStatus?.isLiked || false;
      } catch (error) {
        console.warn('Could not get like status for memory:', data.id, error);
      }

      // Determine memory type and set appropriate fields
      const memoryType = data.memory_type || (data.is_video ? 'video' : 'photo');
      const isNote = memoryType === 'note';
      const isCarousel = memoryType === 'carousel';

      // For carousel memories, fetch the media items
      let mediaItems: MediaItem[] = [];
      if (isCarousel) {
        try {
          const { data: items, error: itemsError } = await supabase
            .from('memory_media_items')
            .select('*')
            .eq('memory_id', data.id)
            .order('order', { ascending: true });
          
          if (!itemsError && items) {
            mediaItems = items as MediaItem[];
          }
        } catch (error) {
          console.warn('Could not fetch media items for carousel memory:', data.id, error);
        }
      }

      const memory: Memory = {
        id: data.id,
        image: isNote ? undefined : (isCarousel ? mediaItems[0]?.url : data.media_url),
        caption: data.caption || undefined,
        date: new Date(data.event_date),
        location: data.location || undefined,
        likes: likes,
        isLiked: isLiked,
        isVideo: memoryType === 'video',
        type: isNote ? 'note' : 'memory',
        memoryType: memoryType,
        accessCode: data.access_code || '',
        createdBy: data.created_by || undefined,
        mediaItems: isCarousel ? mediaItems : undefined
      };
      
      return { success: true, data: memory };
    } catch (error) {
      console.error('❌ [memoriesApi.updateMemoryDetails] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update memory details' };
    }
  },

  async getMemoryMediaItems(memoryId: string): Promise<ApiResponse<MediaItem[]>> {
    try {
      console.log('🔄 [memoriesApi.getMemoryMediaItems] Starting for ID:', memoryId);
      
      const { data, error } = await supabase
        .from('memory_media_items')
        .select('*')
        .eq('memory_id', memoryId)
        .order('order', { ascending: true });
      
      if (error) {
        console.error('❌ [memoriesApi.getMemoryMediaItems] Error:', error);
        return { success: false, error: error.message };
      }
      
      console.log('✅ [memoriesApi.getMemoryMediaItems] Success:', data?.length || 0);
      return { success: true, data: data as MediaItem[] || [] };
    } catch (error) {
      console.error('❌ [memoriesApi.getMemoryMediaItems] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch memory media items' };
    }
  },

  async addMediaItemsToMemory(memoryId: string, mediaItems: Omit<MediaItem, 'id' | 'memoryId' | 'createdAt'>[]): Promise<ApiResponse<MediaItem[]>> {
    try {
      console.log('🔄 [memoriesApi.addMediaItemsToMemory] Starting for ID:', memoryId);
      
      const itemsToInsert = mediaItems.map((item, index) => ({
        memory_id: memoryId,
        url: item.url,
        is_video: item.isVideo,
        order: item.order !== undefined ? item.order : index
      }));
      
      const { data, error } = await supabase
        .from('memory_media_items')
        .insert(itemsToInsert)
        .select();
      
      if (error) {
        console.error('❌ [memoriesApi.addMediaItemsToMemory] Error:', error);
        return { success: false, error: error.message };
      }
      
      console.log('✅ [memoriesApi.addMediaItemsToMemory] Success:', data?.length || 0);
      return { success: true, data: data as MediaItem[] || [] };
    } catch (error) {
      console.error('❌ [memoriesApi.addMediaItemsToMemory] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add media items to memory' };
    }
  },

  async updateMediaItemsOrder(memoryId: string, itemOrders: { id: string, order: number }[]): Promise<ApiResponse<boolean>> {
    try {
      console.log('🔄 [memoriesApi.updateMediaItemsOrder] Starting for ID:', memoryId);
      
      // Update each item's order
      for (const item of itemOrders) {
        const { error } = await supabase
          .from('memory_media_items')
          .update({ order: item.order })
          .eq('id', item.id)
          .eq('memory_id', memoryId);
        
        if (error) {
          console.error(`❌ [memoriesApi.updateMediaItemsOrder] Error updating item ${item.id}:`, error);
          return { success: false, error: error.message };
        }
      }
      
      console.log('✅ [memoriesApi.updateMediaItemsOrder] Success');
      return { success: true, data: true };
    } catch (error) {
      console.error('❌ [memoriesApi.updateMediaItemsOrder] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update media items order' };
    }
  },

  async deleteMediaItem(id: string, memoryId: string): Promise<ApiResponse<boolean>> {
    try {
      console.log('🔄 [memoriesApi.deleteMediaItem] Starting for ID:', id);
      
      const { error } = await supabase
        .from('memory_media_items')
        .delete()
        .eq('id', id)
        .eq('memory_id', memoryId);
      
      if (error) {
        console.error('❌ [memoriesApi.deleteMediaItem] Error:', error);
        return { success: false, error: error.message };
      }
      
      console.log('✅ [memoriesApi.deleteMediaItem] Success');
      return { success: true, data: true };
    } catch (error) {
      console.error('❌ [memoriesApi.deleteMediaItem] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete media item' };
    }
  }
};