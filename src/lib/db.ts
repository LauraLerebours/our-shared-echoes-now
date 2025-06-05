import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import { Memory } from '@/components/MemoryList';

// Types for the database
export type DbMemory = {
  id: string;
  access_code: string;
  media_url?: string;
  caption?: string;
  event_date: string;
  location?: string;
  likes?: number;
  is_video?: boolean;
  is_liked?: boolean;
};

export type AccessCode = {
  code: string;
  name: string;
  created_at: string;
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
    type: 'memory',
    accessCode: dbMemory.access_code,
  };
};

// Convert frontend memory to database memory
export const memoryToDbMemory = (memory: Memory): Omit<DbMemory, 'created_at'> => {
  return {
    id: memory.id,
    access_code: memory.accessCode,
    media_url: memory.image,
    caption: memory.caption,
    event_date: memory.date.toISOString(),
    location: memory.location,
    likes: memory.likes,
    is_video: memory.isVideo,
    is_liked: memory.isLiked,
  };
};

// Access code operations
export const createAccessCode = async (name: string): Promise<AccessCode | null> => {
  try {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const { data, error } = await supabase
      .from('access_codes')
      .insert([{ code, name }])
      .select()
      .single();

    if (error) throw error;
    return data as AccessCode;
  } catch (error) {
    console.error('Error creating access code:', error);
    return null;
  }
};

export const getAccessCode = async (code: string): Promise<AccessCode | null> => {
  try {
    const { data, error } = await supabase
      .from('access_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (error) throw error;
    return data as AccessCode;
  } catch (error) {
    console.error('Error fetching access code:', error);
    return null;
  }
};

// Memories CRUD operations
export const fetchMemories = async (accessCode: string): Promise<Memory[]> => {
  try {
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('access_code', accessCode)
      .order('event_date', { ascending: false });

    if (error) throw error;
    return (data as DbMemory[]).map(dbMemoryToMemory);
  } catch (error) {
    console.error('Error fetching memories:', error);
    return [];
  }
};

export const createMemory = async (memory: Memory): Promise<Memory | null> => {
  try {
    const newDbMemory = memoryToDbMemory(memory);
    const { data, error } = await supabase
      .from('memories')
      .insert([newDbMemory])
      .select()
      .single();

    if (error) throw error;
    return dbMemoryToMemory(data as DbMemory);
  } catch (error) {
    console.error('Error creating memory:', error);
    return null;
  }
};

export const updateMemory = async (memory: Memory): Promise<Memory | null> => {
  try {
    const dbMemory = memoryToDbMemory(memory);
    const { data, error } = await supabase
      .from('memories')
      .update(dbMemory)
      .eq('id', memory.id)
      .eq('access_code', memory.accessCode)
      .select()
      .single();

    if (error) throw error;
    return dbMemoryToMemory(data as DbMemory);
  } catch (error) {
    console.error('Error updating memory:', error);
    return null;
  }
};

export const deleteMemory = async (memoryId: string, accessCode: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('memories')
      .delete()
      .eq('id', memoryId)
      .eq('access_code', accessCode);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting memory:', error);
    return false;
  }
};