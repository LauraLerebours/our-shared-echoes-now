
import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import { Memory } from '@/components/MemoryList';

// Types for the database
export type DbMemory = {
  id: string;
  user_id: string;
  image_url?: string;
  caption?: string;
  date: string;
  location?: string;
  likes: number;
  is_liked: boolean;
  is_video?: boolean;
  type: 'memory' | 'note';
  created_at?: string;
};

export type SharedBoard = {
  id: string;
  owner_id: string;
  share_code: string;
  created_at?: string;
  name?: string;
};

// Convert database memory to frontend memory
export const dbMemoryToMemory = (dbMemory: DbMemory): Memory => {
  return {
    id: dbMemory.id,
    image: dbMemory.image_url || '',
    caption: dbMemory.caption,
    date: new Date(dbMemory.date),
    location: dbMemory.location,
    likes: dbMemory.likes,
    isLiked: dbMemory.is_liked,
    isVideo: dbMemory.is_video,
    type: dbMemory.type,
  };
};

// Convert frontend memory to database memory
export const memoryToDbMemory = (memory: Memory, userId: string): Omit<DbMemory, 'created_at'> => {
  return {
    id: memory.id,
    user_id: userId,
    image_url: memory.image,
    caption: memory.caption,
    date: memory.date.toISOString(),
    location: memory.location,
    likes: memory.likes,
    is_liked: memory.isLiked,
    is_video: memory.isVideo,
    type: memory.type || 'memory',
  };
};

// Memories CRUD operations
export const fetchMemories = async (userId: string): Promise<Memory[]> => {
  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching memories:', error);
    return [];
  }

  return (data as DbMemory[]).map(dbMemoryToMemory);
};

export const createMemory = async (memory: Memory, userId: string): Promise<Memory | null> => {
  const newDbMemory = memoryToDbMemory(memory, userId);

  const { data, error } = await supabase
    .from('memories')
    .insert([newDbMemory])
    .select()
    .single();

  if (error) {
    console.error('Error creating memory:', error);
    return null;
  }

  return dbMemoryToMemory(data as DbMemory);
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
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching shared memories:', error);
    return [];
  }

  return (data as DbMemory[]).map(dbMemoryToMemory);
};
