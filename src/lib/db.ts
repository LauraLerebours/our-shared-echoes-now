import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import { Memory } from '@/components/MemoryList';

// Types for the database - Updated to match actual schema
export type DbMemory = {
  id: string;
  user_id: string;
  media_url?: string;
  caption?: string;
  event_date: string; // Changed from created_at to event_date
  location?: string;
  likes?: number;
  is_video?: boolean;
  is_liked?: boolean;
  type?: string;
};

// Convert database memory to frontend memory
export const dbMemoryToMemory = (dbMemory: DbMemory): Memory => {
  return {
    id: dbMemory.id,
    image: dbMemory.media_url || '',
    caption: dbMemory.caption,
    date: dbMemory.event_date ? new Date(dbMemory.event_date) : new Date(),
    location: dbMemory.location,
    likes: dbMemory.likes || 0,
    isLiked: dbMemory.is_liked || false,
    isVideo: dbMemory.is_video,
    type: dbMemory.type || 'memory',
  };
};

// Convert frontend memory to database memory - updated to include all required fields
export const memoryToDbMemory = (memory: Memory, userId: string): Omit<DbMemory, 'created_at'> => {
  return {
    id: memory.id,
    user_id: userId,
    media_url: memory.image,
    caption: memory.caption,
    event_date: memory.date.toISOString(), // Ensure date is properly formatted
    location: memory.location,
    likes: memory.likes,
    is_video: memory.isVideo,
    is_liked: memory.isLiked,
    type: memory.type,
  };
};

// Memories CRUD operations
export const fetchMemories = async (userId: string): Promise<Memory[]> => {
  try {
    console.log('Fetching memories for user:', userId);
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('user_id', userId)
      .order('event_date', { ascending: false });

    if (error) {
      console.error('Error fetching memories:', error);
      return [];
    }

    console.log('Fetched memories:', data);
    return (data as DbMemory[]).map(dbMemoryToMemory);
  } catch (error) {
    console.error('Error fetching memories:', error);
    return [];
  }
};

export const createMemory = async (memory: Memory, userId: string): Promise<Memory | null> => {
  try {
    console.log('Creating memory:', memory);
    const newDbMemory = memoryToDbMemory(memory, userId);
    console.log('Converted to DB format:', newDbMemory);

    const { data, error } = await supabase
      .from('memories')
      .insert([newDbMemory])
      .select()
      .single();

    if (error) {
      console.error('Error creating memory:', error);
      return null;
    }

    console.log('Created memory successfully:', data);
    return dbMemoryToMemory(data as DbMemory);
  } catch (error) {
    console.error('Error in createMemory:', error);
    return null;
  }
};

export const updateMemory = async (memory: Memory, userId: string): Promise<Memory | null> => {
  const dbMemory = memoryToDbMemory(memory, userId);

  const { data, error } = await supabase
    .from('memories')
    .update(dbMemory)
    .eq('id', memory.id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating memory:', error);
    return null;
  }

  return dbMemoryToMemory(data as DbMemory);
};

export const deleteMemory = async (memoryId: string, userId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('memories')
    .delete()
    .eq('id', memoryId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting memory:', error);
    return false;
  }

  return true;
};

// Shared board operations
export const createSharedBoard = async (userId: string, name?: string): Promise<SharedBoard | null> => {
  // Generate a 6-character sharing code
  const shareCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  const newBoard: Omit<SharedBoard, 'created_at'> = {
    id: uuidv4(),
    owner_id: userId,
    share_code: shareCode,
    name: name || 'My Memories',
  };

  const { data, error } = await supabase
    .from('shared_boards')
    .insert([newBoard])
    .select()
    .single();

  if (error) {
    console.error('Error creating shared board:', error);
    return null;
  }

  return data as SharedBoard;
};

export const getSharedBoard = async (shareCode: string): Promise<SharedBoard | null> => {
  const { data, error } = await supabase
    .from('shared_boards')
    .select('*')
    .eq('share_code', shareCode.toUpperCase())
    .single();

  if (error) {
    console.error('Error fetching shared board:', error);
    return null;
  }

  return data as SharedBoard;
};

export const getSharedMemories = async (ownerId: string): Promise<Memory[]> => {
  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .eq('user_id', ownerId)
    .order('event_date', { ascending: false });

  if (error) {
    console.error('Error fetching shared memories:', error);
    return [];
  }

  return (data as DbMemory[]).map(dbMemoryToMemory);
};