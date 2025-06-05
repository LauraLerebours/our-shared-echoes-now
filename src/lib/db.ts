import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import { Memory } from '@/components/MemoryList';

// Types for the database
export type DbMemory = {
  id: string;
  user_id: string;
  board_id: string;
  media_url?: string;
  caption?: string;
  event_date: string;
  location?: string;
  likes?: number;
  is_video?: boolean;
  is_liked?: boolean;
};

export type Board = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
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
    boardId: dbMemory.board_id,
  };
};

// Convert frontend memory to database memory
export const memoryToDbMemory = (memory: Memory, userId: string): Omit<DbMemory, 'created_at'> => {
  return {
    id: memory.id,
    user_id: userId,
    board_id: memory.boardId,
    media_url: memory.image,
    caption: memory.caption,
    event_date: memory.date.toISOString(),
    location: memory.location,
    likes: memory.likes,
    is_video: memory.isVideo,
    is_liked: memory.isLiked,
  };
};

// Boards CRUD operations
export const createBoard = async (userId: string, name: string): Promise<Board | null> => {
  try {
    const { data, error } = await supabase
      .from('boards')
      .insert([{ user_id: userId, name }])
      .select()
      .single();

    if (error) throw error;
    return data as Board;
  } catch (error) {
    console.error('Error creating board:', error);
    return null;
  }
};

export const fetchBoards = async (userId: string): Promise<Board[]> => {
  try {
    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Board[];
  } catch (error) {
    console.error('Error fetching boards:', error);
    return [];
  }
};

export const updateBoard = async (boardId: string, name: string, userId: string): Promise<Board | null> => {
  try {
    const { data, error } = await supabase
      .from('boards')
      .update({ name })
      .eq('id', boardId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data as Board;
  } catch (error) {
    console.error('Error updating board:', error);
    return null;
  }
};

export const deleteBoard = async (boardId: string, userId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('boards')
      .delete()
      .eq('id', boardId)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting board:', error);
    return false;
  }
};

// Memories CRUD operations
export const fetchMemories = async (userId: string, boardId?: string): Promise<Memory[]> => {
  try {
    let query = supabase
      .from('memories')
      .select('*')
      .eq('user_id', userId)
      .order('event_date', { ascending: false });

    if (boardId) {
      query = query.eq('board_id', boardId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data as DbMemory[]).map(dbMemoryToMemory);
  } catch (error) {
    console.error('Error fetching memories:', error);
    return [];
  }
};

export const createMemory = async (memory: Memory, userId: string): Promise<Memory | null> => {
  try {
    const newDbMemory = memoryToDbMemory(memory, userId);
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

export const updateMemory = async (memory: Memory, userId: string): Promise<Memory | null> => {
  try {
    const dbMemory = memoryToDbMemory(memory, userId);
    const { data, error } = await supabase
      .from('memories')
      .update(dbMemory)
      .eq('id', memory.id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return dbMemoryToMemory(data as DbMemory);
  } catch (error) {
    console.error('Error updating memory:', error);
    return null;
  }
};

export const deleteMemory = async (memoryId: string, userId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('memories')
      .delete()
      .eq('id', memoryId)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting memory:', error);
    return false;
  }
};

// Shared board operations
export type SharedBoard = {
  id: string;
  owner_id: string;
  share_code: string;
  name?: string;
  created_at?: string;
};

export const createSharedBoard = async (userId: string, name?: string): Promise<SharedBoard | null> => {
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