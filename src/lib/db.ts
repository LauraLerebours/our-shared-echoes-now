import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { Memory } from '@/components/MemoryList';
import { requireAuth, validateBoardAccess, sanitizeInput, validateAccessCodeFormat, rateLimiter } from './supabase-security';

// Types for the database
export type DbMemory = {
  id: string;
  access_code: string;
  media_url: string; // Make this required to match database schema
  caption?: string;
  event_date: string;
  location?: string;
  likes?: number;
  is_video?: boolean;
  is_liked?: boolean;
  created_by?: string; // Add created_by field
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
  share_code: string;
  member_ids?: string[]; // New field for member IDs array
};

export type BoardMember = {
  id: string;
  board_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
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
    createdBy: dbMemory.created_by, // Add created_by to frontend memory
  };
};

// Convert frontend memory to database memory
export const memoryToDbMemory = (memory: Memory, userId?: string): Omit<DbMemory, 'created_at'> => {
  return {
    id: memory.id,
    access_code: memory.accessCode,
    media_url: memory.image || '', // Ensure media_url is always provided
    caption: sanitizeInput(memory.caption || ''),
    event_date: memory.date.toISOString(),
    location: memory.location ? sanitizeInput(memory.location) : undefined,
    likes: memory.likes,
    is_video: memory.isVideo,
    is_liked: memory.isLiked,
    created_by: userId, // Add created_by field
  };
};

// Board operations
export const fetchBoards = async (userId: string): Promise<Board[]> => {
  try {
    if (!userId) throw new Error('User ID is required');

    console.log('Fetching boards for user:', userId);

    // Rate limiting
    if (!rateLimiter.isAllowed(`fetchBoards:${userId}`)) {
      throw new Error('Too many requests. Please try again later.');
    }

    // Query boards where user is owner or member
    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .or(`owner_id.eq.${userId},member_ids.cs.{${userId}}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching boards:', error);
      throw error;
    }

    console.log('Boards fetched successfully:', data?.length || 0);
    return data as Board[];
  } catch (error) {
    console.error('Error fetching boards:', error);
    return [];
  }
};

export const getBoardById = async (boardId: string, userId: string): Promise<Board | null> => {
  try {
    if (!userId) throw new Error('User ID is required');

    // Query board where user is owner or member
    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .eq('id', boardId)
      .or(`owner_id.eq.${userId},member_ids.cs.{${userId}}`)
      .single();

    if (error) throw error;
    return data as Board;
  } catch (error) {
    console.error('Error fetching board by ID:', error);
    return null;
  }
};

export const getBoardByShareCode = async (shareCode: string): Promise<Board | null> => {
  try {
    if (!validateAccessCodeFormat(shareCode)) {
      throw new Error('Invalid share code format');
    }

    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .eq('share_code', shareCode.toUpperCase())
      .maybeSingle();

    if (error) throw error;
    return data as Board;
  } catch (error) {
    console.error('Error fetching board by share code:', error);
    return null;
  }
};

export const createBoard = async (name: string, userId: string): Promise<Board | null> => {
  try {
    if (!userId) throw new Error('User ID is required');

    console.log('Creating board:', name, 'for user:', userId);

    // Rate limiting
    if (!rateLimiter.isAllowed(`createBoard:${userId}`)) {
      throw new Error('Too many requests. Please try again later.');
    }

    const sanitizedName = sanitizeInput(name);
    if (!sanitizedName) {
      throw new Error('Board name is required');
    }

    const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const shareCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // First create the access code
    const { error: accessCodeError } = await supabase
      .from('access_codes')
      .insert([{ code: accessCode, name: sanitizedName }]);

    if (accessCodeError) {
      console.error('Error creating access code:', accessCodeError);
      throw accessCodeError;
    }

    // Use the safe function to create board with owner
    const { data: boardId, error } = await supabase.rpc('create_board_with_owner', {
      board_name: sanitizedName,
      owner_user_id: userId,
      access_code_param: accessCode,
      share_code_param: shareCode
    });

    if (error) {
      console.error('Error creating board:', error);
      throw error;
    }

    // Fetch the created board
    const { data: boardData, error: fetchError } = await supabase
      .from('boards')
      .select('*')
      .eq('id', boardId)
      .single();

    if (fetchError) {
      console.error('Error fetching created board:', fetchError);
      throw fetchError;
    }

    console.log('Board created successfully:', boardData);
    return boardData as Board;
  } catch (error) {
    console.error('Error creating board:', error);
    return null;
  }
};

export const addUserToBoard = async (shareCode: string, userId: string): Promise<{ success: boolean; board?: Board; message: string }> => {
  try {
    if (!userId) {
      return { success: false, message: 'User ID is required' };
    }

    if (!validateAccessCodeFormat(shareCode)) {
      return { success: false, message: 'Invalid share code format' };
    }

    // Rate limiting
    if (!rateLimiter.isAllowed(`addUserToBoard:${userId}`)) {
      return { success: false, message: 'Too many requests. Please try again later.' };
    }

    // Use the database function to add user to board
    const { data, error } = await supabase.rpc('add_user_to_board_by_share_code', {
      share_code_param: shareCode.toUpperCase(),
      user_id_param: userId
    });

    if (error) throw error;

    const result = data as { success: boolean; message: string; board_id?: string; board_name?: string };

    if (result.success && result.board_id) {
      // Fetch the full board data
      const board = await getBoardByShareCode(shareCode);
      return { 
        success: true, 
        board: board || undefined, 
        message: result.message 
      };
    }

    return { success: result.success, message: result.message };
  } catch (error) {
    console.error('Error adding user to board:', error);
    return { success: false, message: 'Failed to join board' };
  }
};

export const removeUserFromBoard = async (boardId: string, userId: string): Promise<{ success: boolean; message: string }> => {
  try {
    if (!userId) throw new Error('User ID is required');

    // Rate limiting
    if (!rateLimiter.isAllowed(`removeUserFromBoard:${userId}`)) {
      throw new Error('Too many requests. Please try again later.');
    }

    // Use the database function to remove user from board
    const { data: success, error } = await supabase.rpc('remove_board_member', {
      board_id: boardId,
      user_id: userId
    });

    if (error) {
      console.error('Error removing user from board:', error);
      return { success: false, message: 'Failed to remove user from board' };
    }

    if (success) {
      return { success: true, message: 'Successfully removed from board' };
    } else {
      return { success: false, message: 'You are not a member of this board or board not found' };
    }
  } catch (error) {
    console.error('Error removing user from board:', error);
    return { success: false, message: 'Failed to remove user from board' };
  }
};

// Keep the old function name for backward compatibility
export const deleteBoard = removeUserFromBoard;

// Memory operations
export const fetchMemories = async (accessCode: string): Promise<Memory[]> => {
  try {
    if (!validateAccessCodeFormat(accessCode)) {
      throw new Error('Invalid access code format');
    }

    console.log('Fetching memories for access code:', accessCode);

    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('access_code', accessCode)
      .order('event_date', { ascending: false });

    if (error) {
      console.error('Error fetching memories:', error);
      throw error;
    }

    console.log('Memories fetched successfully:', data?.length || 0);
    return (data as DbMemory[]).map(dbMemoryToMemory);
  } catch (error) {
    console.error('Error fetching memories:', error);
    return [];
  }
};

export const getMemory = async (id: string, accessCode: string): Promise<Memory | null> => {
  try {
    if (!validateAccessCodeFormat(accessCode)) {
      throw new Error('Invalid access code format');
    }

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
    // Validate user authentication
    const userId = await requireAuth();

    // Rate limiting
    if (!rateLimiter.isAllowed(`createMemory:${userId}`)) {
      throw new Error('Too many requests. Please try again later.');
    }

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

export const updateMemory = async (memory: Memory): Promise<Memory | null> => {
  try {
    // Validate user authentication
    const userId = await requireAuth();

    // Rate limiting
    if (!rateLimiter.isAllowed(`updateMemory:${userId}`)) {
      throw new Error('Too many requests. Please try again later.');
    }

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
  } catch (error) {
    console.error('Error updating memory:', error);
    return null;
  }
};

export const deleteMemory = async (memoryId: string, accessCode: string): Promise<boolean> => {
  try {
    // Validate user authentication
    const userId = await requireAuth();

    // Rate limiting
    if (!rateLimiter.isAllowed(`deleteMemory:${userId}`)) {
      throw new Error('Too many requests. Please try again later.');
    }

    if (!validateAccessCodeFormat(accessCode)) {
      throw new Error('Invalid access code format');
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