
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export async function uploadMediaToStorage(file: File, userId: string): Promise<string | null> {
  try {
    // Skip bucket creation check since the bucket already exists
    // Just use the existing bucket with the proper permissions
    
    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/${uuidv4()}.${fileExt}`;

    // Upload the file directly to the existing bucket
    const { error: uploadError } = await supabase
      .storage
      .from('memories')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Upload error details:', uploadError);
      return null;
    }

    // Get the public URL of the uploaded file
    const { data: publicUrlData } = supabase
      .storage
      .from('memories')
      .getPublicUrl(filePath);

    return publicUrlData?.publicUrl ?? null;
  } catch (err) {
    console.error('Upload error:', err);
    return null;
  }
}
