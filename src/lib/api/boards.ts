import { supabase } from '@/integrations/supabase/client';
import { Board, BoardOperationResponse } from '@/lib/types';
import { withErrorHandling, requireAuth, withRetry } from './base';
import { sanitizeInput, validateAccessCodeFormat } from '@/lib/validation';

export const boardsApi = {
  async fetchBoards(userId: string, signal?: AbortSignal) {
    return withErrorHandling(async () => {
      console.log('🔄 [boardsApi.fetchBoards] Starting for user:', userId);
      
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Use retry wrapper for network resilience
      const result = await withRetry(async () => {
        // Check if the request has been aborted
        if (signal?.aborted) {
          throw new Error('Request aborted');
        }
        
        // Direct query approach
        const { data, error } = await supabase
          .from('boards')
          .select(`
            id,
            name,
            owner_id,
            member_ids,
            access_code,
            share_code,
            created_at,
            updated_at,
            is_public
          `)
          .or(`owner_id.eq.${userId},member_ids.cs.{${userId}}`)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('❌ [boardsApi.fetchBoards] Database error:', error);
          
          // Handle specific error types
          if (error.message?.includes('404') || error.code === 'PGRST116') {
            throw new Error('Boards table not found. Please check your database setup.');
          }
          
          if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
            throw new Error('Database tables are missing. Please run database migrations.');
          }
          
          if (error.message?.includes('permission denied')) {
            throw new Error('Database permission denied. Please check your authentication.');
          }
          
          throw new Error(`Failed to fetch boards: ${error.message}`);
        }

        return data || [];
      }, 3, 1000, signal);
      
      console.log('✅ [boardsApi.fetchBoards] Success:', result.length, 'boards');
      return result as Board[];
    }, 'fetchBoards');
  },

  async getBoardById(boardId: string, userId: string) {
    return withErrorHandling(async () => {
      console.log('🔄 [boardsApi.getBoardById] Starting:', { boardId, userId });
      
      if (!boardId || !userId) {
        throw new Error('Board ID and User ID are required');
      }

      const result = await withRetry(async () => {
        const { data, error } = await supabase
          .from('boards')
          .select('*')
          .eq('id', boardId)
          .or(`owner_id.eq.${userId},member_ids.cs.{${userId}}`)
          .single();

        if (error) {
          console.error('❌ [boardsApi.getBoardById] Error:', error);
          
          if (error.code === 'PGRST116') {
            throw new Error('Board not found');
          }
          
          if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
            throw new Error('Database tables are missing. Please run database migrations.');
          }
          
          throw new Error(`Failed to fetch board: ${error.message}`);
        }

        return data;
      }, 3, 1000);

      if (!result) {
        throw new Error('Board not found or access denied');
      }

      console.log('✅ [boardsApi.getBoardById] Success:', result.name);
      return result as Board;
    }, 'getBoardById');
  },

  async getBoardByShareCode(shareCode: string) {
    if (!validateAccessCodeFormat(shareCode)) {
      return { success: false, error: 'Invalid share code format' };
    }

    return withErrorHandling(async () => {
      console.log('🔄 [boardsApi.getBoardByShareCode] Starting:', shareCode);
      
      const result = await withRetry(async () => {
        // Use the database function for consistency
        const { data, error } = await supabase.rpc('get_board_by_share_code', {
          share_code_param: shareCode.toUpperCase()
        });

        if (error) {
          console.error('❌ [boardsApi.getBoardByShareCode] Error:', error);
          throw new Error(`Failed to fetch board: ${error.message}`);
        }

        // Parse the JSON response from the function
        if (!data || !data.success) {
          console.log('❌ [boardsApi.getBoardByShareCode] Board not found');
          return null;
        }

        return data.data;
      }, 3, 1000);

      if (!result) {
        console.log('❌ [boardsApi.getBoardByShareCode] No board found');
        return null;
      }

      console.log('✅ [boardsApi.getBoardByShareCode] Success:', result.name);
      return result as Board;
    }, 'getBoardByShareCode');
  },

  async createBoard(name: string, isPublic: boolean = false, userId: string) {
    const sanitizedName = sanitizeInput(name);
    if (!sanitizedName) {
      return { success: false, error: 'Invalid board name' };
    }

    return withErrorHandling(async () => {
      console.log('🔄 [boardsApi.createBoard] Starting:', { name: sanitizedName, userId, isPublic });
      
      if (!userId) {
        throw new Error('User ID is required');
      }

      const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const shareCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      console.log('🔄 [boardsApi.createBoard] Generated codes:', { accessCode, shareCode });

      const result = await withRetry(async () => {
        // Create access code first
        const { error: accessCodeError } = await supabase
          .from('access_codes')
          .insert([{ code: accessCode, name: sanitizedName }]);

        if (accessCodeError) {
          console.error('❌ [boardsApi.createBoard] Access code error:', accessCodeError);
          
          if (accessCodeError.message?.includes('relation') && accessCodeError.message?.includes('does not exist')) {
            throw new Error('Database tables are missing. Please run database migrations.');
          }
          
          throw new Error(`Failed to create access code: ${accessCodeError.message}`);
        }

        console.log('✅ [boardsApi.createBoard] Access code created');

        // Insert the board with is_public flag
        const { data: boardData, error: boardError } = await supabase
          .from('boards')
          .insert([{
            name: sanitizedName,
            owner_id: userId,
            access_code: accessCode,
            share_code: shareCode,
            member_ids: [userId],
            is_public: isPublic
          }])
          .select()
          .single();

        if (boardError) {
          console.error('❌ [boardsApi.createBoard] Board creation error:', boardError);
          
          if (boardError.message?.includes('relation') && boardError.message?.includes('does not exist')) {
            throw new Error('Database tables are missing. Please run database migrations.');
          }
          
          throw new Error(`Failed to create board: ${boardError.message}`);
        }

        if (!boardData) {
          throw new Error('Board creation returned no data');
        }

        console.log('✅ [boardsApi.createBoard] Board created with ID:', boardData.id);
        return boardData;
      }, 3, 1000);

      console.log('✅ [boardsApi.createBoard] Success:', result.name);
      return result as Board;
    }, 'createBoard');
  },

  async renameBoard(boardId: string, newName: string, userId: string): Promise<BoardOperationResponse> {
    const sanitizedName = sanitizeInput(newName);
    if (!sanitizedName) {
      return { success: false, message: 'Invalid board name' };
    }

    console.log('🔄 [boardsApi.renameBoard] Starting:', { boardId, newName: sanitizedName });

    const result = await withErrorHandling(async () => {
      return await withRetry(async () => {
        const { data, error } = await supabase.rpc('rename_board', {
          board_id: boardId,
          new_name: sanitizedName,
          user_id: userId
        });

        if (error) {
          console.error('❌ [boardsApi.renameBoard] Error:', error);
          
          if (error.message?.includes('function') && error.message?.includes('does not exist')) {
            throw new Error('Database function not available. Please check your database setup.');
          }
          
          if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
            throw new Error('Database tables are missing. Please run database migrations.');
          }
          
          throw new Error(`Failed to rename board: ${error.message}`);
        }

        console.log('✅ [boardsApi.renameBoard] Success');
        return data as { success: boolean; message: string; new_name?: string };
      }, 3, 1000);
    }, 'renameBoard');

    if (!result.success) {
      return { success: false, message: result.error || 'Failed to rename board' };
    }

    return {
      success: result.data!.success,
      message: result.data!.message,
      newName: result.data!.new_name
    };
  },

  async addUserToBoard(shareCode: string, userId: string): Promise<BoardOperationResponse> {
    if (!validateAccessCodeFormat(shareCode)) {
      return { success: false, message: 'Invalid share code format' };
    }

    console.log('🔄 [boardsApi.addUserToBoard] Starting:', { shareCode, userId });

    const result = await withErrorHandling(async () => {
      return await withRetry(async () => {
        // Use the safe database function
        const { data, error } = await supabase.rpc('add_user_to_board_safe', {
          share_code_param: shareCode.toUpperCase(),
          user_id_param: userId
        });

        if (error) {
          console.error('❌ [boardsApi.addUserToBoard] Error:', error);
          throw new Error(`Failed to join board: ${error.message}`);
        }

        console.log('✅ [boardsApi.addUserToBoard] Function result:', data);
        return data;
      }, 3, 1000);
    }, 'addUserToBoard');

    if (!result.success) {
      return { success: false, message: result.error || 'Failed to join board' };
    }

    // Parse the result from the database function
    const functionResult = result.data;
    
    if (!functionResult.success) {
      return { 
        success: false, 
        message: functionResult.message || 'Failed to join board' 
      };
    }

    // If successful, get the board data
    let board: Board | undefined;
    if (functionResult.board_id) {
      try {
        const boardResult = await this.getBoardById(functionResult.board_id, userId);
        if (boardResult.success && boardResult.data) {
          board = boardResult.data;
        }
      } catch (error) {
        console.warn('Could not fetch board details after joining:', error);
      }
    }

    return {
      success: true,
      message: functionResult.message,
      board: board
    };
  },

  async removeUserFromBoard(boardId: string, userId: string): Promise<BoardOperationResponse> {
    console.log('🔄 [boardsApi.removeUserFromBoard] Starting:', { boardId, userId });

    const result = await withErrorHandling(async () => {
      return await withRetry(async () => {
        const { data, error } = await supabase.rpc('remove_board_member', {
          board_id: boardId,
          user_id: userId
        });

        if (error) {
          console.error('❌ [boardsApi.removeUserFromBoard] Error:', error);
          
          if (error.message?.includes('function') && error.message?.includes('does not exist')) {
            throw new Error('Database function not available. Please check your database setup.');
          }
          
          if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
            throw new Error('Database tables are missing. Please run database migrations.');
          }
          
          throw new Error(`Failed to remove user: ${error.message}`);
        }

        console.log('✅ [boardsApi.removeUserFromBoard] Success:', data);
        return data;
      }, 3, 1000);
    }, 'removeUserFromBoard');

    if (!result.success) {
      return { success: false, message: result.error || 'Failed to remove user from board' };
    }

    // Check if the result is a JSON object with success property
    if (typeof result.data === 'object' && result.data !== null && 'success' in result.data) {
      return {
        success: result.data.success,
        message: result.data.message || 'Successfully processed board membership'
      };
    }

    // For backward compatibility with boolean return type
    return {
      success: !!result.data,
      message: result.data ? 'Successfully removed from board' : 'You are not a member of this board'
    };
  }
};