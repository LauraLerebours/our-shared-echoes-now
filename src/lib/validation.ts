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
  
  // Updated to remove unsupported video/quicktime
  const allowedImageTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'
  ];
  
  const allowedVideoTypes = [
    'video/mp4', 'video/x-msvideo', 'video/x-ms-wmv',
    'video/avi', 'video/wmv'
  ];
  
  const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];
  
  if (file.size > maxSize) {
    return { isValid: false, error: 'File size must be less than 10MB' };
  }
  
  // Check MIME type first
  if (!allowedTypes.includes(file.type)) {
    // If MIME type check fails, check file extension as fallback
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

export const validateShareCode = (code: string): { isValid: boolean; error?: string } => {
  const trimmed = code.trim().toUpperCase();
  
  if (!/^[A-Z0-9]{6}$/.test(trimmed)) {
    return { isValid: false, error: 'Share code must be 6 characters long and contain only letters and numbers' };
  }
  
  return { isValid: true };
};