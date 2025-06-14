import { supabase } from '@/integrations/supabase/client';

export async function uploadMediaToStorage(file: File, userId: string): Promise<string> {
  try {
    // Check if the file type is supported by the current bucket configuration
    const supportedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo'
    ];

    if (!supportedTypes.includes(file.type)) {
      throw new Error(`File type ${file.type} is not supported. Supported types: ${supportedTypes.join(', ')}`);
    }

    // Generate a unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    console.log('Uploading file:', {
      name: file.name,
      type: file.type,
      size: file.size,
      path: filePath
    });

    // Create custom headers for this specific upload
    const uploadOptions = {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type // Explicitly set the content type
    };

    // Upload the file to Supabase Storage
    const { data, error } = await supabase.storage
      .from('memories')
      .upload(filePath, file, uploadOptions);

    if (error) {
      console.error('Supabase storage error:', error);
      
      // Handle specific error cases
      if (error.message?.includes('mime type') && error.message?.includes('not supported')) {
        throw new Error(`File type ${file.type} is not allowed by the storage configuration. Please contact the administrator to enable this file type.`);
      }
      
      if (error.message?.includes('Duplicate')) {
        throw new Error('A file with this name already exists. Please try again.');
      }
      
      if (error.message?.includes('File size')) {
        throw new Error('File is too large. Please choose a smaller file.');
      }
      
      throw new Error(`Upload failed: ${error.message}`);
    }

    if (!data?.path) {
      throw new Error('Upload completed but no file path was returned');
    }

    // Get the public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from('memories')
      .getPublicUrl(data.path);

    if (!urlData?.publicUrl) {
      throw new Error('Upload completed but could not generate public URL');
    }

    console.log('Upload successful:', {
      path: data.path,
      url: urlData.publicUrl
    });

    return urlData.publicUrl;

  } catch (error) {
    console.error('Upload error details:', error);
    
    // Re-throw with more context if it's already our custom error
    if (error instanceof Error) {
      throw error;
    }
    
    // Handle unexpected errors
    throw new Error(`Upload failed: ${String(error)}`);
  }
}