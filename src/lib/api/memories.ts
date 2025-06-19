import { supabase } from '@/integrations/supabase/client';
import { ApiResponse, withRetry } from './base';
import { Memory } from '../types';

export const memoriesApi = {
  async fetchMemories(accessCode: string, signal?: AbortSignal): Promise<ApiResponse<Memory[]>> {
    try {
      console.log('🔄 [memoriesApi.fetchMemories] Starting for access code:', accessCode);
      
      // Check if the request has been aborted
      if (signal?.aborted) {
        console.log('🛑 [memoriesApi.fetchMemories] Request aborted');
        return { success: false, error: 'Request aborted by user' };
      }
      
      const result = await withRetry(async () => {
        // Check if the request has been aborted
        if (signal?.aborted) {
          throw new Error('Request aborted');
        }
        
        // Test database connection first
        console.log('🔄 [memoriesApi.fetchMemories] Testing database connection');
        const { error: connectionError } = await supabase
          .from('user_profiles')
          .select('id')
          .limit(1)
          .maybeSingle();

        if (connectionError) {
          console.error('❌ [memoriesApi.fetchMemories] Connection test failed:', connectionError);
          throw new Error(`Database connection failed: ${connectionError.message}`);
        }

        // Check if the request has been aborted after connection test
        if (signal?.aborted) {
          throw new Error('Request aborted');
        }

        console.log('🔄 [memoriesApi.fetchMemories] Fetching memories from database');
        const { data, error } = await supabase
          .from('memories_with_likes')
          .select('*')
          .eq('access_code', accessCode)
          .eq('moderation_status', 'approved') // Only fetch approved content
          .order('event_date', { ascending: false })
          .limit(100);
        
        if (error) {
          console.error('❌ [memoriesApi.fetchMemories] Error:', error);
          
          if (error.message?.includes('404') || error.code === 'PGRST116') {
            throw new Error('Memories table not found. Please check your database setup.');
          }
          
          if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
            throw new Error('Database tables are missing. Please run database migrations.');
          }
          
          if (error.message?.includes('permission denied')) {
            throw new Error('Database permission denied. Please check your authentication.');
          }
          
          throw new Error(error.message);
        }
        
        console.log('✅ [memoriesApi.fetchMemories] Received data from database:', data?.length || 0, 'memories');
        return data || [];
      }, 3, 1000, signal);
      
      // Check if the request has been aborted after fetching data
      if (signal?.aborted) {
        console.log('🛑 [memoriesApi.fetchMemories] Request aborted after data fetch');
        return { success: false, error: 'Request aborted by user' };
      }
      
      // Transform database records to Memory type
      const memories: Memory[] = await Promise.all(result.map(async (record) => {
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

        return {
          id: record.id,
          image: isNote ? undefined : record.media_url,
          caption: record.caption || undefined,
          date: new Date(record.event_date),
          location: record.location || undefined,
          likes: record.total_likes || 0,
          isLiked: isLiked,
          isVideo: memoryType === 'video',
          type: isNote ? 'note' : 'memory',
          memoryType: memoryType,
          accessCode: record.access_code || accessCode,
          createdBy: record.created_by || undefined
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
          
          // Check if the request has been aborted
          if (signal?.aborted) {
            console.log(`🛑 [Chunk ${index + 1}] Request aborted`);
            return [];
          }
          
          const result = await withRetry(async () => {
            // Check if the request has been aborted
            if (signal?.aborted) {
              throw new Error('Request aborted');
            }
            
            console.log(`🔄 [Chunk ${index + 1}] Fetching memories from database`);
            const { data, error } = await supabase
              .from('memories_with_likes')
              .select('*')
              .in('access_code', chunk)
              .eq('moderation_status', 'approved') // Only fetch approved content
              .order('event_date', { ascending: false })
              .limit(Math.ceil(limit / chunks.length));
            
            if (error) {
              console.error(`❌ [Chunk ${index + 1}] Error:`, error);
              
              if (error.message?.includes('404') || error.code === 'PGRST116') {
                throw new Error('Memories table not found');
              }
              
              if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
                throw new Error('Database tables are missing');
              }
              
              throw new Error(error.message);
            }
            
            console.log(`✅ [Chunk ${index + 1}] Received data:`, data?.length || 0, 'memories');
            return data || [];
          }, 2, 1000, signal); // Fewer retries for chunks
          
          console.log(`✅ [Chunk ${index + 1}] Success:`, result.length, 'memories');
          return result;
        } catch (error) {
          // Check if this is an abort error
          if (error instanceof Error && error.name === 'AbortError') {
            console.log(`🛑 [Chunk ${index + 1}] Request aborted`);
            return [];
          }
          
          console.error(`❌ [Chunk ${index + 1}] Exception:`, error);
          return []; // Return empty array instead of failing
        }
      });
      
      // Wait for all chunks to complete
      console.log('🔄 [memoriesApi.fetchMemoriesByAccessCodes] Waiting for all chunks to complete');
      const results = await Promise.allSettled(chunkPromises);
      
      // Check if the request has been aborted after all chunks complete
      if (signal?.aborted) {
        console.log('🛑 [memoriesApi.fetchMemoriesByAccessCodes] Request aborted after chunks completed');
        return { success: false, error: 'Request aborted by user' };
      }
      
      // Combine all successful results
      const allData = results
        .filter(result => result.status === 'fulfilled')
        .flatMap(result => (result as PromiseFulfilledResult<any[]>).value);
      
      console.log('✅ [memoriesApi.fetchMemoriesByAccessCodes] Combined data:', allData.length, 'memories');
      
      // Transform database records to Memory type
      const memories: Memory[] = await Promise.all(allData.map(async (record) => {
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

        return {
          id: record.id,
          image: isNote ? undefined : record.media_url,
          caption: record.caption || undefined,
          date: new Date(record.event_date),
          location: record.location || undefined,
          likes: record.total_likes || 0,
          isLiked: isLiked,
          isVideo: memoryType === 'video',
          type: isNote ? 'note' : 'memory',
          memoryType: memoryType,
          accessCode: record.access_code || '',
          createdBy: record.created_by || undefined
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

      const memory: Memory = {
        id: result.id,
        image: isNote ? undefined : result.media_url,
        caption: result.caption || undefined,
        date: new Date(result.event_date),
        location: result.location || undefined,
        likes: result.total_likes || 0,
        isLiked: isLiked,
        isVideo: memoryType === 'video',
        type: isNote ? 'note' : 'memory',
        memoryType: memoryType,
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
        media_url: memory.image || null,
        caption: memory.caption,
        event_date: memory.date.toISOString(),
        location: memory.location,
        is_video: memory.isVideo || false,
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
      
      // Determine memory type and set appropriate fields
      const memoryType = result.memory_type || (result.is_video ? 'video' : 'photo');
      const isNote = memoryType === 'note';

      const createdMemory: Memory = {
        id: result.id,
        image: isNote ? undefined : result.media_url,
        caption: result.caption || undefined,
        date: new Date(result.event_date),
        location: result.location || undefined,
        likes: 0, // New memories start with 0 likes
        isLiked: false,
        isVideo: memoryType === 'video',
        type: isNote ? 'note' : 'memory',
        memoryType: memoryType,
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

      const updatedMemory: Memory = {
        id: result.id,
        image: isNote ? undefined : result.media_url,
        caption: result.caption || undefined,
        date: new Date(result.event_date),
        location: result.location || undefined,
        likes: likes,
        isLiked: isLiked,
        isVideo: memoryType === 'video',
        type: isNote ? 'note' : 'memory',
        memoryType: memoryType,
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

      const deletedMemory: Memory = {
        id: result.id,
        image: isNote ? undefined : result.media_url,
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

      const memory: Memory = {
        id: data.id,
        image: isNote ? undefined : data.media_url,
        caption: data.caption || undefined,
        date: new Date(data.event_date),
        location: data.location || undefined,
        likes: likes,
        isLiked: isLiked,
        isVideo: memoryType === 'video',
        type: isNote ? 'note' : 'memory',
        memoryType: memoryType,
        accessCode: data.access_code || '',
        createdBy: data.created_by || undefined
      };
      
      return { success: true, data: memory };
    } catch (error) {
      console.error('❌ [memoriesApi.updateMemoryDetails] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update memory details' };
    }
  }
};