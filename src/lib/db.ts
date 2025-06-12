import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { Memory } from '@/components/MemoryList';
import { requireAuth, validateBoardAccess, sanitizeInput, validateAccessCodeFormat, rateLimiter } from './supabase-security';

// Simplified types
export type DbMemory = {
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
};

export type Board = {
  id: string;
  name: string;
  created_at: string;
  access_code: string;
  owner_id?: string;
  share_code: string;
  member_ids?: string[];
};

// Utility functions
export const dbMemoryToMemory = (dbMemory: DbMemory): Memory => ({
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

export const memoryToDbMemory = (memory: Memory, userId?: string): Omit<DbMemory, 'created_at'> => ({
  id: memory.id,
  access_code: memory.accessCode,
  media_url: memory.image || '',
  caption: sanitizeInput(memory.caption || ''),
  event_date: memory.date.toISOString(),
  location: memory.location ? sanitizeInput(memory.location) : undefined,
  likes: memory.likes,
  is_video: memory.isVideo,
  is_liked: memory.isLiked,
  created_by: userId,
});

// Generic database operation wrapper
const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  errorMessage: string
): Promise<T | null> => {
  try {
    return await operation();
  } catch (error) {
    console.error(`${errorMessage}:`, error);
    return null;
  }
};

// Board operations
export const fetchBoards = async (userId: string): Promise<Board[]> => {
  if (!userId || !rateLimiter.isAllowed(`fetchBoards:${userId}`)) {
    return [];
  }

  return withErrorHandling(async () => {
    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .or(`owner_id.eq.${userId},member_ids.cs.{${userId}}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Board[];
  }, 'Error fetching boards') || [];
};

export const getBoardById = async (boardId: string, userId: string): Promise<Board | null> => {
  if (!userId) return null;

  return withErrorHandling(async () => {
    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .eq('id', boardId)
      .or(`owner_id.eq.${userId},member_ids.cs.{${userId}}`)
      .single();

    if (error) throw error;
    return data as Board;
  }, 'Error fetching board by ID');
};

export const getBoardByShareCode = async (shareCode: string): Promise<Board | null> => {
  if (!validateAccessCodeFormat(shareCode)) return null;

  return withErrorHandling(async () => {
    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .eq('share_code', shareCode.toUpperCase())
      .maybeSingle();

    if (error) throw error;
    return data as Board;
  }, 'Error fetching board by share code');
};

export const createBoard = async (name: string, userId: string): Promise<Board | null> => {
  if (!userId || !rateLimiter.isAllowed(`createBoard:${userId}`)) return null;

  const sanitizedName = sanitizeInput(name);
  if (!sanitizedName) return null;

  return withErrorHandling(async () => {
    const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const shareCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Create access code first
    await supabase
      .from('access_codes')
      .insert([{ code: accessCode, name: sanitizedName }]);

    // Use the safe function to create board
    const { data: boardId, error } = await supabase.rpc('create_board_with_owner', {
      board_name: sanitizedName,
      owner_user_id: userId,
      access_code_param: accessCode,
      share_code_param: shareCode
    });

    if (error) throw error;

    // Fetch the created board
    const { data: boardData, error: fetchError } = await supabase
      .from('boards')
      .select('*')
      .eq('id', boardId)
      .single();

    if (fetchError) throw fetchError;
    return boardData as Board;
  }, 'Error creating board');
};

export const renameBoard = async (
  boardId: string, 
  newName: string, 
  userId: string
): Promise<{ success: boolean; message: string; newName?: string }> => {
  if (!userId || !newName.trim() || !rateLimiter.isAllowed(`renameBoard:${userId}`)) {
    return { success: false, message: 'Invalid request' };
  }

  try {
    const { data, error } = await supabase.rpc('rename_board', {
      board_id: boardId,
      new_name: newName.trim(),
      user_id: userId
    });

    if (error) throw error;

    const result = data as { success: boolean; message: string; new_name?: string };
    return { 
      success: result.success, 
      message: result.message,
      newName: result.new_name 
    };
  } catch (error) {
    console.error('Error renaming board:', error);
    return { success: false, message: 'Failed to rename board' };
  }
};

export const addUserToBoard = async (
  shareCode: string, 
  userId: string
): Promise<{ success: boolean; board?: Board; message: string }> => {
  if (!userId || !validateAccessCodeFormat(shareCode) || !rateLimiter.isAllowed(`addUserToBoard:${userId}`)) {
    return { success: false, message: 'Invalid request' };
  }

  try {
    const { data, error } = await supabase.rpc('add_user_to_board_by_share_code', {
      share_code_param: shareCode.toUpperCase(),
      user_id_param: userId
    });

    if (error) throw error;

    const result = data as { success: boolean; message: string; board_id?: string };

    if (result.success && result.board_id) {
      const board = await getBoardByShareCode(shareCode);
      return { success: true, board: board || undefined, message: result.message };
    }

    return { success: result.success, message: result.message };
  } catch (error) {
    console.error('Error adding user to board:', error);
    return { success: false, message: 'Failed to join board' };
  }
};

export const removeUserFromBoard = async (
  boardId: string, 
  userId: string
): Promise<{ success: boolean; message: string }> => {
  if (!userId || !rateLimiter.isAllowed(`removeUserFromBoard:${userId}`)) {
    return { success: false, message: 'Invalid request' };
  }

  try {
    const { data: success, error } = await supabase.rpc('remove_board_member', {
      board_id: boardId,
      user_id: userId
    });

    if (error) throw error;

    return {
      success: !!success,
      message: success ? 'Successfully removed from board' : 'You are not a member of this board'
    };
  } catch (error) {
    console.error('Error removing user from board:', error);
    return { success: false, message: 'Failed to remove user from board' };
  }
};

// Memory operations
export const fetchMemories = async (accessCode: string): Promise<Memory[]> => {
  if (!validateAccessCodeFormat(accessCode)) return [];

  return withErrorHandling(async () => {
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('access_code', accessCode)
      .order('event_date', { ascending: false });

    if (error) throw error;
    return (data as DbMemory[]).map(dbMemoryToMemory);
  }, 'Error fetching memories') || [];
};

export const getMemory = async (id: string, accessCode: string): Promise<Memory | null> => {
  if (!validateAccessCodeFormat(accessCode)) return null;

  return withErrorHandling(async () => {
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('id', id)
      .eq('access_code', accessCode)
      .single();

    if (error) throw error;
    return data ? dbMemoryToMemory(data as DbMemory) : null;
  }, 'Error fetching memory');
};

export const createMemory = async (memory: Memory): Promise<Memory | null> => {
  const userId = await requireAuth();
  if (!rateLimiter.isAllowed(`createMemory:${userId}`)) return null;

  return withErrorHandling(async () => {
    const newDbMemory = memoryToDbMemory(memory, userId);
    const { data, error } = await supabase
      .from('memories')
      .insert([newDbMemory])
      .select()
      .single();

    if (error) throw error;
    return dbMemoryToMemory(data as DbMemory);
  }, 'Error creating memory');
};

export const updateMemory = async (memory: Memory): Promise<Memory | null> => {
  const userId = await requireAuth();
  if (!rateLimiter.isAllowed(`updateMemory:${userId}`)) return null;

  return withErrorHandling(async () => {
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
  }, 'Error updating memory');
};

export const deleteMemory = async (memoryId: string, accessCode: string): Promise<boolean> => {
  const userId = await requireAuth();
  if (!rateLimiter.isAllowed(`deleteMemory:${userId}`) || !validateAccessCodeFormat(accessCode)) {
    return false;
  }

  return withErrorHandling(async () => {
    const { error } = await supabase
      .from('memories')
      .delete()
      .eq('id', memoryId)
      .eq('access_code', accessCode);

    if (error) throw error;
    return true;
  }, 'Error deleting memory') || false;
};

// Like functionality
export const toggleMemoryLike = async (memoryId: string, accessCode: string): Promise<{ success: boolean; likes: number; isLiked: boolean } | null> => {
  const userId = await requireAuth();
  if (!rateLimiter.isAllowed(`toggleLike:${userId}`) || !validateAccessCodeFormat(accessCode)) {
    return null;
  }

  return withErrorHandling(async () => {
    // First, get the current memory data
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

    // Update the memory with new like data
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
  }, 'Error toggling memory like');
};

// Keep backward compatibility
export const deleteBoard = removeUserFromBoard;