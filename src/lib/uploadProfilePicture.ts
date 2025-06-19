import { supabase } from '@/integrations/supabase/client';

export async function uploadProfilePicture(file: File, userId: string): Promise<string> {
  try {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error(`File type ${file.type} is not supported. Please use JPG, PNG, or WebP.`);
    }

    // Validate file size (max 5MB for profile pictures)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('Profile picture must be smaller than 5MB');
    }

    // Generate a unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    console.log('Uploading profile picture:', {
      name: file.name,
      type: file.type,
      size: file.size,
      path: filePath
    });

    // Delete existing profile picture if it exists
    try {
      const { data: existingFiles } = await supabase.storage
        .from('profile-pictures')
        .list(userId);

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map(file => `${userId}/${file.name}`);
        await supabase.storage
          .from('profile-pictures')
          .remove(filesToDelete);
        console.log('Deleted existing profile pictures');
      }
    } catch (error) {
      console.warn('Could not delete existing profile pictures:', error);
      // Continue with upload even if deletion fails
    }

    // Upload the new profile picture
    const { data, error } = await supabase.storage
      .from('profile-pictures')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type
      });

    if (error) {
      console.error('Supabase storage error:', error);
      
      if (error.message?.includes('mime type') && error.message?.includes('not supported')) {
        throw new Error(`File type ${file.type} is not allowed. Please use JPG, PNG, or WebP.`);
      }
      
      if (error.message?.includes('File size')) {
        throw new Error('Profile picture is too large. Please choose a smaller file.');
      }
      
      throw new Error(`Upload failed: ${error.message}`);
    }

    if (!data?.path) {
      throw new Error('Upload completed but no file path was returned');
    }

    // Get the public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl(data.path);

    if (!urlData?.publicUrl) {
      throw new Error('Upload completed but could not generate public URL');
    }

    console.log('Profile picture upload successful:', {
      path: data.path,
      url: urlData.publicUrl
    });

    return urlData.publicUrl;

  } catch (error) {
    console.error('Profile picture upload error:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error(`Upload failed: ${String(error)}`);
  }
}

export async function deleteProfilePicture(userId: string): Promise<void> {
  try {
    // List all files in the user's folder
    const { data: files, error: listError } = await supabase.storage
      .from('profile-pictures')
      .list(userId);

    if (listError) {
      console.error('Error listing profile pictures:', listError);
      return;
    }

    if (!files || files.length === 0) {
      console.log('No profile pictures to delete');
      return;
    }

    // Delete all files in the user's folder
    const filesToDelete = files.map(file => `${userId}/${file.name}`);
    const { error: deleteError } = await supabase.storage
      .from('profile-pictures')
      .remove(filesToDelete);

    if (deleteError) {
      console.error('Error deleting profile pictures:', deleteError);
      throw new Error(`Failed to delete profile picture: ${deleteError.message}`);
    }

    console.log('Profile pictures deleted successfully');
  } catch (error) {
    console.error('Delete profile picture error:', error);
    throw error;
  }
}