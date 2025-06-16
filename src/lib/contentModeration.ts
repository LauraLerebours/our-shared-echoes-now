import { supabase } from '@/integrations/supabase/client';

interface ContentModerationResult {
  success: boolean;
  isAppropriate: boolean;
  moderationResults?: any;
  error?: string;
}

/**
 * Checks if media content is appropriate using the content moderation edge function
 * @param mediaUrl URL of the image or video to check
 * @param isVideo Boolean indicating if the content is a video
 * @returns Promise with moderation result
 */
export async function checkContentAppropriate(
  mediaUrl: string,
  isVideo: boolean
): Promise<ContentModerationResult> {
  try {
    console.log('🔄 Checking content appropriateness:', { mediaUrl, isVideo });
    
    // Get the Supabase URL from environment variables
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hhcoeuedfeoudgxtttgn.supabase.co';
    
    // Call the content-moderation edge function
    const { data, error } = await supabase.functions.invoke('content-moderation', {
      body: { mediaUrl, isVideo }
    });
    
    if (error) {
      console.error('❌ Content moderation function error:', error);
      return {
        success: false,
        isAppropriate: false, // Fail closed for safety
        error: `Error calling content moderation function: ${error.message}`
      };
    }
    
    console.log('✅ Content moderation result:', data);
    
    return {
      success: true,
      isAppropriate: data.isAppropriate,
      moderationResults: data.moderationResults,
      error: data.error
    };
  } catch (error) {
    console.error('❌ Content moderation error:', error);
    return {
      success: false,
      isAppropriate: false, // Fail closed for safety
      error: `Content moderation failed: ${error.message}`
    };
  }
}

/**
 * Fallback content moderation that checks file type and size
 * Used when the edge function is unavailable
 * @param file File to check
 * @returns Promise with moderation result
 */
export function performBasicContentCheck(file: File): ContentModerationResult {
  try {
    // Check file size (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      return {
        success: true,
        isAppropriate: false,
        error: 'File size exceeds the maximum allowed (10MB)'
      };
    }
    
    // Check file type
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
    
    const isAllowedType = [...allowedImageTypes, ...allowedVideoTypes].includes(file.type);
    
    if (!isAllowedType) {
      return {
        success: true,
        isAppropriate: false,
        error: 'File type not allowed. Please upload JPEG, PNG, WebP images or MP4, MOV, AVI videos.'
      };
    }
    
    // Basic check passed
    return {
      success: true,
      isAppropriate: true
    };
  } catch (error) {
    console.error('❌ Basic content check error:', error);
    return {
      success: false,
      isAppropriate: false,
      error: `Basic content check failed: ${error.message}`
    };
  }
}