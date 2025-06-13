import { APP_CONFIG } from './constants';

// Enhanced validation utilities
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const validateBoardName = (name: string): ValidationResult => {
  const trimmed = name.trim();
  
  if (!trimmed) {
    return { isValid: false, error: 'Board name cannot be empty' };
  }
  
  if (trimmed.length > APP_CONFIG.MAX_BOARD_NAME_LENGTH) {
    return { isValid: false, error: `Board name must be less than ${APP_CONFIG.MAX_BOARD_NAME_LENGTH} characters` };
  }
  
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmed)) {
    return { isValid: false, error: 'Board name can only contain letters, numbers, spaces, hyphens, and underscores' };
  }
  
  return { isValid: true };
};

export const validateMemoryCaption = (caption: string): ValidationResult => {
  if (caption.length > APP_CONFIG.MAX_CAPTION_LENGTH) {
    return { isValid: false, error: `Caption must be less than ${APP_CONFIG.MAX_CAPTION_LENGTH} characters` };
  }
  
  return { isValid: true };
};

export const validateFileUpload = (file: File): ValidationResult => {
  if (file.size > APP_CONFIG.MAX_FILE_SIZE) {
    return { isValid: false, error: 'File size must be less than 10MB' };
  }
  
  const allowedTypes = [...APP_CONFIG.SUPPORTED_IMAGE_TYPES, ...APP_CONFIG.SUPPORTED_VIDEO_TYPES];
  
  if (!allowedTypes.includes(file.type)) {
    // Check file extension as fallback
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'avi', 'wmv'];
    
    if (!fileExt || !allowedExtensions.includes(fileExt)) {
      return { 
        isValid: false, 
        error: `File type not supported. Please use images (JPG, PNG, GIF, WebP) or videos (MP4, AVI, WMV). Detected: ${file.type}` 
      };
    }
  }
  
  return { isValid: true };
};

export const validateShareCode = (code: string): ValidationResult => {
  const trimmed = code.trim().toUpperCase();
  
  if (!/^[A-Z0-9]{6}$/.test(trimmed)) {
    return { isValid: false, error: 'Share code must be 6 characters long and contain only letters and numbers' };
  }
  
  return { isValid: true };
};

export const validateAccessCodeFormat = (code: string): boolean => {
  const accessCodeRegex = /^[A-Z0-9]{6}$/;
  return accessCodeRegex.test(code);
};

export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 1000); // Limit length
};

export const validateEmail = (email: string): ValidationResult => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!email.trim()) {
    return { isValid: false, error: 'Email is required' };
  }
  
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }
  
  return { isValid: true };
};

export const validatePassword = (password: string): ValidationResult => {
  if (password.length < 6) {
    return { isValid: false, error: 'Password must be at least 6 characters long' };
  }
  
  return { isValid: true };
};

export const validateName = (name: string): ValidationResult => {
  const trimmed = name.trim();
  
  if (!trimmed) {
    return { isValid: false, error: 'Name is required' };
  }
  
  if (trimmed.length < 2) {
    return { isValid: false, error: 'Name must be at least 2 characters long' };
  }
  
  if (trimmed.length > 50) {
    return { isValid: false, error: 'Name must be less than 50 characters' };
  }
  
  return { isValid: true };
};