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
  board_id?: string;
};

export type AccessCode = {
  code: string;
  name: string;
  created_at: string;
};

export type Board = {
  id: string;
  name: string;
  created_at: string;
  access_code: string;
  owner_id?: string;
};

export type SharedBoard = {
  id: string;
  owner_id: string;
  share_code: string;
  name?: string;
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

// Board operations
export const fetchBoards = async (): Promise<Board[]> => {
  try {
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Board[];
  } catch (error) {
    console.error('Error fetching boards:', error);
    return [];
  }
};

export const getBoardById = async (boardId: string): Promise<Board | null> => {
  try {
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .eq('id', boardId)
      .eq('owner_id', user.id)
      .single();

    if (error) throw error;
    return data as Board;
  } catch (error) {
    console.error('Error fetching board by ID:', error);
    return null;
  }
};

export const createBoard = async (name: string): Promise<Board | null> => {
  try {
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) throw new Error('User not authenticated');

    const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // First create the access code
    const { error: accessCodeError } = await supabase
      .from('access_codes')
      .insert([{ code: accessCode, name }]);

    if (accessCodeError) throw accessCodeError;

    // Then create the board
    const { data, error } = await supabase
      .from('boards')
      .insert([{ 
        name, 
        access_code: accessCode,
        owner_id: user.id 
      }])
      .select()
      .single();

    if (error) throw error;
    return data as Board;
  } catch (error) {
    console.error('Error creating board:', error);
    return null;
  }
};

export const createSharedBoard = async (name: string): Promise<SharedBoard | null> => {
  try {
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) throw new Error('User not authenticated');

    // Generate a unique share code
    const shareCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data, error } = await supabase
      .from('shared_boards')
      .insert([{
        owner_id: user.id,
        share_code: shareCode,
        name
      }])
      .select()
      .single();

    if (error) throw error;
    return data as SharedBoard;
  } catch (error) {
    console.error('Error creating shared board:', error);
    return null;
  }
};

export const getSharedBoard = async (shareCode: string): Promise<SharedBoard | null> => {
  try {
    const { data, error } = await supabase
      .from('shared_boards')
      .select('*')
      .eq('share_code', shareCode)
      .single();

    if (error) throw error;
    return data as SharedBoard;
  } catch (error) {
    console.error('Error fetching shared board:', error);
    return null;
  }
};

export const deleteBoard = async (boardId: string, accessCode: string): Promise<boolean> => {
  try {
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) throw new Error('User not authenticated');

    // Start a transaction by enabling read committed isolation
    const { error: isolationError } = await supabase.rpc('set_isolation_level', {
      level: 'read committed'
    });

    if (isolationError) throw isolationError;

    // First delete all memories associated with the board
    const { error: memoriesError } = await supabase
      .from('memories')
      .delete()
      .eq('access_code', accessCode);

    if (memoriesError) throw memoriesError;

    // Then delete the board
    const { error: boardError } = await supabase
      .from('boards')
      .delete()
      .eq('id', boardId)
      .eq('owner_id', user.id);

    if (boardError) throw boardError;

    // Finally delete the access code
    const { error: accessCodeError } = await supabase
      .from('access_codes')
      .delete()
      .eq('code', accessCode);

    if (accessCodeError) throw accessCodeError;

    return true;
  } catch (error) {
    console.error('Error deleting board:', error);
    return false;
  }
};

// Memory operations
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

export const getMemory = async (id: string, accessCode: string): Promise<Memory | null> => {
  try {
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('id', id)
      .eq('access_code', accessCode)
      .single();

    if (error) throw error;
    return data ? dbMemoryToMemory(data as DbMemory) : null;
  } catch (error) {
    console.error('Error fetching memory:', error);
    return null;
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