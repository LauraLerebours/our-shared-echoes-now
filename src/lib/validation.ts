// Input validation utilities
export const validateBoardName = (name: string): { isValid: boolean; error?: string } => {
  const trimmed = name.trim();
  
  if (!trimmed) {
    return { isValid: false, error: 'Board name cannot be empty' };
  }
  
  if (trimmed.length > 100) {
    return { isValid: false, error: 'Board name must be less than 100 characters' };
  }
  
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmed)) {
    return { isValid: false, error: 'Board name can only contain letters, numbers, spaces, hyphens, and underscores' };
  }
  
  return { isValid: true };
};

export const validateMemoryCaption = (caption: string): { isValid: boolean; error?: string } => {
  if (caption.length > 1000) {
    return { isValid: false, error: 'Caption must be less than 1000 characters' };
  }
  
  return { isValid: true };
};

export const validateFileUpload = (file: File): { isValid: boolean; error?: string } => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/mov', 'video/avi', 'video/wmv'
  ];
  
  if (file.size > maxSize) {
    return { isValid: false, error: 'File size must be less than 10MB' };
  }
  
  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: 'File type not supported. Please use images or videos.' };
  }
  
  return { isValid: true };
};

export const validateShareCode = (code: string): { isValid: boolean; error?: string } => {
  const trimmed = code.trim().toUpperCase();
  
  if (!/^[A-Z0-9]{6}$/.test(trimmed)) {
    return { isValid: false, error: 'Share code must be 6 characters long and contain only letters and numbers' };
  }
  
  return { isValid: true };
};