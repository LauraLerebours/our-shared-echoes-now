import React, { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { uploadMediaToStorage } from '@/lib/uploadMediaToStorage';
import { extractImageMetadata, extractVideoMetadata } from '@/lib/extractMetadata';

interface UploadMediaProps {
  userId: string;
  mediaType: 'image' | 'video';
  onUploadSuccess: (publicUrl: string, metadata?: any) => void;
  disabled?: boolean;
}

const UploadMedia: React.FC<UploadMediaProps> = ({ 
  userId, 
  mediaType, 
  onUploadSuccess, 
  disabled 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select a file smaller than 10MB",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    
    try {
      // Extract metadata before uploading
      let metadata = {};
      
      if (file.type.startsWith('image/')) {
        metadata = await extractImageMetadata(file);
        console.log('Extracted image metadata:', metadata);
      } else if (file.type.startsWith('video/')) {
        metadata = await extractVideoMetadata(file);
        console.log('Extracted video metadata:', metadata);
      }

      // Upload the file to storage
      const publicUrl = await uploadMediaToStorage(file, userId);

      if (publicUrl) {
        // Pass both the URL and metadata to the parent component
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
        accept={mediaType === 'video' ? 'video/*' : 'image/*'}
        className="absolute inset-0 opacity-0 pointer-events-none"
        onChange={handleFileChange}
        disabled={isUploading}
      />
    </div>
  );
};

export default UploadMedia;