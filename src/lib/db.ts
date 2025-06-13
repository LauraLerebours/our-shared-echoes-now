// Simplified db.ts - now acts as a facade over the new API modules
import { boardsApi } from './api/boards';
import { memoriesApi } from './api/memories';

// Re-export types for backward compatibility
export type { Memory, Board, UserProfile, Comment } from './types';

// Re-export API functions for backward compatibility
export const fetchBoards = async (userId: string) => {
  const result = await boardsApi.fetchBoards(userId);
  return result.success ? result.data || [] : [];
};

export const getBoardById = async (boardId: string, userId: string) => {
  const result = await boardsApi.getBoardById(boardId, userId);
  return result.success ? result.data : null;
};

export const getBoardByShareCode = async (shareCode: string) => {
  const result = await boardsApi.getBoardByShareCode(shareCode);
  return result.success ? result.data : null;
};

export const createBoard = async (name: string, userId: string) => {
  const result = await boardsApi.createBoard(name, userId);
  return result.success ? result.data : null;
};

export const renameBoard = boardsApi.renameBoard;
export const addUserToBoard = boardsApi.addUserToBoard;
export const removeUserFromBoard = boardsApi.removeUserFromBoard;

export const fetchMemories = async (accessCode: string) => {
  const result = await memoriesApi.fetchMemories(accessCode);
  return result.success ? result.data || [] : [];
};

export const getMemory = async (id: string) => {
  const result = await memoriesApi.getMemory(id);
  return result.success ? result.data : null;
};

export const createMemory = async (memory: any) => {
  const result = await memoriesApi.createMemory(memory);
  return result.success ? result.data : null;
};

export const updateMemory = async (id: string, updates: any) => {
  const result = await memoriesApi.updateMemory(id, updates);
  return result.success ? result.data : null;
};

export const deleteMemory = async (id: string, accessCode: string) => {
  const result = await memoriesApi.deleteMemory(id, accessCode);
  return result.success;
};

export const toggleMemoryLike = async (id: string) => {
  const result = await memoriesApi.toggleMemoryLike(id);
  return result.success ? { likes: result.data?.likes || 0, isLiked: result.data?.isLiked || false } : null;
};

// Keep backward compatibility
export const deleteBoard = removeUserFromBoard;
