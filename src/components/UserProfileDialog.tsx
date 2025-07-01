import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { User, Camera, Trash2, Upload, HelpCircle } from 'lucide-react';

interface UserProfileDialogProps {
  children: React.ReactNode;
}

const UserProfileDialog: React.FC<UserProfileDialogProps> = ({ children }) => {
  const { userProfile, updateProfile, updateProfilePicture, removeProfilePicture } = useAuth();
  const [name, setName] = useState(userProfile?.name || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [isRemovingPicture, setIsRemovingPicture] = useState(false);
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Name cannot be empty',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await updateProfile(name.trim());
      
      if (error) {
        throw error;
      }

      toast({
        title: 'Profile updated',
        description: 'Your name has been updated successfully',
      });
      setOpen(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    handleProfilePictureUpload(file);
  };

  const handleProfilePictureUpload = async (file: File) => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please select a JPG, PNG, or WebP image',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: 'Profile picture must be smaller than 5MB',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingPicture(true);
    try {
      const { error } = await updateProfilePicture(file);
      
      if (error) {
        throw error;
      }

      toast({
        title: 'Profile picture updated',
        description: 'Your profile picture has been updated successfully',
      });
    } catch (error) {
      console.error('Error updating profile picture:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update profile picture',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingPicture(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveProfilePicture = async () => {
    setIsRemovingPicture(true);
    try {
      const { error } = await removeProfilePicture();
      
      if (error) {
        throw error;
      }

      toast({
        title: 'Profile picture removed',
        description: 'Your profile picture has been removed successfully',
      });
    } catch (error) {
      console.error('Error removing profile picture:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove profile picture',
        variant: 'destructive',
      });
    } finally {
      setIsRemovingPicture(false);
    }
  };

  const getInitials = () => {
    if (userProfile?.name) {
      return userProfile.name
        .split(' ')
        .map(word => word.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return 'US';
  };

  const showTutorial = () => {
    // Close the profile dialog
    setOpen(false);
    
    // Call the global tutorial function with a small delay to ensure dialog is closed
    setTimeout(() => {
      if (typeof window !== 'undefined' && (window as any).showAppTutorial) {
        (window as any).showAppTutorial();
      }
    }, 100);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update your display name and profile picture. This information will be visible to other users on shared boards.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Profile Picture Section */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <Avatar className="h-24 w-24 border-4 border-memory-purple">
                <AvatarImage 
                  src={userProfile?.profile_picture_url} 
                  alt={userProfile?.name || 'Profile'} 
                />
                <AvatarFallback className="bg-memory-lightpurple text-memory-purple text-xl">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              
              {/* Camera overlay button */}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="absolute bottom-0 right-0 rounded-full w-8 h-8 p-0 shadow-lg"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPicture}
                title="Change profile picture"
              >
                {isUploadingPicture ? (
                  <div className="animate-spin h-4 w-4 border-2 border-memory-purple border-t-transparent rounded-full" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPicture}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {isUploadingPicture ? 'Uploading...' : 'Upload Photo'}
              </Button>
              
              {userProfile?.profile_picture_url && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isRemovingPicture}
                      className="flex items-center gap-2 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      {isRemovingPicture ? 'Removing...' : 'Remove'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Profile Picture</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to remove your profile picture? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleRemoveProfilePicture}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground text-center">
              JPG, PNG, or WebP. Max 5MB.
            </p>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Name Section */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                disabled={isUpdating}
                autoComplete="name"
                maxLength={50}
              />
            </div>
          </form>
          
          {/* Help & Tutorial Section */}
          <div className="space-y-2 pt-2 border-t">
            <Label>Help & Tutorial</Label>
            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center gap-2"
              onClick={showTutorial}
            >
              <HelpCircle className="h-4 w-4" />
              Show App Tutorial
            </Button>
            <p className="text-xs text-muted-foreground">
              Rewatch the tutorial to learn about all features
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isUpdating || !name.trim()}
            className="bg-memory-purple hover:bg-memory-purple/90"
          >
            {isUpdating ? 'Updating...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserProfileDialog;