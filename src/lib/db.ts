// Simplified db.ts - now acts as a facade over the new API modules
import { boardsApi } from './api/boards';
import { memoriesApi } from './api/memories';

// Re-export types for backward compatibility
export type { Memory, Board, UserProfile, Comment } from './types';

// Re-export API functions for backward compatibility
export const fetchBoards = boardsApi.fetchBoards;
export const getBoardById = boardsApi.getBoardById;
export const getBoardByShareCode = boardsApi.getBoardByShareCode;
export const createBoard = boardsApi.createBoard;
export const renameBoard = boardsApi.renameBoard;
export const addUserToBoard = boardsApi.addUserToBoard;
export const removeUserFromBoard = boardsApi.removeUserFromBoard;

export const fetchMemories = memoriesApi.fetchMemories;
export const getMemory = memoriesApi.getMemory;
export const createMemory = memoriesApi.createMemory;
export const updateMemory = memoriesApi.updateMemory;
export const deleteMemory = memoriesApi.deleteMemory;
export const toggleMemoryLike = memoriesApi.toggleMemoryLike;

// Keep backward compatibility
export const deleteBoard = removeUserFromBoard;