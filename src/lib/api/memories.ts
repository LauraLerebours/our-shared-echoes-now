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
          .from('memories')
          .select('*')
          .eq('id', id)
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
      
      console.log('🔄 [memoriesApi.updateMemory] Updating memory in database');
      const result = await withRetry(async () => {
        const { data, error } = await supabase
          .from('memories')
          .update(dbUpdates)
          .eq('id', id)
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

  async toggleMemoryLike(id: string, accessCode: string): Promise<ApiResponse<{ likes: number, isLiked: boolean }>> {
    try {
      console.log('🔄 [memoriesApi.toggleMemoryLike] Starting for ID:', id);
      
      console.log('🔄 [memoriesApi.toggleMemoryLike] Fetching current memory state');
      const result = await withRetry(async () => {
        // Try using the RPC function first
        try {
          console.log('🔄 [memoriesApi.toggleMemoryLike] Using RPC function');
          const { data, error } = await supabase.rpc('toggle_memory_like', {
            memory_access_code: accessCode,
            memory_id: id
          });
          
          if (error) {
            console.error('❌ [memoriesApi.toggleMemoryLike] RPC error:', error);
            throw error;
          }
          
          console.log('✅ [memoriesApi.toggleMemoryLike] RPC successful:', data);
          return data;
        } catch (rpcError) {
          console.warn('⚠️ [memoriesApi.toggleMemoryLike] RPC failed, falling back to direct update:', rpcError);
          
          // First get the current memory
          const { data: currentMemory, error: fetchError } = await supabase
            .from('memories')
            .select('*')
            .eq('id', id)
            .eq('access_code', accessCode)
            .single();
          
          if (fetchError) {
            console.error('❌ [memoriesApi.toggleMemoryLike] Fetch error:', fetchError);
            
            if (fetchError.message?.includes('relation') && fetchError.message?.includes('does not exist')) {
              throw new Error('Database tables are missing. Please run database migrations.');
            }
            
            throw new Error(fetchError.message);
          }
          
          // Toggle the like
          const newLikes = currentMemory.is_liked ? currentMemory.likes - 1 : currentMemory.likes + 1;
          const newIsLiked = !currentMemory.is_liked;
          
          console.log('🔄 [memoriesApi.toggleMemoryLike] Updating like state:', { 
            oldLikes: currentMemory.likes, 
            newLikes, 
            oldIsLiked: currentMemory.is_liked, 
            newIsLiked 
          });
          
          const { data, error } = await supabase
            .from('memories')
            .update({ 
              likes: newLikes,
              is_liked: newIsLiked
            })
            .eq('id', id)
            .eq('access_code', accessCode)
            .select()
            .single();
          
          if (error) {
            console.error('❌ [memoriesApi.toggleMemoryLike] Update error:', error);
            throw new Error(error.message);
          }
          
          console.log('✅ [memoriesApi.toggleMemoryLike] Like state updated successfully');
          return { likes: data.likes, isLiked: data.is_liked };
        }
      }, 3, 1000);
      
      console.log('✅ [memoriesApi.toggleMemoryLike] Success');
      return { success: true, data: result };
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
      
      // Try using the RPC function first
      try {
        console.log('🔄 [memoriesApi.updateMemoryDetails] Using RPC function');
        const { data, error } = await supabase.rpc('update_memory_details', {
          memory_id: id,
          memory_caption: updates.caption,
          memory_location: updates.location,
          memory_date: updates.date ? updates.date.toISOString() : null
        });
        
        if (error) {
          console.error('❌ [memoriesApi.updateMemoryDetails] RPC error:', error);
          throw error;
        }
        
        console.log('✅ [memoriesApi.updateMemoryDetails] RPC successful:', data);
        
        // Fetch the updated memory to return
        const { data: updatedMemory, error: fetchError } = await supabase
          .from('memories')
          .select('*')
          .eq('id', id)
          .single();
          
        if (fetchError) {
          throw fetchError;
        }
        
        const memory: Memory = {
          id: updatedMemory.id,
          image: updatedMemory.media_url,
          caption: updatedMemory.caption || undefined,
          date: new Date(updatedMemory.event_date),
          location: updatedMemory.location || undefined,
          likes: updatedMemory.likes,
          isLiked: updatedMemory.is_liked || false,
          isVideo: updatedMemory.is_video,
          type: 'memory' as const,
          accessCode: updatedMemory.access_code || '',
          createdBy: updatedMemory.created_by || undefined
        };
        
        return { success: true, data: memory };
      } catch (rpcError) {
        console.warn('⚠️ [memoriesApi.updateMemoryDetails] RPC failed, falling back to direct update:', rpcError);
        
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
          .select()
          .single();
        
        if (error) {
          console.error('❌ [memoriesApi.updateMemoryDetails] Update error:', error);
          throw new Error(error.message);
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
        
        return { success: true, data: memory };
      }
    } catch (error) {
      console.error('❌ [memoriesApi.updateMemoryDetails] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update memory details' };
    }
  }
};