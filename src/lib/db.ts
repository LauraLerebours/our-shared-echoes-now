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

// Board CRUD operations
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

export const getBoard = async (accessCode: string): Promise<Board | null> => {
  try {
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .eq('access_code', accessCode)
      .eq('owner_id', user.id)
      .single();

    if (error) throw error;
    return data as Board;
  } catch (error) {
    console.error('Error fetching board:', error);
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

export const updateBoard = async (board: Board): Promise<Board | null> => {
  try {
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('boards')
      .update({
        name: board.name,
      })
      .eq('id', board.id)
      .eq('access_code', board.access_code)
      .eq('owner_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data as Board;
  } catch (error) {
    console.error('Error updating board:', error);
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

    // First delete the board
    const { error: boardError } = await supabase
      .from('boards')
      .delete()
      .eq('id', boardId)
      .eq('access_code', accessCode)
      .eq('owner_id', user.id);

    if (boardError) throw boardError;

    // Then delete the access code
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

// Shared Board operations
export const createSharedBoard = async (name: string): Promise<SharedBoard | null> => {
  try {
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) throw new Error('User not authenticated');

    const shareCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // First create the access code
    const { error: accessCodeError } = await supabase
      .from('access_codes')
      .insert([{ code: shareCode, name }]);

    if (accessCodeError) throw accessCodeError;

    // Then create the shared board
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

// Memory CRUD operations
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
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) throw new Error('User not authenticated');

    // First verify the access code exists
    const accessCode = await getAccessCode(memory.accessCode);
    if (!accessCode) {
      throw new Error('Invalid access code');
    }

    // Get the board to ensure it exists and we have access
    const board = await getBoard(memory.accessCode);
    if (!board) {
      throw new Error('Board not found or access denied');
    }

    // Verify board ownership
    if (board.owner_id !== user.id) {
      throw new Error('Access denied: You do not own this board');
    }

    const newDbMemory = {
      ...memoryToDbMemory(memory),
      board_id: board.id
    };

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
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) throw new Error('User not authenticated');

    // Get the board to verify ownership
    const board = await getBoard(memory.accessCode);
    if (!board || board.owner_id !== user.id) {
      throw new Error('Access denied: You do not own this board');
    }

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
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) throw new Error('User not authenticated');

    // Get the board to verify ownership
    const board = await getBoard(accessCode);
    if (!board || board.owner_id !== user.id) {
      throw new Error('Access denied: You do not own this board');
    }

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
      .limit(1);

    if (error) throw error;
    return data && data.length > 0 ? data[0] as AccessCode : null;
  } catch (error) {
    console.error('Error fetching access code:', error);
    return null;
  }
};