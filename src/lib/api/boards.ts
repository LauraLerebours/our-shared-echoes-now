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
        
        // Test database connection first
        console.log('🔄 [boardsApi.fetchBoards] Testing database connection');
        const { error: connectionError } = await supabase
          .from('user_profiles')
          .select('id')
          .limit(1)
          .maybeSingle();

        if (connectionError) {
          console.error('❌ [boardsApi.fetchBoards] Connection test failed:', connectionError);
          throw new Error(`Database connection failed: ${connectionError.message}`);
        }

        // Check if the request has been aborted after connection test
        if (signal?.aborted) {
          throw new Error('Request aborted');
        }

        // Now fetch boards with comprehensive error handling
        console.log('🔄 [boardsApi.fetchBoards] Fetching boards from database');
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
            updated_at
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

        console.log('✅ [boardsApi.fetchBoards] Received data from database:', data?.length || 0, 'boards');
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
        console.log('🔄 [boardsApi.getBoardById] Fetching board from database');
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

        console.log('✅ [boardsApi.getBoardById] Board found');
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
        console.log('🔄 [boardsApi.getBoardByShareCode] Fetching board from database');
        const { data, error } = await supabase
          .from('boards')
          .select('*')
          .eq('share_code', shareCode.toUpperCase())
          .maybeSingle();

        if (error) {
          console.error('❌ [boardsApi.getBoardByShareCode] Error:', error);
          
          if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
            throw new Error('Database tables are missing. Please run database migrations.');
          }
          
          throw new Error(`Failed to fetch board: ${error.message}`);
        }

        console.log('✅ [boardsApi.getBoardByShareCode] Query completed');
        return data;
      }, 3, 1000);

      if (!result) {
        console.log('❌ [boardsApi.getBoardByShareCode] No board found');
        return null;
      }

      console.log('✅ [boardsApi.getBoardByShareCode] Success:', result.name);
      return result as Board;
    }, 'getBoardByShareCode');
  },

  async createBoard(name: string, userId: string) {
    const sanitizedName = sanitizeInput(name);
    if (!sanitizedName) {
      return { success: false, error: 'Invalid board name' };
    }

    return withErrorHandling(async () => {
      console.log('🔄 [boardsApi.createBoard] Starting:', { name: sanitizedName, userId });
      
      if (!userId) {
        throw new Error('User ID is required');
      }

      const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const shareCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      console.log('🔄 [boardsApi.createBoard] Generated codes:', { accessCode, shareCode });

      const result = await withRetry(async () => {
        // Create access code first
        console.log('🔄 [boardsApi.createBoard] Creating access code');
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

        // Use the safe function to create board
        console.log('🔄 [boardsApi.createBoard] Creating board');
        const { data: boardId, error } = await supabase.rpc('create_board_with_owner', {
          board_name: sanitizedName,
          owner_user_id: userId,
          access_code_param: accessCode,
          share_code_param: shareCode
        });

        if (error) {
          console.error('❌ [boardsApi.createBoard] Board creation error:', error);
          
          // Handle function not found error
          if (error.message?.includes('function') && error.message?.includes('does not exist')) {
            throw new Error('Database function not available. Please check your database setup.');
          }
          
          if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
            throw new Error('Database tables are missing. Please run database migrations.');
          }
          
          throw new Error(`Failed to create board: ${error.message}`);
        }

        if (!boardId) {
          throw new Error('Board creation function returned no ID');
        }

        console.log('✅ [boardsApi.createBoard] Board created with ID:', boardId);

        // Fetch the created board
        console.log('🔄 [boardsApi.createBoard] Fetching created board');
        const { data: boardData, error: fetchError } = await supabase
          .from('boards')
          .select('*')
          .eq('id', boardId)
          .single();

        if (fetchError) {
          console.error('❌ [boardsApi.createBoard] Fetch error:', fetchError);
          throw new Error(`Failed to fetch created board: ${fetchError.message}`);
        }

        if (!boardData) {
          throw new Error('Created board not found');
        }

        console.log('✅ [boardsApi.createBoard] Board fetched successfully');
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
        console.log('🔄 [boardsApi.renameBoard] Calling rename_board function');
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
        console.log('🔄 [boardsApi.addUserToBoard] Calling add_user_to_board_by_share_code function');
        const { data, error } = await supabase.rpc('add_user_to_board_by_share_code', {
          share_code_param: shareCode.toUpperCase(),
          user_id_param: userId
        });

        if (error) {
          console.error('❌ [boardsApi.addUserToBoard] Error:', error);
          
          if (error.message?.includes('function') && error.message?.includes('does not exist')) {
            throw new Error('Database function not available. Please check your database setup.');
          }
          
          if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
            throw new Error('Database tables are missing. Please run database migrations.');
          }
          
          throw new Error(`Failed to join board: ${error.message}`);
        }

        console.log('✅ [boardsApi.addUserToBoard] Success');
        return data as { success: boolean; message: string; board_id?: string };
      }, 3, 1000);
    }, 'addUserToBoard');

    if (!result.success) {
      return { success: false, message: result.error || 'Failed to join board' };
    }

    const response: BoardOperationResponse = {
      success: result.data!.success,
      message: result.data!.message
    };

    if (result.data!.success && result.data!.board_id) {
      const boardResult = await this.getBoardByShareCode(shareCode);
      if (boardResult.success && boardResult.data) {
        response.board = boardResult.data;
      }
    }

    return response;
  },

  async removeUserFromBoard(boardId: string, userId: string): Promise<BoardOperationResponse> {
    console.log('🔄 [boardsApi.removeUserFromBoard] Starting:', { boardId, userId });

    const result = await withErrorHandling(async () => {
      return await withRetry(async () => {
        console.log('🔄 [boardsApi.removeUserFromBoard] Calling remove_board_member function');
        const { data: success, error } = await supabase.rpc('remove_board_member', {
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

        console.log('✅ [boardsApi.removeUserFromBoard] Success');
        return success;
      }, 3, 1000);
    }, 'removeUserFromBoard');

    if (!result.success) {
      return { success: false, message: result.error || 'Failed to remove user from board' };
    }

    return {
      success: !!result.data,
      message: result.data ? 'Successfully removed from board' : 'You are not a member of this board'
    };
  }
};