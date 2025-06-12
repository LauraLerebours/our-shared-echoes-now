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

// Generic database operation wrapper with better error handling
const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  errorMessage: string
): Promise<T | null> => {
  try {
    console.log(`Starting operation: ${errorMessage}`);
    const result = await operation();
    console.log(`Operation completed successfully: ${errorMessage}`);
    return result;
  } catch (error) {
    console.error(`${errorMessage}:`, error);
    
    // Log more details about the error
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    
    return null;
  }
};

// Board operations
export const fetchBoards = async (userId: string): Promise<Board[]> => {
  if (!userId || !rateLimiter.isAllowed(`fetchBoards:${userId}`)) {
    console.warn('fetchBoards: Invalid userId or rate limited');
    return [];
  }

  return withErrorHandling(async () => {
    console.log('Fetching boards for user:', userId);
    
    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .or(`owner_id.eq.${userId},member_ids.cs.{${userId}}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error in fetchBoards:', error);
      throw error;
    }
    
    console.log('Boards fetched successfully:', data?.length || 0);
    return data as Board[];
  }, 'Error fetching boards') || [];
};

export const getBoardById = async (boardId: string, userId: string): Promise<Board | null> => {
  if (!userId) {
    console.warn('getBoardById: No userId provided');
    return null;
  }

  return withErrorHandling(async () => {
    console.log('Fetching board by ID:', boardId, 'for user:', userId);
    
    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .eq('id', boardId)
      .or(`owner_id.eq.${userId},member_ids.cs.{${userId}}`)
      .single();

    if (error) {
      console.error('Supabase error in getBoardById:', error);
      throw error;
    }
    
    console.log('Board fetched successfully:', data?.name);
    return data as Board;
  }, 'Error fetching board by ID');
};

export const getBoardByShareCode = async (shareCode: string): Promise<Board | null> => {
  if (!validateAccessCodeFormat(shareCode)) {
    console.warn('getBoardByShareCode: Invalid share code format');
    return null;
  }

  return withErrorHandling(async () => {
    console.log('Fetching board by share code:', shareCode);
    
    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .eq('share_code', shareCode.toUpperCase())
      .maybeSingle();

    if (error) {
      console.error('Supabase error in getBoardByShareCode:', error);
      throw error;
    }
    
    console.log('Board fetched by share code:', data?.name || 'not found');
    return data as Board;
  }, 'Error fetching board by share code');
};

export const createBoard = async (name: string, userId: string): Promise<Board | null> => {
  if (!userId || !rateLimiter.isAllowed(`createBoard:${userId}`)) {
    console.warn('createBoard: Invalid userId or rate limited');
    return null;
  }

  const sanitizedName = sanitizeInput(name);
  if (!sanitizedName) {
    console.warn('createBoard: Invalid board name');
    return null;
  }

  return withErrorHandling(async () => {
    console.log('Creating board:', sanitizedName, 'for user:', userId);
    
    const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const shareCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Create access code first
    const { error: accessCodeError } = await supabase
      .from('access_codes')
      .insert([{ code: accessCode, name: sanitizedName }]);

    if (accessCodeError) {
      console.error('Error creating access code:', accessCodeError);
      throw accessCodeError;
    }

    // Use the safe function to create board
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
    
    console.log('Board created successfully:', boardData.name);
    return boardData as Board;
  }, 'Error creating board');
};

export const renameBoard = async (
  boardId: string, 
  newName: string, 
  userId: string
): Promise<{ success: boolean; message: string; newName?: string }> => {
  if (!userId || !newName.trim() || !rateLimiter.isAllowed(`renameBoard:${userId}`)) {
    console.warn('renameBoard: Invalid parameters or rate limited');
    return { success: false, message: 'Invalid request' };
  }

  try {
    console.log('Renaming board:', boardId, 'to:', newName.trim());
    
    const { data, error } = await supabase.rpc('rename_board', {
      board_id: boardId,
      new_name: newName.trim(),
      user_id: userId
    });

    if (error) {
      console.error('Error renaming board:', error);
      throw error;
    }

    const result = data as { success: boolean; message: string; new_name?: string };
    console.log('Board renamed successfully:', result);
    
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
    console.warn('addUserToBoard: Invalid parameters or rate limited');
    return { success: false, message: 'Invalid request' };
  }

  try {
    console.log('Adding user to board with share code:', shareCode);
    
    const { data, error } = await supabase.rpc('add_user_to_board_by_share_code', {
      share_code_param: shareCode.toUpperCase(),
      user_id_param: userId
    });

    if (error) {
      console.error('Error adding user to board:', error);
      throw error;
    }

    const result = data as { success: boolean; message: string; board_id?: string };
    console.log('User added to board result:', result);

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
    console.warn('removeUserFromBoard: Invalid parameters or rate limited');
    return { success: false, message: 'Invalid request' };
  }

  try {
    console.log('Removing user from board:', boardId);
    
    const { data: success, error } = await supabase.rpc('remove_board_member', {
      board_id: boardId,
      user_id: userId
    });

    if (error) {
      console.error('Error removing user from board:', error);
      throw error;
    }

    console.log('User removed from board result:', success);

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
  if (!validateAccessCodeFormat(accessCode)) {
    console.warn('fetchMemories: Invalid access code format');
    return [];
  }

  return withErrorHandling(async () => {
    console.log('Fetching memories for access code:', accessCode);
    
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('access_code', accessCode)
      .order('event_date', { ascending: false });

    if (error) {
      console.error('Supabase error in fetchMemories:', error);
      throw error;
    }
    
    console.log('Memories fetched successfully:', data?.length || 0);
    return (data as DbMemory[]).map(dbMemoryToMemory);
  }, 'Error fetching memories') || [];
};

export const getMemory = async (id: string, accessCode: string): Promise<Memory | null> => {
  if (!validateAccessCodeFormat(accessCode)) {
    console.warn('getMemory: Invalid access code format');
    return null;
  }

  return withErrorHandling(async () => {
    console.log('Fetching memory:', id, 'with access code:', accessCode);
    
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('id', id)
      .eq('access_code', accessCode)
      .single();

    if (error) {
      console.error('Supabase error in getMemory:', error);
      throw error;
    }
    
    console.log('Memory fetched successfully:', data?.caption || 'no caption');
    return data ? dbMemoryToMemory(data as DbMemory) : null;
  }, 'Error fetching memory');
};

export const createMemory = async (memory: Memory): Promise<Memory | null> => {
  const userId = await requireAuth();
  if (!rateLimiter.isAllowed(`createMemory:${userId}`)) {
    console.warn('createMemory: Rate limited');
    return null;
  }

  return withErrorHandling(async () => {
    console.log('Creating memory:', memory.caption || 'no caption');
    
    const newDbMemory = memoryToDbMemory(memory, userId);
    const { data, error } = await supabase
      .from('memories')
      .insert([newDbMemory])
      .select()
      .single();

    if (error) {
      console.error('Supabase error in createMemory:', error);
      throw error;
    }
    
    console.log('Memory created successfully');
    return dbMemoryToMemory(data as DbMemory);
  }, 'Error creating memory');
};

export const updateMemory = async (memory: Memory): Promise<Memory | null> => {
  const userId = await requireAuth();
  if (!rateLimiter.isAllowed(`updateMemory:${userId}`)) {
    console.warn('updateMemory: Rate limited');
    return null;
  }

  return withErrorHandling(async () => {
    console.log('Updating memory:', memory.id);
    
    const dbMemory = memoryToDbMemory(memory, userId);
    const { data, error } = await supabase
      .from('memories')
      .update(dbMemory)
      .eq('id', memory.id)
      .eq('access_code', memory.accessCode)
      .select()
      .single();

    if (error) {
      console.error('Supabase error in updateMemory:', error);
      throw error;
    }
    
    console.log('Memory updated successfully');
    return dbMemoryToMemory(data as DbMemory);
  }, 'Error updating memory');
};

export const deleteMemory = async (memoryId: string, accessCode: string): Promise<boolean> => {
  const userId = await requireAuth();
  if (!rateLimiter.isAllowed(`deleteMemory:${userId}`) || !validateAccessCodeFormat(accessCode)) {
    console.warn('deleteMemory: Invalid parameters or rate limited');
    return false;
  }

  return withErrorHandling(async () => {
    console.log('Deleting memory:', memoryId);
    
    const { error } = await supabase
      .from('memories')
      .delete()
      .eq('id', memoryId)
      .eq('access_code', accessCode);

    if (error) {
      console.error('Supabase error in deleteMemory:', error);
      throw error;
    }
    
    console.log('Memory deleted successfully');
    return true;
  }, 'Error deleting memory') || false;
};

// Like functionality
export const toggleMemoryLike = async (memoryId: string, accessCode: string): Promise<{ success: boolean; likes: number; isLiked: boolean } | null> => {
  const userId = await requireAuth();
  if (!rateLimiter.isAllowed(`toggleLike:${userId}`) || !validateAccessCodeFormat(accessCode)) {
    console.warn('toggleMemoryLike: Invalid parameters or rate limited');
    return null;
  }

  return withErrorHandling(async () => {
    console.log('Toggling like for memory:', memoryId);
    
    // First, get the current memory data
    const { data: currentMemory, error: fetchError } = await supabase
      .from('memories')
      .select('likes, is_liked')
      .eq('id', memoryId)
      .eq('access_code', accessCode)
      .order('id')
      .limit(1);

    if (fetchError) {
      console.error('Error fetching current memory for like toggle:', fetchError);
      throw fetchError;
    }

    // Check if memory was found
    if (!currentMemory || currentMemory.length === 0) {
      console.warn('Memory not found or not accessible:', memoryId);
      return null;
    }

    const memoryData = currentMemory[0];
    const currentLikes = memoryData.likes || 0;
    const currentIsLiked = memoryData.is_liked || false;
    
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
      .order('id')
      .limit(1);

    if (error) {
      console.error('Error updating memory likes:', error);
      throw error;
    }

    // Check if update was successful
    if (!data || data.length === 0) {
      console.warn('Memory update failed or not accessible:', memoryId);
      return null;
    }

    const updatedData = data[0];
    console.log('Like toggled successfully:', { likes: updatedData.likes, isLiked: updatedData.is_liked });
    
    return {
      success: true,
      likes: updatedData.likes || 0,
      isLiked: updatedData.is_liked || false
    };
  }, 'Error toggling memory like');
};

// Keep backward compatibility
export const deleteBoard = removeUserFromBoard;