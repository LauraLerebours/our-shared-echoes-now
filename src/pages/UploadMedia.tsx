
import React, { useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Upload, Video, Image } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { uploadMediaToStorage } from '@/lib/uploadMediaToStorage';

interface UploadMediaProps {
  userId: string;
  mediaType: 'image' | 'video';
  onUploadSuccess: (publicUrl: string) => void;
  disabled?: boolean;
}

const UploadMedia: React.FC<UploadMediaProps> = ({ userId, mediaType, onUploadSuccess, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    const publicUrl = await uploadMediaToStorage(file, userId);

    if (publicUrl) {
      onUploadSuccess(publicUrl);
    } else {
      toast({
        title: "Upload failed",
        description: "Could not upload file to storage.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center px-4 py-2 border rounded bg-white hover:bg-gray-50"
      >
        <Upload className="h-4 w-4 mr-2" />
        Select {mediaType === 'video' ? 'Video' : 'Photo'}
      </button>
      <Input
        ref={fileInputRef}
        type="file"
        accept={mediaType === 'video' ? 'video/*' : 'image/*'}
        className="absolute inset-0 opacity-0 pointer-events-none"
        onChange={handleFileChange}
      />
    </div>
  );
};

export default UploadMedia;
