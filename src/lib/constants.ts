// Application constants
export const APP_CONFIG = {
  NAME: 'Amity',
  DESCRIPTION: 'Shared Memory App',
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  SUPPORTED_VIDEO_TYPES: ['video/mp4', 'video/x-msvideo', 'video/x-ms-wmv', 'video/avi', 'video/wmv'],
  ACCESS_CODE_LENGTH: 6,
  MAX_CAPTION_LENGTH: 1000,
  MAX_BOARD_NAME_LENGTH: 100,
} as const;

export const ROUTES = {
  HOME: '/',
  AUTH: '/auth',
  BOARDS: '/boards',
  BOARD_VIEW: '/board/:boardId',
  ADD_MEMORY: '/add',
  MEMORY_DETAIL: '/memory/:id',
  SHARE: '/share',
  SHARED_MEMORIES: '/shared/:code',
} as const;

export const STORAGE_KEYS = {
  THEME: 'theme',
  USER_PREFERENCES: 'user-preferences',
} as const;

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your internet connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  UPLOAD_ERROR: 'Failed to upload file. Please try again.',
  GENERIC_ERROR: 'Something went wrong. Please try again.',
} as const;