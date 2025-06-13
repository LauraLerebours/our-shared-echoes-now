import { supabase } from '@/integrations/supabase/client';
import { Board, BoardOperationResponse } from '@/lib/types';
import { withErrorHandling, requireAuth } from './base';
import { sanitizeInput, validateAccessCodeFormat } from '@/lib/validation';

export const boardsApi = {
  async fetchBoards(userId: string) {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('boards')
        .select('*')
        .or(`owner_id.eq.${userId},member_ids.cs.{${userId}}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Board[];
    }, 'fetchBoards');
  },

  async getBoardById(boardId: string, userId: string) {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('boards')
        .select('*')
        .eq('id', boardId)
        .or(`owner_id.eq.${userId},member_ids.cs.{${userId}}`)
        .single();

      if (error) throw error;
      return data as Board;
    }, 'getBoardById');
  },

  async getBoardByShareCode(shareCode: string) {
    if (!validateAccessCodeFormat(shareCode)) {
      return { success: false, error: 'Invalid share code format' };
    }

    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('boards')
        .select('*')
        .eq('share_code', shareCode.toUpperCase())
        .maybeSingle();

      if (error) throw error;
      return data as Board;
    }, 'getBoardByShareCode');
  },

  async createBoard(name: string, userId: string) {
    const sanitizedName = sanitizeInput(name);
    if (!sanitizedName) {
      return { success: false, error: 'Invalid board name' };
    }

    return withErrorHandling(async () => {
      const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const shareCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Create access code first
      const { error: accessCodeError } = await supabase
        .from('access_codes')
        .insert([{ code: accessCode, name: sanitizedName }]);

      if (accessCodeError) throw accessCodeError;

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
    }, 'createBoard');
  },

  async renameBoard(boardId: string, newName: string, userId: string): Promise<BoardOperationResponse> {
    const sanitizedName = sanitizeInput(newName);
    if (!sanitizedName) {
      return { success: false, message: 'Invalid board name' };
    }

    const result = await withErrorHandling(async () => {
      const { data, error } = await supabase.rpc('rename_board', {
        board_id: boardId,
        new_name: sanitizedName,
        user_id: userId
      });

      if (error) throw error;
      return data as { success: boolean; message: string; new_name?: string };
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

    const result = await withErrorHandling(async () => {
      const { data, error } = await supabase.rpc('add_user_to_board_by_share_code', {
        share_code_param: shareCode.toUpperCase(),
        user_id_param: userId
      });

      if (error) throw error;
      return data as { success: boolean; message: string; board_id?: string };
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
    const result = await withErrorHandling(async () => {
      const { data: success, error } = await supabase.rpc('remove_board_member', {
        board_id: boardId,
        user_id: userId
      });

      if (error) throw error;
      return success;
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