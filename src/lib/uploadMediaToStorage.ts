import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, sanitizeInput, rateLimiter } from './supabase-security';

export async function uploadMediaToStorage(file: File, userId: string): Promise<string | null> {
  try {
    // Validate user authentication
    await requireAuth();

    // Rate limiting
    if (!rateLimiter.isAllowed(`uploadMedia:${userId}`)) {
      throw new Error('Too many upload requests. Please try again later.');
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error('File size exceeds 10MB limit');
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/mov', 'video/avi', 'video/wmv'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      throw new Error('File type not supported');
    }

    // Sanitize file name
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt) {
      throw new Error('Invalid file extension');
    }

    // Generate secure file path
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    // Upload the file to the storage bucket
    const { error: uploadError } = await supabase
      .storage
      .from('memories')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error details:', uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get the public URL of the uploaded file
    const { data: publicUrlData } = supabase
      .storage
      .from('memories')
      .getPublicUrl(filePath);

    if (!publicUrlData?.publicUrl) {
      throw new Error('Failed to get public URL for uploaded file');
    }

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Upload error:', error);
    return null;
  }
}

// Function to delete media from storage (for cleanup)
export async function deleteMediaFromStorage(filePath: string, userId: string): Promise<boolean> {
  try {
    // Validate user authentication
    await requireAuth();

    // Ensure the file path belongs to the user
    if (!filePath.startsWith(`${userId}/`)) {
      throw new Error('Access denied: Cannot delete files that do not belong to you');
    }

    const { error } = await supabase
      .storage
      .from('memories')
      .remove([filePath]);

    if (error) {
      console.error('Delete error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Delete media error:', error);
    return false;
  }
}