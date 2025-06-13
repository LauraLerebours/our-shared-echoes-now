import { supabase } from '@/integrations/supabase/client';
import { Memory, LikeResponse } from '@/lib/types';
import { withErrorHandling, requireAuth } from './base';
import { validateAccessCodeFormat, sanitizeInput } from '@/lib/validation';

// Database memory type
interface DbMemory {
  id: string;
  access_code: string;
  media_url: string;
  caption?: string;
  event_date: string;
  location?: string;
  likes?: number;
  is_video?: boolean;
  is_liked?: boolean;
  created_by?: string;
}

// Conversion utilities
const dbMemoryToMemory = (dbMemory: DbMemory): Memory => ({
  id: dbMemory.id,
  image: dbMemory.media_url || '',
  caption: dbMemory.caption,
  date: dbMemory.event_date ? new Date(dbMemory.event_date) : new Date(),
  location: dbMemory.location,
  likes: dbMemory.likes || 0,
  isLiked: dbMemory.is_liked || false,
  isVideo: dbMemory.is_video,
  type: 'memory',
  accessCode: dbMemory.access_code,
  createdBy: dbMemory.created_by,
});

const memoryToDbMemory = (memory: Memory, userId?: string): Omit<DbMemory, 'created_at'> => ({
  id: memory.id,
  access_code: memory.accessCode,
  media_url: memory.image || '',
  caption: memory.caption ? sanitizeInput(memory.caption) : undefined,
  event_date: memory.date.toISOString(),
  location: memory.location ? sanitizeInput(memory.location) : undefined,
  likes: memory.likes,
  is_video: memory.isVideo,
  is_liked: memory.isLiked,
  created_by: userId,
});

export const memoriesApi = {
  async fetchMemories(accessCode: string) {
    if (!validateAccessCodeFormat(accessCode)) {
      return { success: false, error: 'Invalid access code format', data: [] };
    }

    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('memories')
        .select('*')
        .eq('access_code', accessCode)
        .order('event_date', { ascending: false });

      if (error) throw error;
      return (data as DbMemory[]).map(dbMemoryToMemory);
    }, 'fetchMemories');
  },

  async getMemory(id: string, accessCode: string) {
    if (!validateAccessCodeFormat(accessCode)) {
      return { success: false, error: 'Invalid access code format' };
    }

    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('memories')
        .select('*')
        .eq('id', id)
        .eq('access_code', accessCode)
        .single();

      if (error) throw error;
      return data ? dbMemoryToMemory(data as DbMemory) : null;
    }, 'getMemory');
  },

  async createMemory(memory: Memory) {
    return withErrorHandling(async () => {
      const userId = await requireAuth();
      const newDbMemory = memoryToDbMemory(memory, userId);
      
      const { data, error } = await supabase
        .from('memories')
        .insert([newDbMemory])
        .select()
        .single();

      if (error) throw error;
      return dbMemoryToMemory(data as DbMemory);
    }, 'createMemory');
  },

  async updateMemory(memory: Memory) {
    return withErrorHandling(async () => {
      const userId = await requireAuth();
      const dbMemory = memoryToDbMemory(memory, userId);
      
      const { data, error } = await supabase
        .from('memories')
        .update(dbMemory)
        .eq('id', memory.id)
        .eq('access_code', memory.accessCode)
        .select()
        .single();

      if (error) throw error;
      return dbMemoryToMemory(data as DbMemory);
    }, 'updateMemory');
  },

  async deleteMemory(memoryId: string, accessCode: string) {
    if (!validateAccessCodeFormat(accessCode)) {
      return { success: false, error: 'Invalid access code format' };
    }

    return withErrorHandling(async () => {
      await requireAuth();
      
      const { error } = await supabase
        .from('memories')
        .delete()
        .eq('id', memoryId)
        .eq('access_code', accessCode);

      if (error) throw error;
      return true;
    }, 'deleteMemory');
  },

  async toggleMemoryLike(memoryId: string, accessCode: string): Promise<LikeResponse | null> {
    if (!validateAccessCodeFormat(accessCode)) {
      return null;
    }

    const result = await withErrorHandling(async () => {
      await requireAuth();
      
      // Get current memory data
      const { data: currentMemory, error: fetchError } = await supabase
        .from('memories')
        .select('likes, is_liked')
        .eq('id', memoryId)
        .eq('access_code', accessCode)
        .single();

      if (fetchError) throw fetchError;

      const currentLikes = currentMemory.likes || 0;
      const currentIsLiked = currentMemory.is_liked || false;
      
      // Toggle the like state
      const newIsLiked = !currentIsLiked;
      const newLikes = newIsLiked ? currentLikes + 1 : Math.max(0, currentLikes - 1);

      // Update the memory
      const { data, error } = await supabase
        .from('memories')
        .update({ 
          likes: newLikes,
          is_liked: newIsLiked
        })
        .eq('id', memoryId)
        .eq('access_code', accessCode)
        .select('likes, is_liked')
        .single();

      if (error) throw error;

      return {
        success: true,
        likes: data.likes || 0,
        isLiked: data.is_liked || false
      };
    }, 'toggleMemoryLike');

    return result.success ? result.data! : null;
  }
};