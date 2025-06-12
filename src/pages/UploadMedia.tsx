import React, { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { uploadMediaToStorage } from '@/lib/uploadMediaToStorage';
import { extractPhotoMetadata, PhotoMetadata } from '@/lib/extractMetadata';
import { validateFileUpload } from '@/lib/validation';

interface UploadMediaProps {
  userId: string;
  mediaType: 'image' | 'video';
  onUploadSuccess: (publicUrl: string, metadata?: PhotoMetadata) => void;
  disabled?: boolean;
}

const UploadMedia: React.FC<UploadMediaProps> = ({ userId, mediaType, onUploadSuccess, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file before upload
    const validation = validateFileUpload(file);
    if (!validation.isValid) {
      toast({
        title: "Invalid file",
        description: validation.error,
        variant: "destructive"
      });
      return;
    }

    // Additional check for media type matching
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/') || 
                   ['mp4', 'mov', 'avi', 'wmv'].includes(file.name.split('.').pop()?.toLowerCase() || '');

    if (mediaType === 'image' && !isImage) {
      toast({
        title: "Wrong file type",
        description: "Please select an image file for photo upload",
        variant: "destructive"
      });
      return;
    }

    if (mediaType === 'video' && !isVideo) {
      toast({
        title: "Wrong file type",
        description: "Please select a video file for video upload",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    
    try {
      // Extract metadata from image files
      let metadata: PhotoMetadata | undefined;
      if (mediaType === 'image' && file.type.startsWith('image/')) {
        try {
          metadata = await extractPhotoMetadata(file);
        } catch (error) {
          console.warn('Failed to extract metadata:', error);
          // Continue with upload even if metadata extraction fails
        }
      }

      // Upload directly to the storage bucket
      const publicUrl = await uploadMediaToStorage(file, userId);

      if (publicUrl) {
        onUploadSuccess(publicUrl, metadata);
        toast({
          title: "Upload successful",
          description: `Your ${mediaType} has been uploaded successfully.`,
        });
      } else {
        toast({
          title: "Upload failed",
          description: "Could not upload file to storage. Please check if you're logged in and try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "An error occurred during upload. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        disabled={disabled || isUploading}
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center px-4 py-2 border rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isUploading ? (
          <span className="flex items-center">
            <span className="animate-spin mr-2">⏳</span>
            Uploading...
          </span>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            Select {mediaType === 'video' ? 'Video' : 'Photo'}
          </>
        )}
      </button>
      <Input
        ref={fileInputRef}
        type="file"
        accept={mediaType === 'video' ? 'video/*,.mp4,.mov,.avi,.wmv' : 'image/*'}
        className="absolute inset-0 opacity-0 pointer-events-none"
        onChange={handleFileChange}
        disabled={isUploading}
      />
    </div>
  );
};

export default UploadMedia;