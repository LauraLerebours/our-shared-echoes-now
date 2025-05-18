
import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { ensureMemoriesBucketExists } from '@/lib/supabase';

export async function uploadMediaToStorage(file: File, userId: string): Promise<string | null> {
  try {
    // First, ensure the bucket exists
    const bucketExists = await ensureMemoriesBucketExists();
    
    if (!bucketExists) {
      console.error('Upload error: Memories bucket does not exist and could not be created');
      return null;
    }
    
    const fileExt = file.name.split('.').pop();
    const filePath = `${userId}/${uuidv4()}.${fileExt}`;

    const { error: uploadError } = await supabase
      .storage
      .from('memories')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Upload error:', uploadError.message);
      return null;
    }

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
